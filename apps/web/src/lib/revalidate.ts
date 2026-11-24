// ─── On-demand revalidation ──────────────────────────────────────────────────
// Pages and CMS reads are cached (ISR). The CMS pings /api/revalidate after
// every public change with the cache tags of what changed (an article, its
// game, its tags…): only those drop, so a translation or a scout update
// doesn't rebuild the 1,600 other pages (2026-11-19: Vercel ISR writes and
// CPU, Neon transfer). The timers are only a safety net if a ping is lost:
// 5 min for lists, 1 h for the rest (`CACHE`).

import { timingSafeEqual } from 'node:crypto'

/** Cache tag on every CMS fetch (lib/payload.ts): dropping it flushes everything. */
export const CMS_TAG = 'cms'

/**
 * The cache tags a CMS read carries, besides CMS_TAG. Shared with the CMS's
 * hook (apps/cms/src/lib/revalidate-web.ts builds the same strings).
 */
export const TAGS = {
  /** Article lists: home, sections, feeds, sitemaps, search. */
  articles: 'articles',
  article: (slug: string) => `article:${slug}`,
  /** The games list: the library, the search, company and console pages. */
  games: 'games',
  game: (slug: string) => `game:${slug}`,
  /** Consoles, companies and tags lists (labels, filters, tag → page links). */
  taxonomy: 'taxonomy',
  tag: (slug: string) => `tag:${slug}`,
  author: (slug: string) => `author:${slug}`,
  company: (slug: string) => `company:${slug}`,
  platform: (slug: string) => `platform:${slug}`,
  /** An article's "Read next" and previous / next cards: only an image change drops them. */
  extras: 'article-extras',
  /** Esport matches (PandaScore sync every 10 min, no ping: the 5 min timer). */
  esport: 'esport',
} as const

/** How long a CMS read stays fresh without a ping, in seconds. */
export const CACHE = {
  /** Lists that change with every new article. */
  lists: 300,
  /** One document, or data a ping always refreshes. */
  details: 3600,
} as const

/** More tags than this in one ping: the CMS asks for a full refresh instead. */
export const MAX_TAGS = 100

/**
 * The tags a ping asks to drop, checked: short strings of the shapes above.
 * Anything else is ignored (a full flush happens when none is valid).
 */
export function cleanTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [
    ...new Set(
      raw.filter(
        (t): t is string =>
          typeof t === 'string' &&
          /^(articles|article-extras|games|taxonomy|(article|game|tag|author|company|platform):[\w.~%-]{1,200})$/i.test(t),
      ),
    ),
  ].slice(0, MAX_TAGS)
}

/** Constant-time check of the shared secret. False when no secret is configured. */
export function isValidSecret(given: string | null, expected: string | undefined): boolean {
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
