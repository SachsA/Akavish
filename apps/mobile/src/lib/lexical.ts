// ─── Lexical parsing ─────────────────────────────────────────────────────────
// Payload stores article bodies as Lexical JSON; `mapArticle` keeps it as a
// string. This parses it once for the renderer (components/LexicalContent.tsx).

export interface LexicalNode {
  type: string
  tag?: string
  format?: number | string
  text?: string
  url?: string
  fields?: { url?: string; newTab?: boolean }
  listType?: 'bullet' | 'number' | 'check'
  children?: LexicalNode[]
}

// Bitmask flags Lexical uses for inline text formatting (same as the web).
export const IS_BOLD = 1
export const IS_ITALIC = 1 << 1
export const IS_STRIKETHROUGH = 1 << 2
export const IS_UNDERLINE = 1 << 3
export const IS_CODE = 1 << 4

/** Top-level blocks of the article body, or `[]` when it's empty or unparseable. */
export function parseLexical(content: string | undefined): LexicalNode[] {
  if (!content) return []
  try {
    const parsed = JSON.parse(content)
    const root = parsed?.root ?? parsed
    return Array.isArray(root?.children) ? root.children : []
  } catch {
    return []
  }
}

/** Link target of a link node; `undefined` for anything that isn't http(s) or mailto. */
export function linkTarget(node: LexicalNode): string | undefined {
  const url = node.fields?.url ?? node.url
  if (!url) return undefined
  // Editors type these URLs in the CMS. The app only opens web and mail links:
  // a relative or javascript: URL has nothing sensible to open on a phone.
  return /^(https?:|mailto:)/i.test(url) ? url : undefined
}
