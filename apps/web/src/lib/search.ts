import { MeiliSearch } from 'meilisearch'

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
