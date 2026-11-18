// ─── Finding consoles and studios by name ────────────────────────────────────
// The search suggests the console and company pages too ("ps5" → PlayStation
// 5, "switch" → Switch 2 and Switch, "rockstar" → Rockstar Games): a name, a
// short name or an alias that equals the query, starts with it, or has a word
// starting with it. Exact matches first. Pure.

import { tokens } from './game-match'

export interface MatchableEntity {
  /** Every name it goes by: name, short name, slug, aliases. */
  names: string[]
}

function score(names: string[], q: string[]): number {
  let best = 0
  for (const name of names) {
    const t = tokens(name)
    if (!t.length) continue
    const joined = t.join(' ')
    const query = q.join(' ')
    if (joined === query || t.join('') === q.join('')) return 3
    if (joined.startsWith(query) || t.join('').startsWith(q.join(''))) best = Math.max(best, 2)
    else if (q.length === 1 && q[0].length >= 3 && t.some((w) => w.startsWith(q[0]))) best = Math.max(best, 1)
  }
  return best
}

/** The entities the query names, best first (at most `limit`). */
export function matchEntities<T extends MatchableEntity>(items: T[], query: string, limit = 3): T[] {
  const q = tokens(query)
  if (!q.length || q.join('').length < 2) return []
  return items
    .map((item, i) => ({ item, i, s: score(item.names, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.item)
}
