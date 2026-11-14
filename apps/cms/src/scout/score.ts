// ─── Story score ─────────────────────────────────────────────────────────────
// Pure: decides which stories matter (design doc: "Score"). Out of 100:
//
//   significance  0–60  how big the news is on its own (the model's estimate
//                       0–100 × 0.6): a GTA trailer vs a small patch
//   sources       0–24  independent outlets reporting it (+8 each after the
//                       first, capped at 4 more), news of significance 40+
//                       only (see V3 below)
//   reliability   0–25  best source: official 25, established outlet 15,
//                       leaker/unknown 0
//   freshness     0 to −30  older than a day −10, three days −30
//
// Retuned on 2026-11-12 from the editor's first review: the old weights
// (significance halved, +7.5 per outlet, official 20 / outlet 10) kept good
// single-source news under 50 (an official CS2 update, a star player's
// transfer on VLR.gg, a Sensor Tower figure on GTA VI), because our 38 feeds
// rarely carry the same news more than once or twice. Now an official post
// about a focus game (sig 65 → 39 + 25) or a big story from one established
// outlet (sig 75 → 45 + 15) reaches the 60 threshold on its own, while a lone
// leaker (sig 80 → 48 + 0) still waits for confirmation from others.
//
// Retuned again on 2026-11-13 (+5 → +8 per outlet, cap 20 → 24): regular news
// carried by 3 to 5 outlets sat at 55-57 all day (an Xbox outage, Disney+ and
// The Game Awards, a GTA VI series teaser, Xbox Playback) and was never
// drafted. Several outlets agreeing is the strongest signal we have: regular
// news (sig 50) from an established outlet now reaches 60 with 3 outlets.

import type { Reliability } from './default-sources'

// Retuned a third time on 2026-11-14 from a backtest on the week's 1,175
// stories and the editor's decisions ("V3"):
//  - outlets, not feeds: IGN France counts with IGN. (Counting the sites
//    devoted to one platform, Push Square, Pure Xbox, Nintendo Life, as half
//    was tried and dropped: it cost two drafts the editor liked, the Game
//    Awards nominees date and a Blood of Dawnwalker update, and the
//    significance rule below already stops the press-release noise);
//  - the outlet bonus only for news of significance 40 or more: minor news
//    widely relayed (a CEO's private life, Steam Deck graphs, NBA 2K27 sales)
//    passed on the number of sites alone;
//  - esport: one feed per scene (HLTV for CS2, VLR.gg for Valorant), so an
//    esport story almost never has two sources. Those two count as official
//    for an esport story, and esport drafts from 10 points lower
//    (ESPORT_THRESHOLD_OFFSET): the week's best esport news (TenZ back with
//    T1, Fluxo pausing its CS team, MOUZ world No. 1) all sat at 45-48.

export const OUTLET_GROUPS: Record<string, string> = { 'IGN France': 'IGN' }
export const SCENE_SOURCES = new Set(['HLTV', 'VLR.gg'])
export const SOURCE_BONUS_MIN_SIGNIFICANCE = 40
export const ESPORT_THRESHOLD_OFFSET = 10

export interface ScoreInput {
  /** The model's estimate, 0–100. */
  significance: number
  /** Distinct outlets among the story's items (see outletWeight). */
  sourceCount: number
  bestReliability: Reliability
  /** Age of the story's first item, in hours. */
  ageHours: number
}

const RELIABILITY_POINTS: Record<Reliability, number> = { official: 25, high: 15, variable: 0 }
const RANK: Record<Reliability, number> = { official: 0, high: 1, variable: 2 }

export function scoreStory({
  significance,
  sourceCount,
  bestReliability,
  ageHours,
}: ScoreInput): number {
  const sig = Math.max(0, Math.min(100, significance))
  const sources =
    sig >= SOURCE_BONUS_MIN_SIGNIFICANCE ? Math.min(24, Math.max(0, (sourceCount - 1) * 8)) : 0
  const reliability = RELIABILITY_POINTS[bestReliability] ?? 0
  const freshness = ageHours > 72 ? -30 : ageHours > 24 ? -10 : 0
  return Math.round(Math.max(0, Math.min(100, sig * 0.6 + sources + reliability + freshness)))
}

/** The most trustworthy of a story's sources. */
export function bestOf(reliabilities: Reliability[]): Reliability {
  return reliabilities.reduce<Reliability>(
    (best, r) => (RANK[r] < RANK[best] ? r : best),
    'variable',
  )
}

/** How many outlets a story really has: feeds of the same group count once. */
export function outletWeight(names: string[]): number {
  return new Set(names.map((name) => OUTLET_GROUPS[name] ?? name)).size
}

export interface SourceRef {
  name: string
  reliability: Reliability
}

/** The reliability that counts: a scene's own site is official for its esport news. */
export function effectiveReliability(category: string | null | undefined, sources: SourceRef[]): Reliability {
  if (category === 'esport' && sources.some((s) => SCENE_SOURCES.has(s.name))) return 'official'
  return bestOf(sources.map((s) => s.reliability))
}

/** A story's score from its sources (deduplicated by name here). */
export function storyScore(input: {
  significance: number
  category: string | null | undefined
  sources: SourceRef[]
  ageHours: number
}): number {
  const unique = [...new Map(input.sources.map((s) => [s.name, s])).values()]
  return scoreStory({
    significance: input.significance,
    sourceCount: outletWeight(unique.map((s) => s.name)),
    bestReliability: effectiveReliability(input.category, unique),
    ageHours: input.ageHours,
  })
}

/** The score a story needs for an automatic draft: esport from 10 points lower. */
export function thresholdFor(category: string | null | undefined, threshold: number): number {
  return category === 'esport' ? threshold - ESPORT_THRESHOLD_OFFSET : threshold
}
