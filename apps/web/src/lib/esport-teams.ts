// ─── Esport team pages (2026-11-27, step 2) ──────────────────────────────────
// /esport/teams/<slug> ("cs2-vitality"): the current roster, the next matches
// and last results, the titles, every edition played with its lineup, the
// roster changes, the news. Data: the CMS's PandaScore sync (esport-teams,
// esport-lineups, esport-series, esport-matches). Pure: mapping, roster
// history, the names a team goes by (for the links in articles). Tested.

import { ESPORT_GAMES, type EsportGame, type Tier } from './esport'
import { editionOf, teamOf as teamRefOf, type CompetitionTeam, type Edition } from './esport-competitions'

const TIERS: Tier[] = ['s', 'a', 'b', 'c', 'd', 'unranked']

export interface TeamPlayer {
  pandaId: number
  name: string
  firstName: string | null
  lastName: string | null
  nationality: string | null
  role: string | null
}

export interface Team {
  id: string
  pandaId: number
  slug: string
  game: EsportGame
  name: string
  acronym: string | null
  logo: string | null
  location: string | null
  tier: Tier
  lastAt: string | null
  /** The current roster (PandaScore's), empty until read. */
  players: TeamPlayer[]
}

export interface Lineup {
  /** The edition it played, with its competition. */
  edition: Edition
  players: TeamPlayer[]
  /** The team (when read with it: a player's lineups). */
  team: CompetitionTeam | null
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function playersOf(v: unknown): TeamPlayer[] {
  if (!Array.isArray(v)) return []
  return v.flatMap((p): TeamPlayer[] => {
    const id = num(p?.pandaId)
    const name = str(p?.name)
    return id == null || !name
      ? []
      : [
          {
            pandaId: id,
            name,
            firstName: str(p.firstName),
            lastName: str(p.lastName),
            nationality: str(p.nationality),
            role: str(p.role),
          },
        ]
  })
}

/** A CMS esport-teams doc → Team (null when unusable). */
export function teamOf(doc: Record<string, unknown>): Team | null {
  const game = ESPORT_GAMES.includes(doc.game as EsportGame) ? (doc.game as EsportGame) : null
  const pandaId = num(doc.pandaId)
  const slug = str(doc.slug)
  const name = str(doc.name)
  if (!game || pandaId == null || !slug || !name || doc.id == null) return null
  return {
    id: String(doc.id),
    pandaId,
    slug,
    game,
    name,
    acronym: str(doc.acronym),
    logo: str(doc.logoUrl),
    location: str(doc.location),
    tier: TIERS.includes(doc.tier as Tier) ? (doc.tier as Tier) : 'unranked',
    lastAt: str(doc.lastAt),
    players: playersOf(doc.players),
  }
}

/** A CMS esport-lineups doc (its series populated, with its league) → Lineup. */
export function lineupOf(doc: Record<string, unknown>): Lineup | null {
  const series = doc.series && typeof doc.series === 'object' ? editionOf(doc.series as Record<string, unknown>) : null
  if (!series) return null
  return { edition: series, players: playersOf(doc.players), team: teamRefOf(doc.team) }
}

export interface RosterPeriod {
  players: TeamPlayer[]
  /** First and last edition start with this five (or six). */
  from: string | null
  to: string | null
  editions: number
}

/**
 * The roster changes, latest first: consecutive editions with the same
 * players make one period. Order of names doesn't count. Pure.
 */
export function rosterHistory(lineups: Lineup[]): RosterPeriod[] {
  const sorted = lineups
    .filter((l) => l.players.length)
    .sort((a, b) => (a.edition.beginAt ?? '').localeCompare(b.edition.beginAt ?? ''))
  const keyOf = (ps: TeamPlayer[]) =>
    ps
      .map((p) => p.pandaId)
      .sort((a, b) => a - b)
      .join(',')
  const out: RosterPeriod[] = []
  for (const l of sorted) {
    const last = out[out.length - 1]
    if (last && keyOf(last.players) === keyOf(l.players)) {
      last.to = l.edition.beginAt
      last.editions++
    } else {
      out.push({ players: l.players, from: l.edition.beginAt, to: l.edition.beginAt, editions: 1 })
    }
  }
  return out.reverse()
}

/** Who joined and who left between two periods (the newer first). */
export function rosterMoves(newer: RosterPeriod, older: RosterPeriod) {
  const had = new Set(older.players.map((p) => p.pandaId))
  const has = new Set(newer.players.map((p) => p.pandaId))
  return {
    joined: newer.players.filter((p) => !had.has(p.pandaId)),
    left: older.players.filter((p) => !has.has(p.pandaId)),
  }
}

// ─── Links in article texts ──────────────────────────────────────────────────

const PREFIX = /^team\s+/i
const SUFFIX = /\s+(esports?|gaming|club|team|gg)$/i

/**
 * The ways a text writes a team (same rule as the CMS's teamNames: name, name
 * without "Team" / "Esports", in capitals, its acronym when it reads as a
 * name). Pure.
 */
export function teamNames(name: string, acronym: string | null, aliases: string[] = []): string[] {
  const out = new Set<string>([name, ...aliases])
  const short = name.replace(PREFIX, '').replace(SUFFIX, '').trim()
  if (short.length >= 3) out.add(short)
  for (const n of [...out]) {
    if (n.replace(/[^\p{L}]/gu, '').length >= 4) out.add(n.toUpperCase())
    if (n === n.toLowerCase()) out.add(n.charAt(0).toUpperCase() + n.slice(1))
  }
  if (acronym && (acronym.length >= 3 || (acronym.length >= 2 && /\d/.test(acronym)))) out.add(acronym)
  return [...out].filter((n) => n.length >= 3 || /\d/.test(n))
}
