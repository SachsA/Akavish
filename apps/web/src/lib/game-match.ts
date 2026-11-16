// ─── Finding games by name ───────────────────────────────────────────────────
// The search shows the games first ("GTA" → GTA VI, GTA V, GTA IV…), then the
// articles. The CMS's `like` can't do that: nobody types "Grand Theft Auto",
// so this matches in memory against the whole games list (a few hundred):
//   - the name, its start or any word's start ("drift" → Neon Drift);
//   - initials ("gta" → Grand Theft Auto, "lol" → League of Legends,
//     "botw" → … Breath of the Wild), numbers included ("gta 6", "gta6",
//     "cs2", "rdr2": roman numerals in names count as numbers).
// Pure.

export interface MatchableGame {
  name: string
  releaseDate?: string | null
}

const ROMAN: Record<string, number> = { i: 1, v: 5, x: 10 }

/** "vi" → 6, "xiii" → 13; null when it isn't a roman numeral. */
function fromRoman(word: string): number | null {
  if (!/^(x{0,3})(ix|iv|v?i{0,3})$/.test(word) || word === '') return null
  let total = 0
  for (let i = 0; i < word.length; i++) {
    const cur = ROMAN[word[i]]
    const next = ROMAN[word[i + 1]] ?? 0
    total += cur < next ? -cur : cur
  }
  return total
}

/** Lower case, no accents, words and numbers apart ("GTA6" → ["gta", "6"]). */
export function tokens(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/** A game name's tokens, roman numerals turned into numbers (single "i" stays a word). */
function nameTokens(name: string): string[] {
  return tokens(name).map((w) => {
    const n = w.length > 1 || w === 'v' || w === 'x' ? fromRoman(w) : null
    return n === null ? w : String(n)
  })
}

/** How well a game matches the query, 0 when it doesn't. */
export function gameScore(name: string, query: string): number {
  const q = tokens(query)
  if (q.length === 0) return 0
  const words = nameTokens(name)
  const plain = words.join(' ')
  const qPlain = q.join(' ')

  // Initials: the letters of the words (numbers left out), then the numbers.
  const initials = words
    .filter((w) => !/^\d+$/.test(w))
    .map((w) => w[0])
    .join('')
  const numbers = words.filter((w) => /^\d+$/.test(w))
  const [head, ...rest] = q
  // "gta 6", "gta vi": a number after the initials, in digits or roman.
  const asNumber = (t: string) =>
    /^\d+$/.test(t) ? t : fromRoman(t) !== null ? String(fromRoman(t)) : null
  const restMatches = rest.every((t) => {
    const n = asNumber(t)
    return (n !== null && numbers.includes(n)) || words.some((w) => w.startsWith(t))
  })
  let byInitials = 0
  if (head.length >= 2 && !/^\d+$/.test(head) && restMatches) {
    // A short query is more likely an acronym ("cod", "re") than the start of
    // a name ("Code Vein", "Returnal").
    if (initials.startsWith(head)) byInitials = head.length <= 4 ? 95 : 70
    else if (head.length >= 3 && initials.includes(head)) byInitials = 50
  }

  let byName = 0
  if (plain === qPlain) byName = 100
  else if (plain.startsWith(qPlain)) byName = 90
  else if (q.every((t) => words.some((w) => w.startsWith(t))))
    byName = 75 - Math.min(words.findIndex((w) => w.startsWith(q[0])), 10)
  return Math.max(byName, byInitials)
}

/**
 * The games matching the query, best first; ties: the newest release first
 * (GTA VI before GTA V), then by name.
 */
export function matchGames<T extends MatchableGame>(games: T[], query: string, limit = 12): T[] {
  return games
    .map((g) => ({ g, score: gameScore(g.name, query) }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (Date.parse(b.g.releaseDate ?? '') || 0) - (Date.parse(a.g.releaseDate ?? '') || 0) ||
        a.g.name.localeCompare(b.g.name),
    )
    .slice(0, limit)
    .map((x) => x.g)
}
