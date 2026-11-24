// ─── PandaScore (esport data, scout step 4) ──────────────────────────────────
// Schedules, results and tournaments for the five games Akavish covers, from
// PandaScore's REST API on its free plan ("Schedules, results & context
// data": 1,000 requests an hour, no detailed stats). Off unless
// PANDASCORE_TOKEN is set (Railway). Liquipedia was ruled out on 2026-11-24:
// its terms forbid reading the wiki's pages automatically and its data API is
// paid for a commercial site (49 $ a month per data type and per game).
//
// Pure helpers here (mapping, URLs), so they're unit-tested without the API;
// the sync itself is in sync.ts.

export const ESPORT_GAMES = ['cs2', 'valorant', 'lol', 'r6', 'rl'] as const
export type EsportGame = (typeof ESPORT_GAMES)[number]

/** Our game key → PandaScore's videogame slug in URLs (CS2 is still `csgo`). */
export const PANDASCORE_SLUG: Record<EsportGame, string> = {
  cs2: 'csgo',
  valorant: 'valorant',
  lol: 'lol',
  r6: 'r6siege',
  rl: 'rl',
}

export const GAME_LABEL: Record<EsportGame, string> = {
  cs2: 'Counter-Strike 2',
  valorant: 'Valorant',
  lol: 'League of Legends',
  r6: 'Rainbow Six Siege',
  rl: 'Rocket League',
}

export const TIERS = ['s', 'a', 'b', 'c', 'd', 'unranked'] as const
export type Tier = (typeof TIERS)[number]

export const MATCH_STATUSES = [
  'not_started',
  'running',
  'finished',
  'canceled',
  'postponed',
] as const
export type MatchStatus = (typeof MATCH_STATUSES)[number]

export const API_BASE = 'https://api.pandascore.co'

// ─── Raw API shapes (only what we read; every field may be null) ─────────────

interface RawTeam {
  id?: number | null
  name?: string | null
  acronym?: string | null
  image_url?: string | null
  slug?: string | null
}

export interface RawMatch {
  id: number
  name?: string | null
  slug?: string | null
  status?: string | null
  scheduled_at?: string | null
  begin_at?: string | null
  end_at?: string | null
  number_of_games?: number | null
  match_type?: string | null
  winner_id?: number | null
  forfeit?: boolean | null
  draw?: boolean | null
  modified_at?: string | null
  opponents?: Array<{ type?: string | null; opponent?: RawTeam | null } | null> | null
  results?: Array<{ team_id?: number | null; score?: number | null } | null> | null
  league?: {
    id?: number | null
    name?: string | null
    image_url?: string | null
    slug?: string | null
  } | null
  serie?: {
    id?: number | null
    full_name?: string | null
    name?: string | null
    year?: number | null
  } | null
  tournament?: {
    id?: number | null
    name?: string | null
    slug?: string | null
    tier?: string | null
    begin_at?: string | null
    end_at?: string | null
  } | null
  streams_list?: Array<{
    language?: string | null
    raw_url?: string | null
    official?: boolean | null
    main?: boolean | null
  } | null> | null
}

// ─── Our shapes (what we store) ──────────────────────────────────────────────

export interface TeamSide {
  pandaId: number | null
  name: string
  acronym: string | null
  logoUrl: string | null
}

export interface TournamentData {
  pandaId: number
  game: EsportGame
  name: string
  league: string
  leagueLogoUrl: string | null
  serie: string
  tier: Tier
  beginAt: string | null
  endAt: string | null
}

export interface MatchData {
  pandaId: number
  game: EsportGame
  tournamentPandaId: number | null
  name: string
  status: MatchStatus
  scheduledAt: string | null
  beginAt: string | null
  endAt: string | null
  bestOf: number | null
  team1: TeamSide
  team2: TeamSide
  score1: number | null
  score2: number | null
  /** 1 or 2; null before the end, or a draw. */
  winner: 1 | 2 | null
  forfeit: boolean
  draw: boolean
  streamUrl: string | null
  modifiedAt: string | null
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function tierOf(v: unknown): Tier {
  const t = typeof v === 'string' ? v.toLowerCase() : ''
  return (TIERS as readonly string[]).includes(t) ? (t as Tier) : 'unranked'
}

function teamOf(raw: RawTeam | null | undefined): TeamSide {
  return {
    pandaId: num(raw?.id),
    name: str(raw?.name) ?? 'TBD',
    acronym: str(raw?.acronym),
    logoUrl: str(raw?.image_url),
  }
}

/** The tournament a match belongs to, with its league and season ("IEM Katowice 2027"). */
export function tournamentOf(raw: RawMatch, game: EsportGame): TournamentData | null {
  const id = num(raw.tournament?.id)
  if (id == null) return null
  return {
    pandaId: id,
    game,
    name: str(raw.tournament?.name) ?? 'Tournament',
    league: str(raw.league?.name) ?? '',
    leagueLogoUrl: str(raw.league?.image_url),
    serie: str(raw.serie?.full_name) ?? str(raw.serie?.name) ?? '',
    tier: tierOf(raw.tournament?.tier),
    beginAt: str(raw.tournament?.begin_at),
    endAt: str(raw.tournament?.end_at),
  }
}

/** One match as we store it. Teams in PandaScore's order; scores matched by team id. */
export function matchOf(raw: RawMatch, game: EsportGame): MatchData {
  const teams = (raw.opponents ?? []).map((o) => o?.opponent ?? null)
  const team1 = teamOf(teams[0])
  const team2 = teamOf(teams[1])
  const scoreFor = (team: TeamSide): number | null => {
    if (team.pandaId == null) return null
    const r = (raw.results ?? []).find((x) => x?.team_id === team.pandaId)
    return num(r?.score)
  }
  const winnerId = num(raw.winner_id)
  const status = (MATCH_STATUSES as readonly string[]).includes(raw.status ?? '')
    ? (raw.status as MatchStatus)
    : 'not_started'
  const streams = (raw.streams_list ?? []).filter(
    (s): s is NonNullable<typeof s> => !!s && !!str(s.raw_url),
  )
  const stream =
    streams.find((s) => s.main) ??
    streams.find((s) => s.official && s.language === 'en') ??
    streams[0] ??
    null
  return {
    pandaId: raw.id,
    game,
    tournamentPandaId: num(raw.tournament?.id),
    name: str(raw.name) ?? `${team1.name} vs ${team2.name}`,
    status,
    scheduledAt: str(raw.scheduled_at),
    beginAt: str(raw.begin_at),
    endAt: str(raw.end_at),
    bestOf: num(raw.number_of_games),
    team1,
    team2,
    score1: scoreFor(team1),
    score2: scoreFor(team2),
    winner:
      winnerId == null
        ? null
        : winnerId === team1.pandaId
          ? 1
          : winnerId === team2.pandaId
            ? 2
            : null,
    forfeit: raw.forfeit === true,
    draw: raw.draw === true,
    streamUrl: stream ? str(stream.raw_url) : null,
    modifiedAt: str(raw.modified_at),
  }
}

/** The list URLs one sync reads for a game: running, the next 7 days, the last 3 days. */
export function syncUrls(game: EsportGame, now: Date): string[] {
  const slug = PANDASCORE_SLUG[game]
  const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')
  const day = 24 * 3600 * 1000
  const soon = iso(new Date(now.getTime() + 7 * day))
  const ago = iso(new Date(now.getTime() - 3 * day))
  const n = iso(now)
  return [
    `${API_BASE}/${slug}/matches/running?per_page=100`,
    `${API_BASE}/${slug}/matches/upcoming?per_page=100&sort=begin_at&range[begin_at]=${n},${soon}`,
    `${API_BASE}/${slug}/matches/past?per_page=100&sort=-end_at&range[end_at]=${ago},${n}`,
  ]
}
