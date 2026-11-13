// Pure helpers for site search, shared by the /api/search route, the /search
// page and the header suggestions. No server-only imports: this file ships to
// the browser.

import { CATEGORIES } from './categories'

export const SEARCH_PAGE_SIZE = 20
/** Below this, the header doesn't suggest anything (one letter matches everything). */
export const SUGGEST_MIN_CHARS = 2

export interface SearchQuery {
  q: string
  /** CMS category value (`review`). Unknown values are dropped. */
  category?: string
  /** Game slug. */
  game?: string
  page: number
}

const CATEGORY_VALUES = new Set<string>(CATEGORIES.map((c) => c.value))
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Read a search from URL params, ignoring anything malformed rather than failing. */
export function parseSearchQuery(params: URLSearchParams): SearchQuery {
  const q = (params.get('q') ?? '').trim().slice(0, 100)
  const category = params.get('category') ?? undefined
  const game = params.get('game') ?? undefined
  const page = Number(params.get('page') ?? 1)
  return {
    q,
    category: category && CATEGORY_VALUES.has(category) ? category : undefined,
    game: game && SLUG.test(game) ? game : undefined,
    page: Number.isInteger(page) && page >= 1 && page <= 500 ? page : 1,
  }
}

/** `/search?q=…&category=…&game=…&page=…`, leaving out what's unset (and page 1). */
export function searchHref({ q, category, game, page = 1 }: Partial<SearchQuery>): string {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (category) params.set('category', category)
  if (game) params.set('game', game)
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `/search?${qs}` : '/search'
}

export interface Segment {
  text: string
  match: boolean
}

/**
 * Split `text` into plain and matching pieces for each word of `query`,
 * case-insensitively, so the UI can wrap the matches in <mark>. Longer words
 * win where two overlap ("gear" inside "gears").
 */
export function highlight(text: string, query: string): Segment[] {
  const words = [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))].sort(
    (a, b) => b.length - a.length
  )
  if (!text || words.length === 0) return text ? [{ text, match: false }] : []
  const pattern = new RegExp(`(${words.map(escapeRegExp).join('|')})`, 'gi')
  return text
    .split(pattern)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, match: words.includes(part.toLowerCase()) }))
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
