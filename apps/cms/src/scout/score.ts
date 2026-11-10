// ─── Story score ─────────────────────────────────────────────────────────────
// Pure: decides which stories matter (design doc: "Score"). Out of 100:
//
//   significance  0–50  how big the news is on its own (the model's estimate
//                       0–100, halved): a GTA trailer vs a small patch
//   sources       0–30  independent outlets reporting it (+7.5 each after the
//                       first, capped): one rumour vs everyone covering it
//   reliability   0–20  best source: official 20, established outlet 10,
//                       leaker/unknown 0
//   freshness     0 to −30  older than a day −10, three days −30
//
// So an official announcement of a big game (sig 90 → 45, official 20, a few
// outlets 15–30) lands at 80–95, a single leaker's claim about a big game
// (45 + 0 + 0) stays around 45 until others pick it up. The draft threshold
// (60 by default) sits between the two. Tuned with real traffic in step 1.

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

const RELIABILITY_POINTS: Record<Reliability, number> = { official: 20, high: 10, variable: 0 }
const RANK: Record<Reliability, number> = { official: 0, high: 1, variable: 2 }

export function scoreStory({
  significance,
  sourceCount,
  bestReliability,
  ageHours,
}: ScoreInput): number {
  const sig = Math.max(0, Math.min(100, significance)) / 2
  const sources = Math.min(30, Math.max(0, sourceCount - 1) * 7.5)
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
