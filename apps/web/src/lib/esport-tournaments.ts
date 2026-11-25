// ─── Esport tournament pages (/esport/tournaments) ───────────────────────────
// A tournament here is one PandaScore stage ("Playoffs", "Stage 1") of an
// event ("PGL Major Singapore 2026"); its sibling stages share a `serieId`.
// The CMS stores each stage's bracket and standings (`structure`, sync.ts).
// Pure: the pages (server) use it, and it is unit-tested.

import { ESPORT_GAMES, TIER_ORDER, type EsportGame, type EsportTeam, type Tier } from './esport'

export interface StageMatch {
  id: number
  name: string
  at: string | null
  status: 'not_started' | 'running' | 'finished' | 'canceled' | 'postponed'
  t1: EsportTeam | null
  t2: EsportTeam | null
  s1: number | null
  s2: number | null
  winner: 1 | 2 | null
  bestOf: number | null
  prev: Array<{ id: number; type: 'winner' | 'loser' }>
}

export interface StageStanding {
  rank: number
  team: EsportTeam
  wins: number
  losses: number
  ties: number
}

export interface EsportStage {
  id: number
  slug: string
  game: EsportGame
  /** The stage: "Playoffs", "Stage 1". */
  name: string
  /** "PGL Major Singapore 2026" (league + season). */
  event: string
  logo: string | null
  tier: Tier
  beginAt: string | null
  endAt: string | null
  serieId: number | null
  hasBracket: boolean
  /** Null in lists (not fetched), or before the sync read it. */
  structure: { matches: StageMatch[]; standings: StageStanding[] } | null
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** A raw `esport-tournaments` doc → a stage. Null without a slug (not linkable). */
export function stageOf(doc: Record<string, unknown>): EsportStage | null {
  const game = doc.game as EsportGame
  const slug = text(doc.slug)
  const id = num(doc.pandaId)
  if (!ESPORT_GAMES.includes(game) || !slug || id === null) return null
  const league = text(doc.league)
  const serie = text(doc.serie)
  const raw = doc.structure && typeof doc.structure === 'object' ? (doc.structure as Record<string, unknown>) : null
  return {
    id,
    slug,
    game,
    name: text(doc.name) || 'Tournament',
    event:
      serie && league && !serie.toLowerCase().startsWith(league.toLowerCase()) ? `${league} ${serie}` : serie || league,
    logo: text(doc.leagueLogoUrl) || null,
    tier: (TIER_ORDER as readonly string[]).includes(doc.tier as string) ? (doc.tier as Tier) : 'unranked',
    beginAt: text(doc.beginAt) || null,
    endAt: text(doc.endAt) || null,
    serieId: num(doc.serieId),
    hasBracket: doc.hasBracket === true,
    structure: raw
      ? {
          matches: Array.isArray(raw.matches) ? (raw.matches as StageMatch[]) : [],
          standings: Array.isArray(raw.standings) ? (raw.standings as StageStanding[]) : [],
        }
      : null,
  }
}

/** "Quarterfinal 2: SIN vs MZP" → "Quarterfinal"; "Round of 16 match 3: …" → "Round of 16"; "Round 3: …" stays "Round 3". */
export function roundLabel(matchName: string): string {
  const head = matchName.split(':')[0].trim()
  const noMatch = head.replace(/\s+match\s+\d+$/i, '')
  // "Round 3" (Swiss) and "Round of 16" keep their number.
  if (/^round\s+\d+$/i.test(noMatch) || /round of \d+$/i.test(noMatch)) return noMatch
  return noMatch.replace(/\s+\d+$/, '') || head
}

const FR_ROUNDS: Array<[RegExp, string]> = [
  [/^grand final$/i, 'Grande finale'],
  [/^final$/i, 'Finale'],
  [/^semifinals?$/i, 'Demi-finales'],
  [/^quarterfinals?$/i, 'Quarts de finale'],
  [/^round of 16$/i, 'Huitièmes de finale'],
  [/^round of 32$/i, 'Seizièmes de finale'],
  [/^(third|3rd) place( match| decider)?$/i, 'Petite finale'],
  [/^round (\d+)$/i, 'Ronde $1'],
]

/** A round's label in the page's language (PandaScore names them in English). */
export function roundName(label: string, locale: string): string {
  if (locale !== 'fr') return label
  const m = label.match(/^(upper|lower) bracket\s+(.+)$/i)
  if (m) return `${roundName(m[2], locale)} (${m[1].toLowerCase() === 'upper' ? 'winner' : 'loser'} bracket)`
  for (const [re, fr] of FR_ROUNDS) if (re.test(label)) return label.replace(re, fr)
  return label
}

export type SectionKey = 'main' | 'upper' | 'lower' | 'final'

export interface BracketColumn {
  label: string
  matches: StageMatch[]
}

export interface BracketSection {
  key: SectionKey
  columns: BracketColumn[]
}

const numberIn = (name: string) => Number(name.split(':')[0].match(/(\d+)\s*$/)?.[1] ?? 0)

function mostCommon(labels: string[]): string {
  const count = new Map<string, number>()
  for (const l of labels) count.set(l, (count.get(l) ?? 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
}

/**
 * The matches as columns, left to right. With `prev` links (a bracket): a
 * column per depth in the tree, the upper and lower brackets apart, and each
 * column ordered from the final backwards so a match sits level with the two
 * it comes from. Without (Swiss, groups): a column per round name, in time order.
 */
export function bracketLayout(matches: StageMatch[]): BracketSection[] {
  if (!matches.length) return []
  const linked = matches.some((m) => m.prev.length > 0)
  if (!linked) {
    const columns = new Map<string, StageMatch[]>()
    for (const m of [...matches].sort((a, b) => (a.at ?? '9999').localeCompare(b.at ?? '9999'))) {
      const label = roundLabel(m.name)
      columns.set(label, [...(columns.get(label) ?? []), m])
    }
    return [{ key: 'main', columns: [...columns.entries()].map(([label, ms]) => ({ label, matches: ms })) }]
  }

  const hasLower = matches.some((m) => /lower/i.test(m.name))
  const sectionOf = (m: StageMatch): SectionKey =>
    !hasLower ? 'main' : /lower/i.test(m.name) ? 'lower' : /grand final/i.test(m.name) ? 'final' : 'upper'
  const byId = new Map(matches.map((m) => [m.id, m]))
  const depth = new Map<number, number>()
  const depthOf = (m: StageMatch, seen = new Set<number>()): number => {
    const known = depth.get(m.id)
    if (known !== undefined) return known
    seen.add(m.id)
    let d = 0
    for (const p of m.prev) {
      const pm = byId.get(p.id)
      if (pm && !seen.has(pm.id) && sectionOf(pm) === sectionOf(m)) d = Math.max(d, depthOf(pm, seen) + 1)
    }
    depth.set(m.id, d)
    return d
  }

  const order: SectionKey[] = hasLower ? ['upper', 'lower', 'final'] : ['main']
  return order
    .map((key) => {
      const ms = matches.filter((m) => sectionOf(m) === key)
      const max = Math.max(-1, ...ms.map((m) => depthOf(m)))
      const cols: StageMatch[][] = Array.from({ length: max + 1 }, () => [])
      for (const m of ms) cols[depthOf(m)].push(m)
      // Last column by its numbers, then each column after the one to its right.
      for (let c = cols.length - 1; c >= 0; c--) {
        if (c === cols.length - 1) {
          cols[c].sort((a, b) => numberIn(a.name) - numberIn(b.name) || (a.at ?? '').localeCompare(b.at ?? ''))
          continue
        }
        const rank = new Map<number, number>()
        cols[c + 1].forEach((next, i) => next.prev.forEach((p, j) => rank.set(p.id, i * 2 + j)))
        cols[c].sort(
          (a, b) =>
            (rank.get(a.id) ?? 1e6 + numberIn(a.name)) - (rank.get(b.id) ?? 1e6 + numberIn(b.name)),
        )
      }
      return {
        key,
        columns: cols
          .filter((c) => c.length)
          .map((c) => ({ label: mostCommon(c.map((m) => roundLabel(m.name))), matches: c })),
      }
    })
    .filter((s) => s.columns.length > 0)
}

/** Big events first (S, A, B), then the most recent. */
export function sortStages(stages: EsportStage[]): EsportStage[] {
  return [...stages].sort(
    (a, b) =>
      TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || (b.beginAt ?? '').localeCompare(a.beginAt ?? ''),
  )
}

export interface EventGroup {
  key: string
  event: string
  game: EsportGame
  tier: Tier
  logo: string | null
  beginAt: string | null
  endAt: string | null
  stages: EsportStage[]
}

/** Stages grouped by event (same season), stages in time order, events by tier then date. */
export function groupEvents(stages: EsportStage[]): EventGroup[] {
  const groups = new Map<string, EventGroup>()
  for (const s of stages) {
    const key = s.serieId !== null ? `serie-${s.serieId}` : `${s.game}|${s.event}`
    const g = groups.get(key)
    if (!g) {
      groups.set(key, { key, event: s.event, game: s.game, tier: s.tier, logo: s.logo, beginAt: s.beginAt, endAt: s.endAt, stages: [s] })
      continue
    }
    g.stages.push(s)
    if (TIER_ORDER.indexOf(s.tier) < TIER_ORDER.indexOf(g.tier)) g.tier = s.tier
    if (s.beginAt && (!g.beginAt || s.beginAt < g.beginAt)) g.beginAt = s.beginAt
    if (s.endAt && (!g.endAt || s.endAt > g.endAt)) g.endAt = s.endAt
  }
  for (const g of groups.values()) g.stages.sort((a, b) => (a.beginAt ?? '').localeCompare(b.beginAt ?? ''))
  return [...groups.values()].sort(
    (a, b) =>
      TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || (b.beginAt ?? '').localeCompare(a.beginAt ?? ''),
  )
}

/**
 * "qualified" / "eliminated" in a stage whose rule we know for sure: the CS2
 * Major stages are Swiss, 3 wins qualify, 3 losses eliminate. Else null.
 */
export function swissVerdict(
  stage: Pick<EsportStage, 'game' | 'event' | 'name'>,
  row: Pick<StageStanding, 'wins' | 'losses'>,
): 'qualified' | 'eliminated' | null {
  if (stage.game !== 'cs2' || !/major/i.test(stage.event) || !/stage\s*[123]\b/i.test(stage.name)) return null
  return row.wins >= 3 ? 'qualified' : row.losses >= 3 ? 'eliminated' : null
}
