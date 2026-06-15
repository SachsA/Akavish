import { MeiliSearch, type Index } from 'meilisearch'

// Meilisearch index that mirrors *published* articles for the public search UI.
export const ARTICLES_INDEX = 'articles'

// Shape of a document stored in the search index.
export interface ArticleSearchDoc {
  id: string
  slug: string
  title: string
  excerpt: string
  category: string
  author?: string
  game?: string
  tags?: string[]
  coverImage?: string
  publishedAt?: number // unix seconds, for sorting/filtering
}

let client: MeiliSearch | null = null

// Returns a configured client, or null if Meilisearch isn't configured.
// Indexing is best-effort: a missing config must never break content editing.
export function getMeiliClient(): MeiliSearch | null {
  const host = process.env.MEILISEARCH_HOST
  const apiKey = process.env.MEILISEARCH_API_KEY
  if (!host) return null
  if (!client) {
    client = new MeiliSearch({ host, apiKey })
  }
  return client
}

// Ensure the index exists with the right searchable/filterable/sortable config.
export async function ensureArticlesIndex(meili: MeiliSearch): Promise<Index> {
  await meili.createIndex(ARTICLES_INDEX, { primaryKey: 'id' }).catch(() => {
    // Index probably already exists — ignore.
  })
  const index = meili.index(ARTICLES_INDEX)
  await index.updateSettings({
    searchableAttributes: ['title', 'excerpt', 'author', 'game', 'tags', 'category'],
    filterableAttributes: ['category', 'game', 'tags'],
    sortableAttributes: ['publishedAt'],
    rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
  })
  return index
}
