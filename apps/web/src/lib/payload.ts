// ─── Payload REST helpers ────────────────────────────────────────────────────
// The CMS (standalone Payload) exposes a REST API at CMS_URL/api.
// These helpers fetch from it and normalise Payload's response shape into the
// shared `Article` type the frontend (and mobile) consume.

import type { Article, PaginatedResponse } from '@akavish/types'

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:3001'

// Payload's list responses look like { docs, totalDocs, page, totalPages, limit, ... }
interface PayloadListResponse<T> {
  docs: T[]
  totalDocs: number
  page: number
  limit: number
  totalPages: number
}

// A raw Payload article doc (relationships populated at depth=1).
interface PayloadArticle {
  id: string | number
  slug: string
  title: string
  excerpt: string
  content: unknown
  category: Article['category']
  status: Article['status']
  coverImage?: { url?: string } | string | null
  publishedAt?: string | null
  createdAt: string
  updatedAt: string
  author?: { id: string | number; name?: string; avatar?: { url?: string } | string; bio?: string } | string | null
  game?: { id: string | number; name?: string; slug?: string } | string | null
  tags?: Array<{ slug?: string } | string> | null
}

function mediaUrl(m: { url?: string } | string | null | undefined): string | undefined {
  if (!m) return undefined
  if (typeof m === 'string') return m
  return m.url ?? undefined
}

// Normalise a raw Payload doc into the shared Article shape.
export function mapArticle(doc: PayloadArticle): Article {
  const author = doc.author && typeof doc.author === 'object' ? doc.author : null
  const game = doc.game && typeof doc.game === 'object' ? doc.game : null

  return {
    id: String(doc.id),
    slug: doc.slug,
    title: doc.title,
    excerpt: doc.excerpt,
    // Keep the raw Lexical JSON as a string; the detail page parses it.
    content: typeof doc.content === 'string' ? doc.content : JSON.stringify(doc.content ?? null),
    category: doc.category,
    status: doc.status,
    coverImage: mediaUrl(doc.coverImage),
    tags: Array.isArray(doc.tags)
      ? doc.tags.map((t) => (typeof t === 'string' ? t : (t.slug ?? ''))).filter(Boolean)
      : [],
    game: game
      ? {
          id: String(game.id),
          slug: game.slug ?? '',
          name: game.name ?? '',
          platform: [],
          genre: [],
        }
      : undefined,
    author: {
      id: author ? String(author.id) : '',
      name: author?.name ?? 'Akavish',
      avatar: mediaUrl(author?.avatar),
      bio: author?.bio,
    },
    publishedAt: doc.publishedAt ?? undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

interface ListParams {
  page?: number
  limit?: number
  category?: string
}

// Fetch a paginated list of *published* articles, newest first.
export async function fetchArticles(
  params: ListParams = {}
): Promise<PaginatedResponse<Article>> {
  const { page = 1, limit = 20, category } = params
  const qs = new URLSearchParams({
    'where[status][equals]': 'published',
    sort: '-publishedAt',
    depth: '1',
    limit: String(limit),
    page: String(page),
  })
  if (category) qs.set('where[category][equals]', category)

  const res = await fetch(`${CMS_URL}/api/articles?${qs.toString()}`, {
    // Revalidate periodically so new articles show up without a redeploy.
    next: { revalidate: 30 },
  })

  if (!res.ok) {
    throw new Error(`CMS responded ${res.status}`)
  }

  const json = (await res.json()) as PayloadListResponse<PayloadArticle>

  return {
    data: json.docs.map(mapArticle),
    total: json.totalDocs,
    page: json.page,
    perPage: json.limit,
    totalPages: json.totalPages,
  }
}

// Fetch a single published article by slug, or null if not found.
export async function fetchArticleBySlug(slug: string): Promise<Article | null> {
  const qs = new URLSearchParams({
    'where[slug][equals]': slug,
    'where[status][equals]': 'published',
    depth: '1',
    limit: '1',
  })

  const res = await fetch(`${CMS_URL}/api/articles?${qs.toString()}`, {
    next: { revalidate: 30 },
  })

  if (!res.ok) {
    throw new Error(`CMS responded ${res.status}`)
  }

  const json = (await res.json()) as PayloadListResponse<PayloadArticle>
  const doc = json.docs[0]
  return doc ? mapArticle(doc) : null
}
