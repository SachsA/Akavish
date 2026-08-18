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

// A Payload upload doc: the original file plus the generated `imageSizes`
// variants (thumbnail / card / hero / square — see apps/cms Media collection).
type PayloadMedia =
  | string
  | {
      url?: string
      sizes?: Record<string, { url?: string } | undefined>
    }
  | null
  | undefined

type MediaSize = 'thumbnail' | 'card' | 'hero' | 'square'

function absolutise(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  // Payload may return a relative path (e.g. /api/media/file/x.jpg).
  // Make it absolute against the CMS origin so next/image can load it.
  return raw.startsWith('/') ? `${CMS_URL}${raw}` : raw
}

/**
 * URL of an uploaded file. Pass a `preferred` size to serve a resized variant
 * instead of the original — originals can be several MB, which is wasteful as a
 * source for next/image. Falls back to the original when the variant is missing
 * (e.g. files uploaded before imageSizes existed).
 */
function mediaUrl(m: PayloadMedia, preferred?: MediaSize): string | undefined {
  if (!m) return undefined
  if (typeof m === 'string') return absolutise(m)
  if (preferred) {
    const sized = absolutise(m.sizes?.[preferred]?.url)
    if (sized) return sized
  }
  return absolutise(m.url)
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
    // 'hero' (1920w) is a good source for both the article hero (768 CSS px at
    // 2x) and the cards, which next/image downscales from it.
    coverImage: mediaUrl(doc.coverImage, 'hero'),
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
      avatar: mediaUrl(author?.avatar, 'square'),
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

/**
 * Search published articles through the CMS (i.e. Postgres `ILIKE`).
 *
 * The **fallback** used by /api/search when Meilisearch isn't configured, so
 * site search works with zero extra infrastructure.
 *
 * Payload's `like` splits the query on spaces and requires *every* word to
 * appear in the column, case-insensitively. So "gta 6" matches a title
 * containing both "gta" and "6" in any order — but a query whose words are
 * spread across the title *and* the excerpt won't match, since each branch of
 * the OR is evaluated on a single column.
 *
 * No typo tolerance and no relevance ranking, hence newest-first ordering. Good
 * enough at this article count; set MEILISEARCH_HOST to get the real thing.
 */
export async function searchArticles(q: string, limit = 20): Promise<Article[]> {
  // Payload nests an OR group inside the top-level AND so the published filter
  // still applies to every branch:
  //   and[0]: status == published
  //   and[1]: or[0] title ~ q  OR  or[1] excerpt ~ q
  const qs = new URLSearchParams({
    'where[and][0][status][equals]': 'published',
    'where[and][1][or][0][title][like]': q,
    'where[and][1][or][1][excerpt][like]': q,
    sort: '-publishedAt',
    depth: '1',
    limit: String(limit),
  })

  const res = await cmsFetch(`${CMS_URL}/api/articles?${qs.toString()}`, {
    next: { revalidate: 30 },
  })
  if (!res.ok) throw new Error(`CMS responded ${res.status}`)

  const json = (await res.json()) as PayloadListResponse<PayloadArticle>
  return json.docs.map(mapArticle)
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
    avatar: mediaUrl(doc.avatar, 'square'),
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
    // Game covers render at ~192 CSS px → 'card' (960w) is plenty at 2x.
    cover: mediaUrl(doc.cover, 'card'),
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
