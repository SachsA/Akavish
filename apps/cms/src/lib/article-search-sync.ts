import type { Payload } from 'payload'
import {
  getMeiliClient,
  ensureArticlesIndex,
  ARTICLES_INDEX,
  type ArticleSearchDoc,
} from './meilisearch'

// Pull a possible populated relationship's display field, tolerating id-only refs.
function relName(rel: unknown, field: 'name'): string | undefined {
  if (rel && typeof rel === 'object' && field in (rel as Record<string, unknown>)) {
    const v = (rel as Record<string, unknown>)[field]
    return typeof v === 'string' ? v : undefined
  }
  return undefined
}

function mediaUrl(rel: unknown): string | undefined {
  if (rel && typeof rel === 'object' && 'url' in (rel as Record<string, unknown>)) {
    const v = (rel as Record<string, unknown>).url
    return typeof v === 'string' ? v : undefined
  }
  return undefined
}

// Build a search document from a (depth>=1) Payload article doc.
export function toSearchDoc(doc: Record<string, unknown>): ArticleSearchDoc {
  const tags = Array.isArray(doc.tags)
    ? (doc.tags as unknown[])
        .map((t) => relName(t, 'name'))
        .filter((s): s is string => Boolean(s))
    : []

  return {
    id: String(doc.id),
    slug: String(doc.slug ?? ''),
    title: String(doc.title ?? ''),
    excerpt: String(doc.excerpt ?? ''),
    category: String(doc.category ?? ''),
    author: relName(doc.author, 'name'),
    game: relName(doc.game, 'name'),
    tags,
    coverImage: mediaUrl(doc.coverImage),
    publishedAt: doc.publishedAt
      ? Math.floor(new Date(String(doc.publishedAt)).getTime() / 1000)
      : undefined,
  }
}

// Upsert an article into the search index if it's published; otherwise remove it.
// Best-effort: any failure is logged and swallowed so editing never breaks.
export async function syncArticleToSearch(
  payload: Payload,
  articleId: string | number
): Promise<void> {
  const meili = getMeiliClient()
  if (!meili) return

  try {
    const doc = (await payload.findByID({
      collection: 'articles',
      id: articleId,
      depth: 1,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    const index = meili.index(ARTICLES_INDEX)

    if (doc?.status === 'published') {
      await index.addDocuments([toSearchDoc(doc)])
    } else {
      await index.deleteDocument(String(articleId)).catch(() => {})
    }
  } catch (err) {
    payload.logger.error(`[search] failed to sync article ${articleId}: ${String(err)}`)
  }
}

// Remove an article from the search index (used on delete).
export async function removeArticleFromSearch(
  payload: Payload,
  articleId: string | number
): Promise<void> {
  const meili = getMeiliClient()
  if (!meili) return
  try {
    await meili.index(ARTICLES_INDEX).deleteDocument(String(articleId))
  } catch (err) {
    payload.logger.error(`[search] failed to remove article ${articleId}: ${String(err)}`)
  }
}

// Re-create index settings and bulk index all published articles (backfill).
export async function reindexAllArticles(payload: Payload): Promise<number> {
  const meili = getMeiliClient()
  if (!meili) {
    payload.logger.warn('[search] MEILISEARCH_HOST not set — skipping reindex')
    return 0
  }

  const index = await ensureArticlesIndex(meili)

  const { docs } = await payload.find({
    collection: 'articles',
    where: { status: { equals: 'published' } },
    depth: 1,
    limit: 10000,
    overrideAccess: true,
  })

  const documents = docs.map((d) => toSearchDoc(d as unknown as Record<string, unknown>))
  if (documents.length > 0) {
    await index.addDocuments(documents)
  }
  return documents.length
}
