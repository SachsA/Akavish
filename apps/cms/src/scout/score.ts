// ─── Story score ─────────────────────────────────────────────────────────────
// Pure: decides which stories matter (design doc: "Score"). Out of 100:
//
//   significance  0–60  how big the news is on its own (the model's estimate
//                       0–100 × 0.6): a GTA trailer vs a small patch
//   sources       0–24  independent outlets reporting it (+8 each after the
//                       first, capped at 4 outlets): one rumour vs everyone
//                       covering it
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

export interface ScoreInput {
  /** The model's estimate, 0–100. */
  significance: number
  /** Distinct sources among the story's items. */
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
  const sig = Math.max(0, Math.min(100, significance)) * 0.6
  const sources = Math.min(24, Math.max(0, sourceCount - 1) * 8)
  const reliability = RELIABILITY_POINTS[bestReliability] ?? 0
  const freshness = ageHours > 72 ? -30 : ageHours > 24 ? -10 : 0
  return Math.round(Math.max(0, Math.min(100, sig + sources + reliability + freshness)))
}

/** The most trustworthy of a story's sources. */
export function bestOf(reliabilities: Reliability[]): Reliability {
  return reliabilities.reduce<Reliability>(
    (best, r) => (RANK[r] < RANK[best] ? r : best),
    'variable',
  )
}
