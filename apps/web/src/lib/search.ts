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
  coverImage?: string
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
    coverImage: article.coverImage,
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
