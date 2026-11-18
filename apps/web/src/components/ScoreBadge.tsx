// A review's score in a coloured pill (lib/score.ts): gold for 10, green 7 to
// 9, yellow 5 to 6, red below. Server-safe; used on cards and the review.

import { formatScore, scoreColors } from '@/lib/score'

export function ScoreBadge({ score, size = 'sm' }: { score: number; size?: 'sm' | 'lg' }) {
  const c = scoreColors(score)
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold tabular-nums leading-none shadow-sm ${
        size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-xs'
      }`}
      style={{ backgroundImage: `linear-gradient(135deg, ${c.from}, ${c.to})`, color: c.text }}
    >
      {formatScore(score)}/10
    </span>
  )
}
