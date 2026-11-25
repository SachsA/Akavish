// ─── Payload → shared types ──────────────────────────────────────────────────
// Pure mapping from the CMS's raw REST shape to the `@akavish/types` models.
//
// This used to live only in apps/web/src/lib/payload.ts, while the mobile app
// went through a client typed as `PaginatedResponse<Article>` but receiving
// Payload's raw `{ docs, totalDocs, … }` — so `res.data` was undefined at
// runtime. Both clients now share this one mapper.
//
// No I/O and no environment access here: callers pass their own CMS origin, so
// the same code runs in Next.js (server) and Expo (React Native).

import type { Article, PaginatedResponse } from '@akavish/types'

/** Payload's list envelope: `{ docs, totalDocs, page, limit, totalPages, … }`. */
export interface PayloadListResponse<T> {
  docs: T[]
  totalDocs: number
  page: number
  limit: number
  totalPages: number
}

/**
 * An upload doc as Payload returns it: the original file plus the `imageSizes`
 * variants (thumbnail / card / hero / square — see the CMS Media collection).
 * A bare string when the relationship isn't populated.
 */
export type PayloadMedia =
  | string
  | {
      url?: string
      alt?: string | null
      /** The French alt text (CMS Media `altFr`). */
      altFr?: string | null
      /** Credit shown under the image (CMS Media `credit`). */
      credit?: string | null
      sizes?: Record<string, { url?: string; filesize?: number | null } | undefined>
      /** Bytes of the original. */
      filesize?: number | null
    }
  | null
  | undefined

export type MediaSize = 'thumbnail' | 'card' | 'hero' | 'square'

/** Past this, an original is served only when no smaller size exists (the site doesn't resize images). */
const HEAVY_ORIGINAL = 600_000

/** A raw article doc, relationships populated (`depth=1`). */
export interface PayloadArticle {
  id: string | number
  slug: string
  title: string
  excerpt: string
  content: unknown
  category: Article['category']
  status: Article['status']
  coverImage?: PayloadMedia
  publishedAt?: string | null
  createdAt: string
  updatedAt: string
  author?:
    | { id: string | number; slug?: string; name?: string; avatar?: PayloadMedia; bio?: string }
    | string
    | null
  game?: { id: string | number; name?: string; slug?: string } | string | null
  tags?: Array<{ slug?: string } | string> | null
  seo?: { title?: string | null; description?: string | null } | null
  featured?: boolean | null
  aiAssisted?: boolean | null
  score?: number | null
  spoiler?: boolean | null
  fr?: {
    title?: string | null
    excerpt?: string | null
    content?: unknown
    seoTitle?: string | null
    seoDescription?: string | null
    status?: string | null
  } | null
}

/** Payload may return a relative path (`/api/media/file/x.jpg`); make it absolute. */
function absolutise(raw: string | undefined, cmsUrl: string): string | undefined {
  if (!raw) return undefined
  return raw.startsWith('/') ? `${cmsUrl}${raw}` : raw
}

/**
 * URL of an uploaded file. Pass `preferred` to get a resized variant instead of
 * the original — originals can be several MB. Falls back to the original when
 * the variant doesn't exist (files uploaded before imageSizes, or images too
 * small for Sharp to produce that size: it never upscales).
 */
export function mediaUrl(
  m: PayloadMedia,
  cmsUrl: string,
  preferred?: MediaSize,
): string | undefined {
  if (!m) return undefined
  if (typeof m === 'string') return absolutise(m, cmsUrl)
  if (preferred) {
    const sized = absolutise(m.sizes?.[preferred]?.url, cmsUrl)
    if (sized) return sized
    // No such size (the original is smaller): the original, unless it's a
    // heavy file (a 1,600 px PNG can weigh 2.7 MB), then the next size down.
    if ((m.filesize ?? 0) > HEAVY_ORIGINAL) {
      const order: MediaSize[] = ['hero', 'card', 'thumbnail']
      for (const size of order.slice(order.indexOf(preferred) + 1)) {
        const smaller = absolutise(m.sizes?.[size]?.url, cmsUrl)
        if (smaller) return smaller
      }
    }
  }
  return absolutise(m.url, cmsUrl)
}

/** Alt text of an uploaded file; undefined when unpopulated or blank. */
export function mediaAlt(m: PayloadMedia): string | undefined {
  if (!m || typeof m === 'string') return undefined
  const alt = m.alt?.trim()
  return alt ? alt : undefined
}

/** Normalise a raw Payload article into the shared `Article` shape. */
export function mapArticle(doc: PayloadArticle, cmsUrl: string): Article {
  const author = doc.author && typeof doc.author === 'object' ? doc.author : null
  const game = doc.game && typeof doc.game === 'object' ? doc.game : null

  return {
    id: String(doc.id),
    slug: doc.slug,
    title: doc.title,
    excerpt: doc.excerpt,
    // Keep the raw Lexical JSON as a string; the detail views parse it.
    content: typeof doc.content === 'string' ? doc.content : JSON.stringify(doc.content ?? null),
    category: doc.category,
    status: doc.status,
    // 'hero' (1920w) is a good source for both the article hero and the cards,
    // which are downscaled from it.
    coverImage: mediaUrl(doc.coverImage, cmsUrl, 'hero'),
    coverImageCard: mediaUrl(doc.coverImage, cmsUrl, 'card'),
    coverImageAlt: mediaAlt(doc.coverImage),
    coverImageCredit:
      doc.coverImage && typeof doc.coverImage === 'object'
        ? doc.coverImage.credit?.trim() || undefined
        : undefined,
    featured: doc.featured === true,
    aiAssisted: doc.aiAssisted === true,
    score: typeof doc.score === 'number' ? doc.score : undefined,
    spoiler: doc.spoiler === true,
    tags: Array.isArray(doc.tags)
      ? doc.tags.map((t) => (typeof t === 'string' ? t : (t.slug ?? ''))).filter(Boolean)
      : [],
    game: game
      ? {
          id: String(game.id),
          slug: game.slug ?? '',
          name: game.name ?? '',
          platforms: [],
          genre: [],
        }
      : undefined,
    author: {
      id: author ? String(author.id) : '',
      slug: author?.slug,
      name: author?.name ?? 'Akavish',
      avatar: mediaUrl(author?.avatar, cmsUrl, 'square'),
      bio: author?.bio,
    },
    publishedAt: doc.publishedAt ?? undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    seo: doc.seo
      ? { title: doc.seo.title ?? undefined, description: doc.seo.description ?? undefined }
      : undefined,
    fr: mapTranslation(doc),
  }
}

/** The French version when there is one (a title at least). */
function mapTranslation(doc: PayloadArticle): Article['fr'] {
  const fr = doc.fr
  if (!fr?.title) return undefined
  const cover = doc.coverImage && typeof doc.coverImage === 'object' ? doc.coverImage : null
  const status = fr.status
  return {
    title: fr.title,
    excerpt: fr.excerpt ?? '',
    // No French body yet (only the title was set by hand): the English one.
    content: fr.content
      ? typeof fr.content === 'string'
        ? fr.content
        : JSON.stringify(fr.content)
      : typeof doc.content === 'string'
        ? doc.content
        : JSON.stringify(doc.content ?? null),
    seo: { title: fr.seoTitle ?? undefined, description: fr.seoDescription ?? undefined },
    coverImageAlt: cover?.altFr?.trim() || undefined,
    status:
      status === 'auto' || status === 'edited' || status === 'pending' || status === 'failed'
        ? status
        : undefined,
  }
}

/** Convert Payload's list envelope into the shared `PaginatedResponse`. */
export function toPaginated<TIn, TOut>(
  res: PayloadListResponse<TIn>,
  map: (doc: TIn) => TOut,
): PaginatedResponse<TOut> {
  return {
    data: res.docs.map(map),
    total: res.totalDocs,
    page: res.page,
    perPage: res.limit,
    totalPages: res.totalPages,
  }
}
