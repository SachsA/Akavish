import { MeiliSearch } from 'meilisearch'
import type { Article } from '@akavish/types'

export const ARTICLES_INDEX = 'articles'

// Shape returned to the client by /api/search.
export interface SearchHit {
  id: string
  slug: string
  title: string
  excerpt: string
  category: string
  author?: string
  game?: string
  gameSlug?: string
  coverImage?: string
  publishedAt?: string
}

/** A game suggested in the header ("Gears" → the Gears of War pages). */
export interface GameHit {
  slug: string
  name: string
  cover?: string
}

/** What /api/search returns. `facets` and `games` only when asked for. */
export interface SearchResponse {
  query: string
  hits: SearchHit[]
  total: number
  page: number
  totalPages: number
  engine: SearchEngine
  /** Results per category value, ignoring the category filter (`?facets=1`). */
  facets?: Record<string, number>
  /** Matching games (`?games=1`). */
  games?: GameHit[]
  /** Name of the game in the `game` filter, for its chip. */
  gameName?: string
}

/** Which backend answered a query — surfaced by /api/search for debugging. */
export type SearchEngine = 'cms' | 'meilisearch'

/**
 * Shape an article fetched from the CMS like a Meilisearch hit, so the client
 * renders both backends identically.
 */
export function articleToSearchHit(article: Article): SearchHit {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    category: article.category,
    author: article.author?.name,
    game: article.game?.name,
    gameSlug: article.game?.slug,
    coverImage: article.coverImage,
    publishedAt: article.publishedAt,
  }
}

let client: MeiliSearch | null = null

// Server-side Meilisearch client. Uses a search-only key when provided,
// falling back to the admin key. Never expose either to the browser — all
// search goes through the /api/search route.
export function getSearchClient(): MeiliSearch | null {
  const host = process.env.MEILISEARCH_HOST
  const apiKey =
    process.env.MEILISEARCH_SEARCH_KEY ?? process.env.MEILISEARCH_API_KEY
  if (!host) return null
  if (!client) {
    client = new MeiliSearch({ host, apiKey })
  }
  return client
}
