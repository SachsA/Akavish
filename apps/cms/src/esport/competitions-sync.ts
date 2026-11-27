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
  type SeriesData,
  type StageData,
} from './competitions'
import {
  detectTeams,
  lineupsOf,
  playerOf,
  teamNames,
  teamOf,
  teamSlug,
  teamStanding,
  type RawRosterPlayer,
  type RawRosterTeam,
  type RawTournamentWithRosters,
  type PlayerData,
  type TeamData,
  type TeamNames,
} from './teams'

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

async function byKey(
  payload: Payload,
  keys: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>()
  for (let i = 0; i < keys.length; i += 200) {
    const { docs } = await payload.find({
      collection: 'esport-lineups',
      where: { key: { in: keys.slice(i, i + 200) } },
      limit: 200,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    } as never)
    for (const d of docs as unknown as Array<Record<string, unknown>>) out.set(String(d.key), d)
  }
  return out
}
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

interface RawTeam extends RawRosterTeam {
  players?: RawRosterPlayer[] | null
}

/** A slug for a new team: ours ("cs2-vitality"), its PandaScore id appended when taken. */
async function freeTeamSlug(payload: Payload, base: string, pandaId: number): Promise<string> {
  const taken = await payload.count({
    collection: 'esport-teams',
    where: { slug: { equals: base } },
    overrideAccess: true,
  })
  return taken.totalDocs ? `${base}-${pandaId}` : base
}

/**
 * Save these teams (from the rosters: created, or renamed / new logo), and
 * make sure the other ids exist too (winners with no roster: GET /teams).
 * Returns PandaScore id → doc id.
 */
export async function saveTeams(
  payload: Payload,
  token: string,
  game: EsportGame,
  known: Map<number, TeamData>,
  extra: number[] = [],
): Promise<Map<number, Id>> {
  const all = [...new Set([...known.keys(), ...extra])]
  const stored = await byPandaId(payload, 'esport-teams', all)
  const out = new Map<number, Id>([...stored].map(([k, v]) => [k, v.id]))
  const write = async (t: TeamData) => {
    const found = stored.get(t.pandaId)
    const { pandaId, ...fields } = t
    if (found) {
      const data: Record<string, unknown> = {}
      for (const k of Object.keys(fields) as Array<keyof typeof fields>)
        if (fields[k] != null && !same(found[k], fields[k])) data[k] = fields[k]
      if (!found.slug) data.slug = await freeTeamSlug(payload, teamSlug(t.game, t.name), pandaId)
      if (Object.keys(data).length)
        await payload.update({
          collection: 'esport-teams',
          id: found.id,
          data: data as never,
          overrideAccess: true,
          depth: 0,
        })
      return
    }
    const doc = await payload.create({
      collection: 'esport-teams',
      data: { ...t, slug: await freeTeamSlug(payload, teamSlug(t.game, t.name), pandaId) } as never,
      overrideAccess: true,
      depth: 0,
    })
    out.set(pandaId, doc.id)
    stored.set(pandaId, { ...t, id: doc.id } as Row)
  }
  for (const t of known.values()) await write(t)
  // Teams stored before they had our slug (the winners read on 2026-11-27).
  for (const id of extra) {
    const found = stored.get(id)
    if (found && !found.slug && typeof found.name === 'string' && found.game)
      await payload.update({
        collection: 'esport-teams',
        id: found.id,
        data: {
          slug: await freeTeamSlug(payload, teamSlug(found.game as EsportGame, found.name), id),
        } as never,
        overrideAccess: true,
        depth: 0,
      })
  }
  const missing = extra.filter((id) => !out.has(id))
  for (let i = 0; i < missing.length; i += 100) {
    const raws = await getList<RawTeam>(
      `${API_BASE}/teams?filter[id]=${missing.slice(i, i + 100).join(',')}&per_page=100`,
      token,
      1,
    )
    for (const r of raws) {
      const t = teamOf(r, game)
      if (t && !out.has(t.pandaId)) await write(t)
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
  raws: RawTournamentWithRosters[],
  now: Date,
): Promise<{ result: CompetitionResult; leagues: Id[]; teams: Id[] }> {
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
  // The teams that played them (their lineups), and the winners.
  const rosters = lineupsOf(raws, game, new Set(series.keys()))
  const teams = await saveTeams(payload, token, game, rosters.teams, [
    ...new Set(merged.flatMap((s) => (s.winnerPandaId != null ? [s.winnerPandaId] : []))),
  ])
  const seriesIds = new Map<number, Id>([...stored].map(([k, v]) => [k, v.id]))

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
      const doc = await payload.create({
        collection: 'esport-series',
        data: data as never,
        overrideAccess: true,
        depth: 0,
      })
      seriesIds.set(s.pandaId, doc.id)
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
  // The lineups (who played, with whom), by edition and team.
  const tierOf = new Map(merged.map((s) => [s.pandaId, s.tier]))
  const storedL = await byKey(payload, [...rosters.lineups.keys()])
  const movedTeams = new Set<Id>()
  for (const l of rosters.lineups.values()) {
    const team = teams.get(l.teamPandaId)
    if (team == null) continue
    const data = {
      key: l.key,
      team,
      series: seriesIds.get(l.seriePandaId) ?? null,
      game,
      tier: tierOf.get(l.seriePandaId) ?? 'unranked',
      beginAt: l.beginAt,
      players: l.players,
    }
    const found = storedL.get(l.key)
    if (found) {
      const changed = (Object.keys(data) as Array<keyof typeof data>).some((k) =>
        k === 'beginAt' ? !sameInstant(found[k], data[k]) : !same(found[k], data[k]),
      )
      if (!changed) continue
      await payload.update({
        collection: 'esport-lineups',
        id: found.id as Id,
        data: data as never,
        overrideAccess: true,
        depth: 0,
      })
    } else {
      await payload.create({
        collection: 'esport-lineups',
        data: data as never,
        overrideAccess: true,
        depth: 0,
      })
    }
    movedTeams.add(team)
  }
  // Only the competitions with a new or changed edition: their list line.
  return {
    result: { game, tournaments: raws.length, series: series.size, created, updated },
    leagues: [...moved],
    teams: [...movedTeams],
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
                slug: champ.winner!.slug ?? null,
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

/** The teams articles can name: those that played in the last 18 months, with their other names. */
export async function teamNamesList(
  payload: Payload,
  req?: PayloadRequest,
  now = new Date(),
): Promise<TeamNames[]> {
  const { docs } = await payload.find({
    collection: 'esport-teams',
    where: { lastAt: { greater_than: new Date(now.getTime() - 548 * 86_400_000).toISOString() } },
    limit: 5000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: { name: true, acronym: true, aliases: true, game: true },
    req,
  } as never)
  return (
    docs as unknown as Array<{
      id: Id
      name: string
      acronym?: string | null
      aliases?: string[] | null
      game?: EsportGame | null
    }>
  ).flatMap((d) =>
    d.game
      ? [{ id: d.id, game: d.game, names: teamNames(d.name, d.acronym ?? null, d.aliases ?? []) }]
      : [],
  )
}

/** What an esport article is about, read once: its game and its tags' names. */
async function articleContext(
  payload: Payload,
  a: ArticleLike,
  req?: PayloadRequest,
): Promise<{ game: EsportGame | null; tags: string[] }> {
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
  return { game, tags }
}

/**
 * The competitions and teams an esport article names: in its title and tags
 * first, the excerpt only when they name none (it often cites others: "after
 * the LCK final, Worlds…").
 */
export async function articleEsport(
  payload: Payload,
  a: ArticleLike,
  names: { leagues: LeagueNames[]; teams: TeamNames[] },
  req?: PayloadRequest,
): Promise<{ leagues: Id[]; teams: Id[] }> {
  if (a.category !== 'esport') return { leagues: [], teams: [] }
  const { game, tags } = await articleContext(payload, a, req)
  const head = [a.title ?? '', ...tags].join('\n')
  const pick = <T>(find: (text: string) => T[]) => {
    const first = find(head)
    return first.length ? first : find(a.excerpt ?? '')
  }
  return {
    leagues: pick((t) => detectLeagues(t, names.leagues, game)) as Id[],
    teams: pick((t) => detectTeams(t, names.teams, game)) as Id[],
  }
}

/** The competitions an esport article names (title and tags, else excerpt). */
export async function articleLeagues(
  payload: Payload,
  a: ArticleLike,
  names: LeagueNames[],
  req?: PayloadRequest,
): Promise<Id[]> {
  return (await articleEsport(payload, a, { leagues: names, teams: [] }, req)).leagues
}

/** Tick the competitions and teams on the published esport articles that have none (history runs). */
export async function tagPublishedArticles(payload: Payload): Promise<number> {
  const names = { leagues: await leagueNames(payload), teams: await teamNamesList(payload) }
  const { docs } = await payload.find({
    collection: 'articles',
    where: { and: [{ category: { equals: 'esport' } }, { status: { equals: 'published' } }] },
    limit: 2000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  } as never)
  let n = 0
  for (const a of docs as unknown as Array<
    ArticleLike & { id: Id; esportLeagues?: unknown[]; esportTeams?: unknown[] }
  >) {
    if (a.esportLeagues?.length && a.esportTeams?.length) continue
    const found = await articleEsport(payload, a, names)
    const data: Record<string, Id[]> = {}
    if (!a.esportLeagues?.length && found.leagues.length) data.esportLeagues = found.leagues
    if (!a.esportTeams?.length && found.teams.length) data.esportTeams = found.teams
    if (!Object.keys(data).length) continue
    await payload.update({
      collection: 'articles',
      id: a.id,
      data: data as never,
      overrideAccess: true,
      depth: 0,
      context: { esportLeaguesOnly: true },
    })
    n++
  }
  return n
}

/** A team's best tier and latest edition, from its lineups. */
export async function refreshTeam(payload: Payload, id: Id, now = new Date()): Promise<void> {
  const { docs } = await payload.find({
    collection: 'esport-lineups',
    where: { team: { equals: id } },
    limit: 1000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: { tier: true, beginAt: true },
  } as never)
  const { tier, lastAt } = teamStanding(
    docs as Array<{ tier?: Tier | null; beginAt?: string | null }>,
    now,
  )
  await payload.update({
    collection: 'esport-teams',
    id,
    data: { tier, lastAt } as never,
    overrideAccess: true,
    depth: 0,
  })
}

/** Teams whose roster is read per run (GET /teams, 100 a request). */
const DETAILS_PER_RUN = 300

/**
 * The current rosters of the teams that played in the last year, read again
 * after 3 days: GET /teams?filter[id]=… (`players`), 3 requests a run at most.
 */
export async function refreshTeamDetails(
  payload: Payload,
  token: string,
  now = new Date(),
): Promise<number> {
  const stale = new Date(now.getTime() - 3 * 86_400_000).toISOString()
  const { docs } = await payload.find({
    collection: 'esport-teams',
    where: {
      and: [
        { lastAt: { greater_than: new Date(now.getTime() - 365 * 86_400_000).toISOString() } },
        { or: [{ playersAt: { exists: false } }, { playersAt: { less_than: stale } }] },
      ],
    },
    sort: '-lastAt',
    limit: DETAILS_PER_RUN,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: { pandaId: true },
  } as never)
  const rows = docs as unknown as Array<{ id: Id; pandaId: number }>
  let n = 0
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100)
    const raws = await getList<RawTeam>(
      `${API_BASE}/teams?filter[id]=${batch.map((r) => r.pandaId).join(',')}&per_page=100`,
      token,
      1,
    )
    const byId = new Map(raws.map((r) => [r.id, r]))
    for (const row of batch) {
      const raw = byId.get(row.pandaId)
      const players = (raw?.players ?? [])
        .filter((p) => p?.active !== false)
        .map(playerOf)
        .filter((p): p is PlayerData => p !== null)
      await payload.update({
        collection: 'esport-teams',
        id: row.id,
        data: { players, playersAt: now.toISOString() } as never,
        overrideAccess: true,
        depth: 0,
      })
      n++
    }
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
  const touchedTeams = new Set<Id>()
  let history = false
  for (const game of ESPORT_GAMES) {
    try {
      // A game with no edition or no lineup yet (first run, one that failed,
      // or the lineups added on 2026-11-27): its whole history.
      const count = async (collection: 'esport-series' | 'esport-lineups') =>
        (
          await payload.count({
            collection,
            where: { game: { equals: game } },
            overrideAccess: true,
          })
        ).totalDocs
      const first = (await count('esport-series')) === 0 || (await count('esport-lineups')) === 0
      history ||= first
      const raws: RawTournamentWithRosters[] = []
      for (const url of competitionUrls(game))
        raws.push(
          ...(await getList<RawTournamentWithRosters>(
            url,
            token,
            first && url.includes('/past?') ? HISTORY_PAGES : 1,
          )),
        )
      const { result, leagues, teams } = await saveGame(payload, token, game, raws, now)
      results.push(result)
      for (const id of leagues) touched.add(id)
      for (const id of teams) touchedTeams.add(id)
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      payload.logger.warn({ msg: '[esport] competitions failed', game, error })
      results.push({ game, tournaments: 0, series: 0, created: 0, updated: 0, error })
    }
  }
  // A history run refreshes every competition's line (its winner's team page link too).
  if (history) {
    const all = await payload.find({
      collection: 'esport-leagues',
      limit: 5000,
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: { id: true },
    } as never)
    for (const d of all.docs as Array<{ id: Id }>) touched.add(d.id)
  }
  for (const id of touched)
    await refreshLeague(payload, id, now).catch((err) =>
      payload.logger.warn({ msg: '[esport] league refresh failed', id, error: String(err) }),
    )
  for (const id of touchedTeams)
    await refreshTeam(payload, id, now).catch((err) =>
      payload.logger.warn({ msg: '[esport] team refresh failed', id, error: String(err) }),
    )
  const rosters = await refreshTeamDetails(payload, token, now).catch((err) => {
    payload.logger.warn({ msg: '[esport] team rosters failed', error: String(err) })
    return 0
  })
  const tagged = history
    ? await tagPublishedArticles(payload).catch((err) => {
        payload.logger.warn({ msg: '[esport] article tagging failed', error: String(err) })
        return 0
      })
    : 0
  payload.logger.info({
    msg: '[esport] competitions synced',
    history,
    tagged,
    teams: touchedTeams.size,
    rosters,
    results,
  })
  return results
}
