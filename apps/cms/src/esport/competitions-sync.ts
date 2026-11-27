// ─── Esport competitions sync (2026-11-27) ───────────────────────────────────
// Every hour (the `esportCompetitions` task, payload.config.ts): for each game,
// the tier S / A / B tournaments on now, coming and the last 100 finished,
// grouped into competitions (`esport-leagues`) and their editions
// (`esport-series`), the winners in `esport-teams`. About 20 requests a run.
// The first run of a game (no edition stored yet) reads every page of the
// finished ones: the whole history, ~35 requests for the five, once; it then
// ticks the competitions on the esport articles already published. Does nothing without PANDASCORE_TOKEN.

import type { Payload, PayloadRequest } from 'payload'
import { API_BASE, ESPORT_GAMES, TIERS, type EsportGame, type Tier } from './pandascore'
import { esportToken, getList } from './sync'
import {
  competitionUrls,
  detectLeagues,
  editionsOf,
  editionDetails,
  editionNames,
  mergeStages,
  winnerOf,
  type LeagueData,
  type LeagueNames,
  type RawTournament,
  type SeriesData,
  type StageData,
} from './competitions'

/** Pages of finished tournaments read for the history (100 each; CS2 has ~13). */
const HISTORY_PAGES = 40

type Id = number | string
type Row = { id: Id; pandaId: number } & Record<string, unknown>

async function byPandaId(
  payload: Payload,
  collection: 'esport-leagues' | 'esport-series' | 'esport-teams',
  ids: number[],
): Promise<Map<number, Row>> {
  const out = new Map<number, Row>()
  for (let i = 0; i < ids.length; i += 200) {
    const { docs } = await payload.find({
      collection,
      where: { pandaId: { in: ids.slice(i, i + 200) } },
      limit: 200,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    } as never)
    for (const d of docs as unknown as Row[]) out.set(Number(d.pandaId), d)
  }
  return out
}

/** JSON with sorted keys and no nulls: Postgres' jsonb reorders keys. */
const stable = (v: unknown): string =>
  JSON.stringify(v ?? null, (_k, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(
          Object.entries(x as Record<string, unknown>)
            .filter(([, y]) => y != null)
            .sort(([a], [b]) => a.localeCompare(b)),
        )
      : x,
  )
const same = (a: unknown, b: unknown) => stable(a) === stable(b)
const sameInstant = (a: unknown, b: unknown) =>
  (a == null && b == null) ||
  (typeof a === 'string' && typeof b === 'string' && Date.parse(a) === Date.parse(b))

/** Save the leagues; a new one whose slug is taken gets its PandaScore id appended. */
async function saveLeagues(
  payload: Payload,
  leagues: Map<number, LeagueData>,
): Promise<Map<number, Id>> {
  const stored = await byPandaId(payload, 'esport-leagues', [...leagues.keys()])
  const out = new Map<number, Id>()
  for (const [pandaId, l] of leagues) {
    const found = stored.get(pandaId)
    if (found) {
      // The slug (the page's URL) never changes once given.
      const data = { name: l.name, logoUrl: l.logoUrl, pandaSlug: l.pandaSlug, game: l.game }
      if ((Object.keys(data) as Array<keyof typeof data>).some((k) => !same(found[k], data[k])))
        await payload.update({
          collection: 'esport-leagues',
          id: found.id,
          data: data as never,
          overrideAccess: true,
          depth: 0,
        })
      out.set(pandaId, found.id)
      continue
    }
    const taken = await payload.count({
      collection: 'esport-leagues',
      where: { slug: { equals: l.slug } },
      overrideAccess: true,
    })
    const doc = await payload.create({
      collection: 'esport-leagues',
      data: { ...l, slug: taken.totalDocs ? `${l.slug}-${pandaId}` : l.slug } as never,
      overrideAccess: true,
      depth: 0,
    })
    out.set(pandaId, doc.id)
  }
  return out
}

interface RawTeam {
  id: number
  name?: string | null
  acronym?: string | null
  slug?: string | null
  image_url?: string | null
  location?: string | null
}

/** The teams these PandaScore ids are, created from GET /teams when new. */
export async function ensureTeams(
  payload: Payload,
  token: string,
  ids: number[],
  game: EsportGame,
): Promise<Map<number, Id>> {
  const stored = await byPandaId(payload, 'esport-teams', ids)
  const out = new Map<number, Id>([...stored].map(([k, v]) => [k, v.id]))
  const missing = ids.filter((id) => !stored.has(id))
  for (let i = 0; i < missing.length; i += 100) {
    const batch = missing.slice(i, i + 100)
    const raws = await getList<RawTeam>(
      `${API_BASE}/teams?filter[id]=${batch.join(',')}&per_page=100`,
      token,
      1,
    )
    for (const t of raws) {
      if (typeof t?.id !== 'number' || out.has(t.id)) continue
      const doc = await payload.create({
        collection: 'esport-teams',
        data: {
          pandaId: t.id,
          game,
          name: t.name?.trim() || `Team ${t.id}`,
          acronym: t.acronym?.trim() || null,
          slug: t.slug?.trim() || null,
          logoUrl: t.image_url?.trim() || null,
          location: t.location?.trim() || null,
        } as never,
        overrideAccess: true,
        depth: 0,
      })
      out.set(t.id, doc.id)
    }
  }
  return out
}

export interface CompetitionResult {
  game: EsportGame
  tournaments: number
  series: number
  created: number
  updated: number
  error?: string
}

/** Save one game's editions (stages merged with the stored ones). */
async function saveGame(
  payload: Payload,
  token: string,
  game: EsportGame,
  raws: RawTournament[],
  now: Date,
): Promise<{ result: CompetitionResult; leagues: Id[] }> {
  const { leagues, series } = editionsOf(raws, game, now)
  const leagueIds = await saveLeagues(payload, leagues)
  const stored = await byPandaId(payload, 'esport-series', [...series.keys()])

  // Stages merged with what's stored, and the winner worked out on all of them.
  const merged = [...series.values()].map((s): SeriesData & { keepWinner: boolean } => {
    const found = stored.get(s.pandaId)
    const stages = mergeStages((found?.stages as StageData[] | undefined) ?? [], s.stages)
    const endAt = stages.reduce<string | null>(
      (end, x) => (x.endAt && (!end || x.endAt > end) ? x.endAt : end),
      null,
    )
    const winner = winnerOf(s.serieWinner, stages, s.endAt ?? endAt, now)
    const tier = stages.reduce<Tier>(
      (best, x) => (TIERS.indexOf(x.tier) < TIERS.indexOf(best) ? x.tier : best),
      s.tier,
    )
    return {
      ...s,
      stages,
      tier,
      endAt: s.endAt ?? endAt,
      ...editionDetails(stages),
      winnerPandaId: winner,
      keepWinner: winner == null && found?.winner != null,
    }
  })
  const teams = await ensureTeams(
    payload,
    token,
    [...new Set(merged.flatMap((s) => (s.winnerPandaId != null ? [s.winnerPandaId] : [])))],
    game,
  )

  let created = 0
  let updated = 0
  const moved = new Set<Id>()
  for (const s of merged) {
    const found = stored.get(s.pandaId)
    const data: Record<string, unknown> = {
      pandaId: s.pandaId,
      game,
      league: leagueIds.get(s.leaguePandaId) ?? null,
      name: s.name || String(s.year ?? ''),
      year: s.year,
      slug: s.slug,
      beginAt: s.beginAt,
      endAt: s.endAt,
      tier: s.tier,
      prizePool: s.prizePool,
      country: s.country,
      stages: s.stages,
    }
    if (!s.keepWinner)
      data.winner = s.winnerPandaId != null ? (teams.get(s.winnerPandaId) ?? null) : null
    if (!found) {
      await payload.create({
        collection: 'esport-series',
        data: data as never,
        overrideAccess: true,
        depth: 0,
      })
      created++
      if (data.league != null) moved.add(data.league as Id)
      continue
    }
    const changed = Object.keys(data).some((k) =>
      k.endsWith('At') ? !sameInstant(found[k], data[k]) : !same(found[k], data[k]),
    )
    if (changed) {
      await payload.update({
        collection: 'esport-series',
        id: found.id,
        data: data as never,
        overrideAccess: true,
        depth: 0,
      })
      updated++
      if (data.league != null) moved.add(data.league as Id)
    }
  }
  // Only the competitions with a new or changed edition: their list line.
  return {
    result: { game, tournaments: raws.length, series: series.size, created, updated },
    leagues: [...moved],
  }
}

type SeriesRow = {
  name?: string | null
  beginAt?: string | null
  endAt?: string | null
  tier?: Tier | null
  stages?: StageData[] | null
  winner?: {
    pandaId?: number
    name?: string
    acronym?: string | null
    logoUrl?: string | null
    slug?: string | null
  } | null
}

/** A league's best tier, latest edition and latest winner, for the list page. */
export async function refreshLeague(payload: Payload, id: Id, now = new Date()): Promise<void> {
  const { docs } = await payload.find({
    collection: 'esport-series',
    where: { league: { equals: id } },
    sort: '-beginAt',
    limit: 500,
    depth: 1,
    pagination: false,
    overrideAccess: true,
  } as never)
  const rows = docs as unknown as SeriesRow[]
  if (!rows.length) return
  const edition = (r: SeriesRow) => ({
    name: r.name ?? '',
    beginAt: r.beginAt ?? null,
    endAt: r.endAt ?? null,
    stage: r.stages?.find((s) => s.slug)?.slug ?? null,
  })
  const champ = rows.find((r) => r.winner && r.endAt && Date.parse(r.endAt) <= now.getTime())
  const tier = rows.reduce<Tier>(
    (best, r) => (TIERS.indexOf(r.tier ?? 'unranked') < TIERS.indexOf(best) ? r.tier! : best),
    'unranked',
  )
  await payload.update({
    collection: 'esport-leagues',
    id,
    data: {
      tier,
      lastAt: rows[0].beginAt ?? null,
      latest: {
        edition: edition(rows[0]),
        editions: rows.length,
        champion: champ
          ? {
              edition: edition(champ),
              team: {
                pandaId: champ.winner!.pandaId ?? null,
                name: champ.winner!.name ?? '',
                acronym: champ.winner!.acronym ?? null,
                logoUrl: champ.winner!.logoUrl ?? null,
              },
            }
          : null,
      },
    } as never,
    overrideAccess: true,
    depth: 0,
  })
}

// ─── The competitions an article names ───────────────────────────────────────

/** CMS game slugs → esport game (same list as the site's ESPORT_GAME_SLUGS). */
export const ESPORT_GAME_SLUGS: Record<EsportGame, string[]> = {
  cs2: ['counter-strike-2'],
  valorant: ['valorant'],
  lol: ['league-of-legends'],
  r6: [
    'rainbow-six-siege',
    'rainbow-six-siege-x',
    'tom-clancy-s-rainbow-six-siege',
    'tom-clancy-s-rainbow-six-siege-x',
  ],
  rl: ['rocket-league'],
}

export const esportGameOfSlug = (slug: string | null | undefined): EsportGame | null =>
  (slug && ESPORT_GAMES.find((g) => ESPORT_GAME_SLUGS[g].includes(slug))) || null

/** Every competition with the names articles use: its own, its aliases, its editions of the last two years. */
export async function leagueNames(
  payload: Payload,
  req?: PayloadRequest,
  now = new Date(),
): Promise<LeagueNames[]> {
  const [leagues, series] = await Promise.all([
    payload.find({
      collection: 'esport-leagues',
      limit: 2000,
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: { name: true, aliases: true, game: true },
      req,
    } as never),
    payload.find({
      collection: 'esport-series',
      where: {
        beginAt: { greater_than: new Date(now.getTime() - 2 * 365 * 86400_000).toISOString() },
      },
      limit: 5000,
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: { name: true, league: true },
      req,
    } as never),
  ])
  const editions = new Map<Id, string[]>()
  for (const s of series.docs as unknown as Array<{ name?: string; league?: Id | null }>) {
    if (s.league == null || !s.name) continue
    editions.set(s.league, [...(editions.get(s.league) ?? []), s.name])
  }
  return (
    leagues.docs as unknown as Array<{
      id: Id
      name: string
      aliases?: string[] | null
      game: EsportGame
    }>
  ).map((d) => ({
    id: d.id,
    game: d.game,
    names: [
      ...new Set([
        d.name,
        ...(d.aliases ?? []),
        ...(editions.get(d.id) ?? []).flatMap((e) => editionNames(d.name, e, d.game)),
      ]),
    ],
  }))
}

type ArticleLike = {
  category?: string | null
  title?: string | null
  excerpt?: string | null
  game?: unknown
  tags?: unknown
}

const idOf = (v: unknown): Id | null =>
  v == null ? null : typeof v === 'object' ? ((v as { id?: Id }).id ?? null) : (v as Id)

/** The competitions an esport article names in its title or tags, else its excerpt. */
export async function articleLeagues(
  payload: Payload,
  a: ArticleLike,
  names: LeagueNames[],
  req?: PayloadRequest,
): Promise<Id[]> {
  if (a.category !== 'esport' || !names.length) return []
  const gameId = idOf(a.game)
  const tagIds = (Array.isArray(a.tags) ? a.tags : []).map(idOf).filter((x): x is Id => x != null)
  const [game, tags] = await Promise.all([
    gameId != null
      ? payload
          .findByID({ collection: 'games', id: gameId, depth: 0, overrideAccess: true, req })
          .then((g) => esportGameOfSlug((g as { slug?: string }).slug))
          .catch(() => null)
      : null,
    tagIds.length
      ? payload
          .find({
            collection: 'tags',
            where: { id: { in: tagIds } },
            depth: 0,
            limit: 50,
            pagination: false,
            overrideAccess: true,
            req,
          } as never)
          .then((r) => (r.docs as Array<{ name?: string }>).map((t) => t.name ?? ''))
          .catch(() => [] as string[])
      : ([] as string[]),
  ])
  // The title and tags say what it's about; the excerpt only when they name none
  // (it often cites other competitions: "after the LCK final, Worlds…").
  const first = detectLeagues([a.title ?? '', ...tags].join('\n'), names, game)
  return first.length ? first : detectLeagues(a.excerpt ?? '', names, game)
}

/** Tick the competitions on the published esport articles that have none (the history run). */
export async function tagPublishedArticles(payload: Payload): Promise<number> {
  const names = await leagueNames(payload)
  const { docs } = await payload.find({
    collection: 'articles',
    where: { and: [{ category: { equals: 'esport' } }, { status: { equals: 'published' } }] },
    limit: 2000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  } as never)
  let n = 0
  for (const a of docs as unknown as Array<ArticleLike & { id: Id; esportLeagues?: unknown[] }>) {
    if (a.esportLeagues?.length) continue
    const found = await articleLeagues(payload, a, names)
    if (!found.length) continue
    await payload.update({
      collection: 'articles',
      id: a.id,
      data: { esportLeagues: found } as never,
      overrideAccess: true,
      depth: 0,
      context: { esportLeaguesOnly: true },
    })
    n++
  }
  return n
}

/** One run of every game. A game that fails doesn't stop the others. */
export async function runCompetitionSync(
  payload: Payload,
  now = new Date(),
): Promise<CompetitionResult[]> {
  const token = esportToken()
  if (!token) return []
  const results: CompetitionResult[] = []
  const touched = new Set<Id>()
  let history = false
  for (const game of ESPORT_GAMES) {
    try {
      // A game with no edition yet (first run, or one that failed): its whole history.
      const first =
        (
          await payload.count({
            collection: 'esport-series',
            where: { game: { equals: game } },
            overrideAccess: true,
          })
        ).totalDocs === 0
      history ||= first
      const raws: RawTournament[] = []
      for (const url of competitionUrls(game))
        raws.push(
          ...(await getList<RawTournament>(
            url,
            token,
            first && url.includes('/past?') ? HISTORY_PAGES : 1,
          )),
        )
      const { result, leagues } = await saveGame(payload, token, game, raws, now)
      results.push(result)
      for (const id of leagues) touched.add(id)
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      payload.logger.warn({ msg: '[esport] competitions failed', game, error })
      results.push({ game, tournaments: 0, series: 0, created: 0, updated: 0, error })
    }
  }
  for (const id of touched)
    await refreshLeague(payload, id, now).catch((err) =>
      payload.logger.warn({ msg: '[esport] league refresh failed', id, error: String(err) }),
    )
  const tagged = history
    ? await tagPublishedArticles(payload).catch((err) => {
        payload.logger.warn({ msg: '[esport] article tagging failed', error: String(err) })
        return 0
      })
    : 0
  payload.logger.info({ msg: '[esport] competitions synced', history, tagged, results })
  return results
}
