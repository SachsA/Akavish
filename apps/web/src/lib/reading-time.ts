// ─── Reading time ────────────────────────────────────────────────────────────
// Estimates how long an article takes to read, from Payload's Lexical JSON.

/** Average adult reading speed for online prose, in words per minute. */
const WORDS_PER_MINUTE = 220

interface LexicalNodeLike {
  text?: string
  children?: LexicalNodeLike[]
}

/**
 * Collect the plain text of a Lexical tree by walking every node's `text` and
 * recursing into `children`. Node-type agnostic on purpose: it doesn't need to
 * know about headings, lists or quotes, so new node types can't silently break
 * the count (unlike `LexicalContent`, which renders and therefore must).
 */
function extractText(node: LexicalNodeLike): string {
  const own = typeof node.text === 'string' ? node.text : ''
  if (!node.children?.length) return own
  return [own, ...node.children.map(extractText)].join(' ')
}

/** Count words in the serialised Lexical content. Returns 0 on unparseable input. */
export function countWords(content: string): number {
  let root: LexicalNodeLike | null = null
  try {
    const parsed = JSON.parse(content)
    root = parsed?.root ?? parsed ?? null
  } catch {
    return 0
  }
  if (!root) return 0

  const words = extractText(root).trim().split(/\s+/).filter(Boolean)
  return words.length
}

/**
 * Reading time in whole minutes, floored at 1 — "0 min read" reads like a bug,
 * and a one-line article still costs the reader a beat.
 */
export function readingTimeMinutes(content: string): number {
  const words = countWords(content)
  if (words === 0) return 0
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE))
}

/** Byline-ready label, e.g. "4 min read". Empty string when there's no content. */
export function readingTimeLabel(content: string): string {
  const minutes = readingTimeMinutes(content)
  return minutes > 0 ? `${minutes} min read` : ''
}
