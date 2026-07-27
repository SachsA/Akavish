// ─── Payload REST helpers ────────────────────────────────────────────────────
// The CMS (standalone Payload) exposes a REST API at CMS_URL/api.
// These helpers fetch from it and normalise Payload's response shape into the
// shared `Article` type the frontend (and mobile) consume.

import type { Article, PaginatedResponse } from '@akavish/types'

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:3001'

// Fail fast if the CMS is slow or down (esp. during a build), so callers hit
// their try/catch and degrade gracefully instead of hanging the request/build.
// Uses Promise.race (not AbortSignal) to keep Next's fetch cache semantics —
// a `signal` would mark the fetch dynamic and clash with generateStaticParams.
const CMS_FETCH_TIMEOUT_MS = 8000
function cmsFetch(url: string, init?: RequestInit): Promise<Response> {
  return Promise.race([
    fetch(url, init),
    new Promise<Response>((_, reject) =>
      setTimeout(
        () => reject(new Error(`CMS fetch timed out after ${CMS_FETCH_TIMEOUT_MS}ms`)),
        CMS_FETCH_TIMEOUT_MS
      )
    ),
  ])
}

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
  author?: { id: string | number; slug?: string; name?: string; avatar?: { url?: string } | string; bio?: string } | string | null
  game?: { id: string | number; name?: string; slug?: string } | string | null
  tags?: Array<{ slug?: string } | string> | null
  seo?: { title?: string; description?: string } | null
}

function mediaUrl(m: { url?: string } | string | null | undefined): string | undefined {
  if (!m) return undefined
  const raw = typeof m === 'string' ? m : m.url
  if (!raw) return undefined
  // Payload may return a relative path (e.g. /api/media/file/x.jpg).
  // Make it absolute against the CMS origin so next/image can load it.
  if (raw.startsWith('/')) return `${CMS_URL}${raw}`
  return raw
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
      slug: author?.slug,
      name: author?.name ?? 'Akavish',
      avatar: mediaUrl(author?.avatar),
      bio: author?.bio,
    },
    publishedAt: doc.publishedAt ?? undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    seo: doc.seo
      ? { title: doc.seo.title ?? undefined, description: doc.seo.description ?? undefined }
      : undefined,
  }
}

interface ListParams {
  page?: number
  limit?: number
  category?: string
  authorId?: string
  gameId?: string
  tagId?: string
}

// Fetch a paginated list of *published* articles, newest first.
export async function fetchArticles(
  params: ListParams = {}
): Promise<PaginatedResponse<Article>> {
  const { page = 1, limit = 20, category, authorId, gameId, tagId } = params
  const qs = new URLSearchParams({
    'where[status][equals]': 'published',
    sort: '-publishedAt',
    depth: '1',
    limit: String(limit),
    page: String(page),
  })
  if (category) qs.set('where[category][equals]', category)
  if (authorId) qs.set('where[author][equals]', authorId)
  if (gameId) qs.set('where[game][equals]', gameId)
  if (tagId) qs.set('where[tags][in]', tagId)

  const res = await cmsFetch(`${CMS_URL}/api/articles?${qs.toString()}`, {
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

  const res = await cmsFetch(`${CMS_URL}/api/articles?${qs.toString()}`, {
    next: { revalidate: 30 },
  })

  if (!res.ok) {
    throw new Error(`CMS responded ${res.status}`)
  }

  const json = (await res.json()) as PayloadListResponse<PayloadArticle>
  const doc = json.docs[0]
  return doc ? mapArticle(doc) : null
}

// ─── Entity fetchers (author / game / tag) ───────────────────────────────────

export interface AuthorEntity {
  id: string
  slug: string
  name: string
  avatar?: string
  bio?: string
  twitter?: string
}

export interface GameEntity {
  id: string
  slug: string
  name: string
  cover?: string
  platform: string[]
  genre: string[]
  developer?: string
  publisher?: string
  releaseDate?: string
}

export interface TagEntity {
  id: string
  slug: string
  name: string
}

// Generic helper: fetch one doc from a collection by slug.
async function fetchOneBySlug<T>(collection: string, slug: string): Promise<T | null> {
  const qs = new URLSearchParams({
    'where[slug][equals]': slug,
    depth: '1',
    limit: '1',
  })
  const res = await cmsFetch(`${CMS_URL}/api/${collection}?${qs.toString()}`, {
    next: { revalidate: 30 },
  })
  if (!res.ok) throw new Error(`CMS responded ${res.status}`)
  const json = (await res.json()) as PayloadListResponse<T>
  return json.docs[0] ?? null
}

export async function fetchAuthorBySlug(slug: string): Promise<AuthorEntity | null> {
  const doc = await fetchOneBySlug<{
    id: string | number
    slug: string
    name: string
    avatar?: { url?: string } | string | null
    bio?: string
    twitter?: string
  }>('authors', slug)
  if (!doc) return null
  return {
    id: String(doc.id),
    slug: doc.slug,
    name: doc.name,
    avatar: mediaUrl(doc.avatar),
    bio: doc.bio,
    twitter: doc.twitter,
  }
}

export async function fetchGameBySlug(slug: string): Promise<GameEntity | null> {
  const doc = await fetchOneBySlug<{
    id: string | number
    slug: string
    name: string
    cover?: { url?: string } | string | null
    platform?: string[] | null
    genre?: string[] | null
    developer?: string
    publisher?: string
    releaseDate?: string | null
  }>('games', slug)
  if (!doc) return null
  return {
    id: String(doc.id),
    slug: doc.slug,
    name: doc.name,
    cover: mediaUrl(doc.cover),
    platform: doc.platform ?? [],
    genre: doc.genre ?? [],
    developer: doc.developer,
    publisher: doc.publisher,
    releaseDate: doc.releaseDate ?? undefined,
  }
}

export async function fetchTagBySlug(slug: string): Promise<TagEntity | null> {
  const doc = await fetchOneBySlug<{ id: string | number; slug: string; name: string }>(
    'tags',
    slug
  )
  if (!doc) return null
  return { id: String(doc.id), slug: doc.slug, name: doc.name }
}

// ─── Sitemap helpers ─────────────────────────────────────────────────────────

export interface SlugEntry {
  slug: string
  updatedAt?: string
}

// All published article slugs (+ last-modified) for the sitemap.
export async function fetchAllArticleSlugs(): Promise<SlugEntry[]> {
  const qs = new URLSearchParams({
    'where[status][equals]': 'published',
    depth: '0',
    limit: '1000',
    sort: '-publishedAt',
  })
  const res = await cmsFetch(`${CMS_URL}/api/articles?${qs.toString()}`, {
    next: { revalidate: 300 },
  })
  if (!res.ok) throw new Error(`CMS responded ${res.status}`)
  const json = (await res.json()) as PayloadListResponse<{
    slug: string
    updatedAt?: string
  }>
  return json.docs.map((d) => ({ slug: d.slug, updatedAt: d.updatedAt }))
}

// All slugs of a simple collection (authors / games / tags) for the sitemap.
export async function fetchAllEntitySlugs(
  collection: 'authors' | 'games' | 'tags'
): Promise<SlugEntry[]> {
  const qs = new URLSearchParams({ depth: '0', limit: '1000' })
  const res = await cmsFetch(`${CMS_URL}/api/${collection}?${qs.toString()}`, {
    next: { revalidate: 300 },
  })
  if (!res.ok) throw new Error(`CMS responded ${res.status}`)
  const json = (await res.json()) as PayloadListResponse<{
    slug: string
    updatedAt?: string
  }>
  return json.docs.map((d) => ({ slug: d.slug, updatedAt: d.updatedAt }))
}
