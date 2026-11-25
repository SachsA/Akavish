// ─── Esport results and calendar ─────────────────────────────────────────────
// The matches the CMS syncs from PandaScore (apps/cms/src/esport/), as the
// site shows them: compact rows, filters (game, tier, tournament, day) kept in
// the URL like the games library, grouped by day then tournament. Pure: used
// by the pages (server) and components/EsportMatches.tsx (browser).

export const ESPORT_GAMES = ['cs2', 'valorant', 'lol', 'r6', 'rl'] as const
export type EsportGame = (typeof ESPORT_GAMES)[number]

export const ESPORT_GAME_LABEL: Record<EsportGame, string> = {
  cs2: 'CS2',
  valorant: 'Valorant',
  lol: 'LoL',
  r6: 'R6 Siege',
  rl: 'Rocket League',
}

/**
 * The CMS games behind each esport game, for the News and Transfers pages
 * filtered by game (/esport/cs2, /esport/transfers/valorant). Several slugs
 * when the scout may name the game differently; a slug with no game is skipped.
 */
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

/** The esport game a CMS game slug is (for the badge on cards), else null. */
export function esportGameOfSlug(slug: string | undefined | null): EsportGame | null {
  if (!slug) return null
  return ESPORT_GAMES.find((g) => ESPORT_GAME_SLUGS[g].includes(slug)) ?? null
}

export const isEsportGame = (v: unknown): v is EsportGame =>
  typeof v === 'string' && (ESPORT_GAMES as readonly string[]).includes(v)

/**
 * Each game's badge colours (cards, results, tournaments): one colour per game
 * so a mixed list reads at a glance (Alex, 2026-11-25). Fixed values, not theme
 * tokens: the same in light and dark, often over a photo. Text picked for contrast.
 */
export const ESPORT_GAME_BADGE: Record<EsportGame, string> = {
  cs2: 'bg-[#f5a623] text-[#111111]',
  valorant: 'bg-[#e8394a] text-[#ffffff]',
  lol: 'bg-[#0ac8b9] text-[#062a33]',
  r6: 'bg-[#2563eb] text-[#ffffff]',
  rl: 'bg-[#8b5cf6] text-[#ffffff]',
}

export const TIER_ORDER = ['s', 'a', 'b', 'c', 'd', 'unranked'] as const
export type Tier = (typeof TIER_ORDER)[number]

export interface EsportTeam {
  name: string
  acronym: string | null
  logo: string | null
}

export interface EsportRow {
  id: number
  game: EsportGame
  status: 'not_started' | 'running' | 'finished' | 'canceled' | 'postponed'
  /** When it starts (or started). */
  at: string
  endAt: string | null
  bestOf: number | null
  name: string
  t1: EsportTeam
  t2: EsportTeam
  s1: number | null
  s2: number | null
  winner: 1 | 2 | null
  forfeit: boolean
  stream: string | null
  /** "IEM Katowice 2027" (league + season), the stage apart ("Playoffs"). */
  event: string
  stage: string
  tier: Tier
  tournamentId: number | null
  /** The stage's page (/esport/tournaments/<slug>), when the sync has its slug. */
  tournamentSlug: string | null
}

/** A raw `esport-matches` doc (depth 1) → a row. Null when it can't be placed. */
export function rowOf(doc: Record<string, unknown>): EsportRow | null {
  const game = doc.game as EsportGame
  if (!ESPORT_GAMES.includes(game)) return null
  const at = (doc.beginAt as string) || (doc.scheduledAt as string)
  if (!at) return null
  const t = (doc.tournament && typeof doc.tournament === 'object' ? doc.tournament : {}) as Record<
    string,
    unknown
  >
  const team = (key: 'team1' | 'team2'): EsportTeam => {
    const g = (doc[key] ?? {}) as Record<string, unknown>
    return {
      name: (g.name as string) || 'TBD',
      acronym: (g.acronym as string) || null,
      logo: (g.logoUrl as string) || null,
    }
  }
  const league = ((t.league as string) || '').trim()
  const serie = ((t.serie as string) || '').trim()
  const tier = (TIER_ORDER as readonly string[]).includes(t.tier as string)
    ? (t.tier as Tier)
    : 'unranked'
  const num = (v: unknown) => (typeof v === 'number' ? v : null)
  return {
    id: Number(doc.pandaId ?? doc.id),
    game,
    status: (doc.status as EsportRow['status']) ?? 'not_started',
    at,
    endAt: (doc.endAt as string) || null,
    bestOf: num(doc.bestOf),
    name: (doc.name as string) || '',
    t1: team('team1'),
    t2: team('team2'),
    s1: num(doc.score1),
    s2: num(doc.score2),
    winner: doc.winner === 1 || doc.winner === 2 ? (doc.winner as 1 | 2) : null,
    forfeit: doc.forfeit === true,
    stream: (doc.streamUrl as string) || null,
    // "IEM Katowice 2027": the season often repeats the league ("IEM" + "IEM Katowice 2027").
    event:
      serie && league && !serie.toLowerCase().startsWith(league.toLowerCase())
        ? `${league} ${serie}`
        : serie || league,
    stage: (t.name as string) || '',
    tier,
    tournamentId: num(t.pandaId),
    tournamentSlug: (t.slug as string) || null,
  }
}

export interface EsportFilters {
  game: EsportGame | ''
  /** Tiers kept; empty = all. */
  tiers: Tier[]
  /** An event name ("PGL Major Singapore 2026"); '' = all. */
  event: string
  /** YYYY-MM-DD in the reader's time zone; '' = all. */
  day: string
}

export const NO_FILTERS: EsportFilters = { game: '', tiers: [], event: '', day: '' }

export function parseFilters(query: string): EsportFilters {
  const p = new URLSearchParams(query)
  const game = p.get('game') as EsportGame
  return {
    game: ESPORT_GAMES.includes(game) ? game : '',
    tiers: (p.get('tier') ?? '')
      .split(',')
      .filter((x): x is Tier => (TIER_ORDER as readonly string[]).includes(x)),
    event: p.get('event') ?? '',
    day: /^\d{4}-\d{2}-\d{2}$/.test(p.get('day') ?? '') ? (p.get('day') as string) : '',
  }
}

export function filtersToQuery(f: EsportFilters): string {
  const p = new URLSearchParams()
  if (f.game) p.set('game', f.game)
  if (f.tiers.length) p.set('tier', f.tiers.join(','))
  if (f.event) p.set('event', f.event)
  if (f.day) p.set('day', f.day)
  const s = p.toString()
  return s ? `?${s}` : ''
}

/** The day (YYYY-MM-DD) of an instant in a time zone. */
export function dayIn(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone })
}

export function filterRows(rows: EsportRow[], f: EsportFilters, timeZone: string): EsportRow[] {
  return rows.filter(
    (r) =>
      (!f.game || r.game === f.game) &&
      (!f.tiers.length || f.tiers.includes(r.tier)) &&
      (!f.event || r.event === f.event) &&
      (!f.day || dayIn(r.at, timeZone) === f.day),
  )
}

export interface EventGroup {
  event: string
  game: EsportGame
  tier: Tier
  rows: EsportRow[]
}

export interface DayGroup {
  day: string
  events: EventGroup[]
}

const tierRank = (t: Tier) => TIER_ORDER.indexOf(t)

/**
 * By day (newest first for results, soonest first for the calendar), then by
 * event, the biggest tier first; matches in time order inside an event.
 */
export function groupRows(
  rows: EsportRow[],
  timeZone: string,
  order: 'newest' | 'soonest',
): DayGroup[] {
  const sign = order === 'newest' ? -1 : 1
  const days = new Map<string, Map<string, EventGroup>>()
  for (const r of [...rows].sort((a, b) => sign * (Date.parse(a.at) - Date.parse(b.at)))) {
    const day = dayIn(r.at, timeZone)
    const events = days.get(day) ?? new Map<string, EventGroup>()
    days.set(day, events)
    const key = `${r.game}|${r.event}`
    const g = events.get(key) ?? { event: r.event, game: r.game, tier: r.tier, rows: [] }
    if (tierRank(r.tier) < tierRank(g.tier)) g.tier = r.tier
    g.rows.push(r)
    events.set(key, g)
  }
  return [...days.entries()].map(([day, events]) => ({
    day,
    events: [...events.values()].sort(
      (a, b) => tierRank(a.tier) - tierRank(b.tier) || a.event.localeCompare(b.event),
    ),
  }))
}

/** The filter's choices: the events and days present, with the current game/tier applied. */
export function choicesOf(rows: EsportRow[], f: EsportFilters, timeZone: string) {
  const scoped = rows.filter(
    (r) => (!f.game || r.game === f.game) && (!f.tiers.length || f.tiers.includes(r.tier)),
  )
  const events = new Map<string, Tier>()
  for (const r of scoped) {
    const t = events.get(r.event)
    if (!t || tierRank(r.tier) < tierRank(t)) events.set(r.event, r.tier)
  }
  return {
    events: [...events.entries()]
      .sort((a, b) => tierRank(a[1]) - tierRank(b[1]) || a[0].localeCompare(b[0]))
      .map(([event]) => event),
    days: [...new Set(scoped.map((r) => dayIn(r.at, timeZone)))].sort(),
    games: ESPORT_GAMES.filter((g) => rows.some((r) => r.game === g)),
  }
}
