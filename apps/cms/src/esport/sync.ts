// ─── Esport sync ─────────────────────────────────────────────────────────────
// Every 10 minutes (the `esportSync` task in payload.config.ts): for each of
// the five games, the running matches, the next 7 days and the last 3 days
// from PandaScore, saved in `esport-matches` / `esport-tournaments` (new ones
// created, changed ones updated, by PandaScore id). About 15-30 requests a run,
// so ~150 an hour against the free plan's 1,000. Does nothing without
// PANDASCORE_TOKEN.

import type { Payload } from 'payload'
import {
  API_BASE,
  ESPORT_GAMES,
  TIERS,
  bracketOf,
  matchOf,
  standingsOf,
  syncUrls,
  tournamentOf,
  type EsportGame,
  type MatchData,
  type RawMatch,
  type Tier,
  type TournamentData,
  type TournamentStructure,
} from './pandascore'

const UA = 'AkavishScout/1.0 (+https://akavish.gg)'
/** At most this many pages per list (100 matches each). */
const MAX_PAGES = 5

export const esportToken = (): string | undefined =>
  process.env.PANDASCORE_TOKEN?.trim() || undefined

/** The `next` page from a Link header, if any. */
export function nextLink(header: string | null): string | null {
  if (!header) return null
  for (const part of header.split(',')) {
    const m = part.match(/<([^>]+)>\s*;\s*rel="next"/)
    if (m) return m[1]
  }
  return null
}

async function getAll(url: string, token: string): Promise<RawMatch[]> {
  const out: RawMatch[] = []
  let next: string | null = url
  for (let page = 0; next && page < MAX_PAGES; page++) {
    const res: Response = await fetch(next, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error(`PandaScore ${res.status} on ${next.replace(/\?.*$/, '')}`)
    const body = (await res.json()) as unknown
    if (!Array.isArray(body)) throw new Error('PandaScore: not a list')
    out.push(...(body as RawMatch[]))
    next = nextLink(res.headers.get('link'))
  }
  return out
}

/** Fetch one game's matches (deduplicated by id; the last copy wins). */
export async function fetchGame(
  game: EsportGame,
  token: string,
  now = new Date(),
): Promise<RawMatch[]> {
  const byId = new Map<number, RawMatch>()
  for (const url of syncUrls(game, now)) {
    for (const m of await getAll(url, token)) if (typeof m?.id === 'number') byId.set(m.id, m)
  }
  return [...byId.values()]
}

type Stored = { id: number | string; pandaId: number; modifiedAt?: string | null } & Record<
  string,
  unknown
>

async function existing(
  payload: Payload,
  collection: 'esport-matches' | 'esport-tournaments',
  ids: number[],
): Promise<Map<number, Stored>> {
  const out = new Map<number, Stored>()
  for (let i = 0; i < ids.length; i += 200) {
    const { docs } = await payload.find({
      collection,
      where: { pandaId: { in: ids.slice(i, i + 200) } },
      limit: 200,
      depth: 0,
      pagination: false,
      overrideAccess: true,
      ...(collection === 'esport-matches' ? { select: { pandaId: true, modifiedAt: true } } : {}),
    } as never)
    for (const d of docs as unknown as Stored[]) out.set(Number(d.pandaId), d)
  }
  return out
}

const sameInstant = (a: unknown, b: unknown): boolean =>
  typeof a === 'string' && typeof b === 'string' && new Date(a).getTime() === new Date(b).getTime()

export interface SyncResult {
  game: EsportGame
  matches: number
  created: number
  updated: number
  /** PandaScore ids of the tournaments with a new or changed match. */
  touched?: number[]
  error?: string
}

/** Save one game's matches and their tournaments. */
export async function saveGame(
  payload: Payload,
  game: EsportGame,
  raws: RawMatch[],
): Promise<SyncResult> {
  const matches: MatchData[] = raws.map((r) => matchOf(r, game))
  const tournaments = new Map<number, TournamentData>()
  for (const r of raws) {
    const t = tournamentOf(r, game)
    if (t) tournaments.set(t.pandaId, t)
  }

  // Tournaments first: matches point at them.
  const storedT = await existing(payload, 'esport-tournaments', [...tournaments.keys()])
  const tournamentDocId = new Map<number, number | string>()
  for (const [pandaId, t] of tournaments) {
    const found = storedT.get(pandaId)
    if (found) {
      // Only when something changed (a tier set later, new dates).
      const changed = (Object.keys(t) as Array<keyof TournamentData>).some(
        (k) =>
          (found[k] ?? null) !== (t[k] ?? null) &&
          !(k.endsWith('At') && sameInstant(found[k], t[k])),
      )
      if (changed) {
        await payload.update({
          collection: 'esport-tournaments',
          id: found.id,
          data: t as never,
          overrideAccess: true,
          depth: 0,
        })
      }
      tournamentDocId.set(pandaId, found.id)
    } else {
      const doc = await payload.create({
        collection: 'esport-tournaments',
        data: t as never,
        overrideAccess: true,
        depth: 0,
      })
      tournamentDocId.set(pandaId, doc.id)
    }
  }

  const storedM = await existing(
    payload,
    'esport-matches',
    matches.map((m) => m.pandaId),
  )
  let created = 0
  let updated = 0
  const touched = new Set<number>()
  for (const m of matches) {
    const { tournamentPandaId, ...fields } = m
    const data = {
      ...fields,
      tournament:
        tournamentPandaId != null ? (tournamentDocId.get(tournamentPandaId) ?? null) : null,
    }
    const found = storedM.get(m.pandaId)
    if (!found) {
      await payload.create({
        collection: 'esport-matches',
        data: data as never,
        overrideAccess: true,
        depth: 0,
      })
      created++
      if (m.tournamentPandaId != null) touched.add(m.tournamentPandaId)
    } else if (!m.modifiedAt || !sameInstant(found.modifiedAt, m.modifiedAt)) {
      await payload.update({
        collection: 'esport-matches',
        id: found.id,
        data: data as never,
        overrideAccess: true,
        depth: 0,
      })
      updated++
      if (m.tournamentPandaId != null) touched.add(m.tournamentPandaId)
    }
  }
  return { game, matches: matches.length, created, updated, touched: [...touched] }
}

/** Brackets / standings fetched per sync at most (2 requests each): ~150 an hour more. */
export const MAX_STRUCTURES = 12

type TournamentRow = {
  id: number | string
  pandaId: number
  game: EsportGame
  tier?: Tier | null
  hasBracket?: boolean | null
  beginAt?: string | null
  structureAt?: string | null
}

/**
 * Which tournaments get their bracket (re)fetched this run: those with a new or
 * changed match first, then those never fetched; bigger tiers, then the most
 * recent, first. Pure.
 */
export function structureQueue(
  rows: TournamentRow[],
  touched: Set<number>,
  max = MAX_STRUCTURES,
): TournamentRow[] {
  const tierRank = (t: Tier | null | undefined) => TIERS.indexOf((t ?? 'unranked') as Tier)
  return rows
    .filter((r) => touched.has(r.pandaId) || !r.structureAt)
    .sort(
      (a, b) =>
        Number(!touched.has(a.pandaId)) - Number(!touched.has(b.pandaId)) ||
        tierRank(a.tier) - tierRank(b.tier) ||
        (b.beginAt ?? '').localeCompare(a.beginAt ?? ''),
    )
    .slice(0, max)
}

/** Fetch and save the brackets (and standings of a stage without a bracket). */
export async function refreshStructures(
  payload: Payload,
  token: string,
  touched: Set<number>,
  now = new Date(),
): Promise<number> {
  const { docs } = await payload.find({
    collection: 'esport-tournaments',
    where: {
      or: [
        { pandaId: { in: touched.size ? [...touched] : [0] } },
        { structureAt: { exists: false } },
      ],
    },
    limit: 1000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: {
      pandaId: true,
      game: true,
      tier: true,
      hasBracket: true,
      beginAt: true,
      structureAt: true,
    },
  } as never)
  let done = 0
  for (const t of structureQueue(docs as unknown as TournamentRow[], touched)) {
    try {
      const base = `${API_BASE}/tournaments/${t.pandaId}`
      const structure: TournamentStructure = {
        matches: bracketOf(await getAll(`${base}/brackets?per_page=100`, token), t.game),
        standings: t.hasBracket
          ? []
          : standingsOf(await getAll(`${base}/standings?per_page=100`, token)),
      }
      await payload.update({
        collection: 'esport-tournaments',
        id: t.id,
        data: { structure, structureAt: now.toISOString() } as never,
        overrideAccess: true,
        depth: 0,
      })
      done++
    } catch (err) {
      payload.logger.warn({
        msg: '[esport] bracket failed',
        tournament: t.pandaId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return done
}

/** One sync of every game. A game that fails doesn't stop the others. */
export async function runEsportSync(payload: Payload, now = new Date()): Promise<SyncResult[]> {
  const token = esportToken()
  if (!token) return []
  const results: SyncResult[] = []
  for (const game of ESPORT_GAMES) {
    try {
      results.push(await saveGame(payload, game, await fetchGame(game, token, now)))
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      payload.logger.warn({ msg: '[esport] sync failed', game, error })
      results.push({ game, matches: 0, created: 0, updated: 0, error })
    }
  }
  // Then the brackets of the tournaments that moved (and the never-fetched).
  const touched = new Set(results.flatMap((r) => r.touched ?? []))
  const brackets = await refreshStructures(payload, token, touched, now).catch((err) => {
    payload.logger.warn({ msg: '[esport] brackets failed', error: String(err) })
    return 0
  })
  payload.logger.info({
    msg: '[esport] synced',
    brackets,
    results: results.map(({ touched: _t, ...r }) => ({ ...r, touched: _t?.length ?? 0 })),
  })
  return results
}

/**
 * GET /api/esport/raw?game=cs2&list=past (editors): the first match of one
 * PandaScore list as PandaScore sends it, and how we read it. To check the
 * mapping against the real API; the token never leaves the server.
 * `?tournament=<PandaScore id>&kind=brackets|standings|tournament` returns
 * that tournament endpoint as sent (brackets view, 2026-11-25).
 */
export const esportRawHandler = async (
  req: import('payload').PayloadRequest,
): Promise<Response> => {
  const { isEditorUser } = await import('../access/roles')
  if (!isEditorUser(req.user)) return Response.json({ error: 'editors only' }, { status: 403 })
  const token = esportToken()
  if (!token) return Response.json({ error: 'PANDASCORE_TOKEN unset' }, { status: 503 })
  const url = new URL(req.url ?? 'http://x')
  const tournament = url.searchParams.get('tournament')
  if (tournament) {
    if (!/^\d+$/.test(tournament))
      return Response.json({ error: 'bad tournament' }, { status: 400 })
    const kind = url.searchParams.get('kind') ?? 'brackets'
    const path = { brackets: '/brackets', standings: '/standings', tournament: '' }[kind]
    if (path === undefined) return Response.json({ error: 'unknown kind' }, { status: 400 })
    const res = await fetch(
      `https://api.pandascore.co/tournaments/${tournament}${path}?per_page=100`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': UA },
        signal: AbortSignal.timeout(20_000),
      },
    )
    return Response.json({
      status: res.status,
      remaining: res.headers.get('x-rate-limit-remaining'),
      raw: await res.json().catch(() => null),
    })
  }
  const game = (url.searchParams.get('game') ?? 'cs2') as EsportGame
  const list = url.searchParams.get('list') ?? 'past'
  if (!ESPORT_GAMES.includes(game)) return Response.json({ error: 'unknown game' }, { status: 400 })
  const index = { running: 0, upcoming: 1, past: 2 }[list] ?? 2
  const target = syncUrls(game, new Date())[index]
  const res = await fetch(target, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': UA },
    signal: AbortSignal.timeout(20_000),
  })
  const body = (await res.json().catch(() => null)) as unknown
  const first = Array.isArray(body) ? (body[0] as RawMatch | undefined) : undefined
  return Response.json({
    status: res.status,
    count: Array.isArray(body) ? body.length : null,
    remaining: res.headers.get('x-rate-limit-remaining'),
    raw: first ?? body,
    mapped: first ? { match: matchOf(first, game), tournament: tournamentOf(first, game) } : null,
  })
}
