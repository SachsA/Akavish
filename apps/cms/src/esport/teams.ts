// ─── Esport teams and their lineups (2026-11-27, step 2) ─────────────────────
// Every team that played a tier S / A / B edition, with the lineup it played
// each edition with: PandaScore's tournaments lists carry an
// `expected_roster` per team (the players registered for that tournament, as
// they were then), so the roster history comes for free. The current roster
// comes from GET /teams (`players`). Pure helpers here (tested), saved by
// competitions-sync.ts.

import type { EsportGame, Tier } from './pandascore'
import { slugify, type RawTournament } from './competitions'

export interface RawRosterPlayer {
  id?: number | null
  name?: string | null
  first_name?: string | null
  last_name?: string | null
  nationality?: string | null
  role?: string | null
  active?: boolean | null
}

export interface RawRosterTeam {
  id?: number | null
  name?: string | null
  acronym?: string | null
  slug?: string | null
  image_url?: string | null
  location?: string | null
}

/** The tournaments lists' extra fields we read for the teams. */
export type RawTournamentWithRosters = RawTournament & {
  expected_roster?: Array<{
    team?: RawRosterTeam | null
    players?: RawRosterPlayer[] | null
  } | null> | null
}

export interface PlayerData {
  pandaId: number
  name: string
  firstName: string | null
  lastName: string | null
  /** Country code. */
  nationality: string | null
  role: string | null
}

export interface TeamData {
  pandaId: number
  game: EsportGame
  name: string
  acronym: string | null
  pandaSlug: string | null
  logoUrl: string | null
  location: string | null
}

export interface LineupData {
  /** `<serie id>:<team id>`: one lineup per team and edition. */
  key: string
  seriePandaId: number
  teamPandaId: number
  game: EsportGame
  /** When the stage it was read from starts (the edition's latest one the team played). */
  beginAt: string | null
  players: PlayerData[]
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Ours, for the URL: the game and the name ("cs2-vitality", "lol-t1"). */
export const teamSlug = (game: EsportGame, name: string): string =>
  `${game}-${slugify(name) || 'team'}`

export function playerOf(p: RawRosterPlayer | null | undefined): PlayerData | null {
  const id = num(p?.id)
  const name = str(p?.name)
  if (id == null || !name) return null
  return {
    pandaId: id,
    name,
    firstName: str(p?.first_name),
    lastName: str(p?.last_name),
    nationality: str(p?.nationality),
    role: str(p?.role),
  }
}

export function teamOf(t: RawRosterTeam | null | undefined, game: EsportGame): TeamData | null {
  const id = num(t?.id)
  const name = str(t?.name)
  if (id == null || !name) return null
  return {
    pandaId: id,
    game,
    name,
    acronym: str(t?.acronym),
    pandaSlug: str(t?.slug),
    logoUrl: str(t?.image_url),
    location: str(t?.location),
  }
}

/**
 * The teams and lineups in a tournaments list, for the editions kept
 * (`series`: S / A / B). A team in several stages of an edition: the lineup
 * of the latest stage. Pure.
 */
export function lineupsOf(
  raws: RawTournamentWithRosters[],
  game: EsportGame,
  series: Set<number>,
): { teams: Map<number, TeamData>; lineups: Map<string, LineupData> } {
  const teams = new Map<number, TeamData>()
  const lineups = new Map<string, LineupData>()
  for (const r of raws) {
    const serie = num(r?.serie?.id)
    if (serie == null || !series.has(serie)) continue
    const at = str(r.begin_at)
    for (const entry of r.expected_roster ?? []) {
      const team = teamOf(entry?.team, game)
      if (!team) continue
      teams.set(team.pandaId, team)
      const players = (entry?.players ?? [])
        .map(playerOf)
        .filter((p): p is PlayerData => p !== null)
      const key = `${serie}:${team.pandaId}`
      const old = lineups.get(key)
      if (old && (old.beginAt ?? '') > (at ?? '')) continue
      if (old && !players.length) continue
      lineups.set(key, {
        key,
        seriePandaId: serie,
        teamPandaId: team.pandaId,
        game,
        beginAt: at,
        players,
      })
    }
  }
  return { teams, lineups }
}

/** A team's best tier over its lineups of the last two years (else all), and its latest date. */
export function teamStanding(
  lineups: Array<{ tier?: Tier | null; beginAt?: string | null }>,
  now = new Date(),
): { tier: Tier; lastAt: string | null } {
  const order: Tier[] = ['s', 'a', 'b', 'c', 'd', 'unranked']
  const since = new Date(now.getTime() - 2 * 365 * 86_400_000).toISOString()
  const recent = lineups.filter((l) => (l.beginAt ?? '') >= since)
  const pool = recent.length ? recent : lineups
  const tier = pool.reduce<Tier>(
    (best, l) =>
      order.indexOf(l.tier ?? 'unranked') < order.indexOf(best) ? (l.tier as Tier) : best,
    'unranked',
  )
  const lastAt = lineups.reduce<string | null>(
    (last, l) => (l.beginAt && (!last || l.beginAt > last) ? l.beginAt : last),
    null,
  )
  return { tier, lastAt }
}

// ─── Finding the teams an article names ──────────────────────────────────────

export interface TeamNames {
  id: number | string
  game: EsportGame
  /** Its name, acronym and aliases, as written ("MOUZ", "Team Vitality", "T1"). */
  names: string[]
}

const PREFIX = /^team\s+/i
const SUFFIX = /\s+(esports?|gaming|club|team|gg)$/i

/**
 * The ways articles write a team: its name, without "Team" or "Esports"
 * ("Team Vitality" → "Vitality", "FURIA Esports" → "FURIA"), in capitals
 * too ("HEROIC"), its acronym when it reads as a name (3 letters or more, or
 * with a digit: "T1", "G2"). Pure.
 */
export function teamNames(name: string, acronym: string | null, aliases: string[] = []): string[] {
  const out = new Set<string>([name, ...aliases])
  const short = name.replace(PREFIX, '').replace(SUFFIX, '').trim()
  if (short.length >= 3) out.add(short)
  // Headlines shout names ("HEROIC", "FNATIC"); PandaScore may write one in lower case ("fnatic").
  for (const n of [...out]) {
    if (n.replace(/[^\p{L}]/gu, '').length >= 4) out.add(n.toUpperCase())
    if (n === n.toLowerCase()) out.add(n.charAt(0).toUpperCase() + n.slice(1))
  }
  if (acronym && (acronym.length >= 3 || (acronym.length >= 2 && /\d/.test(acronym))))
    out.add(acronym)
  return [...out].filter((n) => n.length >= 3 || /\d/.test(n))
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The teams a text names: whole words, case as written (team names are often
 * plain words: "Spirit", "Liquid", "Imperial", only capitalised they're the
 * team). With the article's game, only that game's; without one, a name
 * several teams share counts for none. A name found inside a longer one found
 * ("Fire" in "Eternal Fire") doesn't count. Lines read apart. Pure.
 */
export function detectTeams(
  text: string,
  teams: TeamNames[],
  game: EsportGame | null,
): Array<number | string> {
  const lines = text.split('\n')
  const owners = new Map<string, number>()
  for (const t of teams) for (const n of new Set(t.names)) owners.set(n, (owners.get(n) ?? 0) + 1)
  const hits: Array<{ id: number | string; name: string }> = []
  for (const t of teams) {
    if (game && t.game !== game) continue
    for (const n of new Set(t.names)) {
      if (!game && (owners.get(n) ?? 0) > 1) continue
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(n)}($|[^\\p{L}\\p{N}])`, 'u')
      if (lines.some((l) => re.test(l))) hits.push({ id: t.id, name: n })
    }
  }
  const inLonger = (h: { id: number | string; name: string }) =>
    hits.some(
      (o) =>
        o.id !== h.id &&
        o.name.length > h.name.length &&
        new RegExp(`(^|[^\\p{L}\\p{N}])${escape(h.name)}($|[^\\p{L}\\p{N}])`, 'u').test(o.name),
    )
  return [...new Set(hits.filter((h) => !inLonger(h)).map((h) => h.id))]
}

// ─── Players (2026-11-27, step 3) ────────────────────────────────────────────

/** Ours, for the URL: the nickname ("zywoo"), its PandaScore id appended when taken. */
export const playerSlug = (name: string): string => slugify(name) || 'player'

export interface PlayerNames {
  id: number | string
  game: EsportGame | null
  names: string[]
  /** Its current and last teams (doc ids): a plain-word nickname counts only with one of them. */
  teams: Array<number | string>
}

/**
 * The players a text names: nicknames as written, whole words. A nickname
 * that is a plain lower-case word ("frozen", "device") counts only when the
 * article is about one of the player's teams (`teams`, found first); one
 * with a capital or a digit ("ZywOo", "s1mple", "NiKo") on its own. With the
 * article's game, only that game's players. Pure.
 */
export function detectPlayers(
  text: string,
  players: PlayerNames[],
  game: EsportGame | null,
  teams: Array<number | string>,
): Array<number | string> {
  const lines = text.split('\n')
  const ours = new Set(teams.map(String))
  const found: Array<number | string> = []
  for (const p of players) {
    if (game && p.game && p.game !== game) continue
    const hit = p.names.some((n) => {
      if (n.length < 3 && !/\d/.test(n)) return false
      if (n === n.toLowerCase() && !/\d/.test(n) && !p.teams.some((t) => ours.has(String(t))))
        return false
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(n)}($|[^\\p{L}\\p{N}])`, 'u')
      return lines.some((l) => re.test(l))
    })
    if (hit) found.push(p.id)
  }
  return found
}
