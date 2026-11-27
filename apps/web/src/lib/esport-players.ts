// ─── Esport player pages (2026-11-27, step 3) ────────────────────────────────
// /esport/players/<slug> ("zywoo"): nickname, real name, country, role, team
// now, career (team by team, from the lineups), titles, every competition
// played, news. No photo. Data: the CMS's PandaScore sync (esport-players,
// esport-lineups). Pure: mapping, career, titles. Tested.

import { ESPORT_GAMES, type EsportGame } from './esport'
import { teamOf as teamRefOf, type CompetitionTeam } from './esport-competitions'
import type { Lineup } from './esport-teams'

export interface Player {
  id: string
  pandaId: number
  slug: string
  name: string
  firstName: string | null
  lastName: string | null
  nationality: string | null
  role: string | null
  game: EsportGame | null
  /** In its current roster (PandaScore). */
  currentTeam: CompetitionTeam | null
  /** The team of its latest lineup. */
  lastTeam: CompetitionTeam | null
  lastAt: string | null
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** A CMS esport-players doc (teams populated) → Player. */
export function playerOf(doc: Record<string, unknown>): Player | null {
  const pandaId = typeof doc.pandaId === 'number' ? doc.pandaId : null
  const slug = str(doc.slug)
  const name = str(doc.name)
  if (pandaId == null || !slug || !name || doc.id == null) return null
  return {
    id: String(doc.id),
    pandaId,
    slug,
    name,
    firstName: str(doc.firstName),
    lastName: str(doc.lastName),
    nationality: str(doc.nationality),
    role: str(doc.role),
    game: ESPORT_GAMES.includes(doc.game as EsportGame) ? (doc.game as EsportGame) : null,
    currentTeam: teamRefOf(doc.currentTeam),
    lastTeam: teamRefOf(doc.lastTeam),
    lastAt: str(doc.lastAt),
  }
}

export interface CareerStint {
  team: CompetitionTeam
  from: string | null
  to: string | null
  editions: number
}

/**
 * Its team: the current roster's (PandaScore), else the team of its latest
 * lineup if that's within a year (rosters are read every few days only).
 * `current`: from the roster. Pure.
 */
export function teamNow(p: Player, now = new Date()): { team: CompetitionTeam; current: boolean } | null {
  if (p.currentTeam) return { team: p.currentTeam, current: true }
  if (p.lastTeam && p.lastAt && now.getTime() - Date.parse(p.lastAt) < 365 * 86_400_000)
    return { team: p.lastTeam, current: false }
  return null
}

/** Team by team, latest first: consecutive lineups with the same team make one stint. Pure. */
export function career(lineups: Lineup[]): CareerStint[] {
  const sorted = lineups
    .filter((l) => l.team)
    .sort((a, b) => (a.edition.beginAt ?? '').localeCompare(b.edition.beginAt ?? ''))
  const out: CareerStint[] = []
  for (const l of sorted) {
    const last = out[out.length - 1]
    const same = last && (last.team.pandaId ?? last.team.name) === (l.team!.pandaId ?? l.team!.name)
    if (same) {
      last.to = l.edition.beginAt
      last.editions++
    } else out.push({ team: l.team!, from: l.edition.beginAt, to: l.edition.beginAt, editions: 1 })
  }
  return out.reverse()
}

/** The editions it won: its team that edition is the winner. Latest first. Pure. */
export function playerTitles(lineups: Lineup[]): Lineup[] {
  return lineups
    .filter(
      (l) =>
        l.team?.pandaId != null && l.edition.winner?.pandaId != null && l.team.pandaId === l.edition.winner.pandaId
    )
    .sort((a, b) => (b.edition.beginAt ?? '').localeCompare(a.edition.beginAt ?? ''))
}
