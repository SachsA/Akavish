import type { Article, ArticleCategory, PaginatedResponse, ApiError } from '@akavish/types'
import { mapArticle, toPaginated, type PayloadArticle, type PayloadListResponse } from './payload'

// ─── Config ────────────────────────────────────────────────────────────────
// CMS runs on port 3001 (standalone Payload), web on 3000

const CMS_URL =
  // Expo (React Native) — explicit env var required
  (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_CMS_URL)
    ? process.env.EXPO_PUBLIC_CMS_URL
    // Next.js SSR or server
    : process.env.CMS_URL ?? 'http://localhost:3001'

// ─── Fetcher ───────────────────────────────────────────────────────────────

async function fetcher<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CMS_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({
      message: 'Unknown error',
      status: res.status,
    }))

    throw error as ApiError
  }

  return res.json() as Promise<T>
}

const toArticle = (doc: PayloadArticle) => mapArticle(doc, CMS_URL)

// ─── Articles ──────────────────────────────────────────────────────────────
// Both methods return the shared `Article` shape, mapped from Payload's raw
// response — the same mapping the web app uses (see ./payload.ts).

export const articlesApi = {
  /** Published articles, newest first. */
  list: async (params?: {
    page?: number
    limit?: number
    category?: ArticleCategory
  }): Promise<PaginatedResponse<Article>> => {
    const query = new URLSearchParams({
      // The CMS already hides drafts from anonymous readers; stating it here
      // keeps this client correct even when called with editor credentials.
      'where[status][equals]': 'published',
      sort: '-publishedAt',
      // Populate author / game / tags / cover image so the mapper can read them.
      depth: '1',
    })
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.category) query.set('where[category][equals]', params.category)

    const res = await fetcher<PayloadListResponse<PayloadArticle>>(`/articles?${query.toString()}`)
    return toPaginated(res, toArticle)
  },

  /** One published article by slug, or `null`. */
  get: async (slug: string): Promise<Article | null> => {
    const query = new URLSearchParams({
      // URLSearchParams escapes the slug — it used to be interpolated raw.
      'where[slug][equals]': slug,
      'where[status][equals]': 'published',
      depth: '1',
      limit: '1',
    })
    const res = await fetcher<PayloadListResponse<PayloadArticle>>(`/articles?${query.toString()}`)
    const doc = res.docs[0]
    return doc ? toArticle(doc) : null
  },
}

// ─── Export ────────────────────────────────────────────────────────────────

export { fetcher }
export { mapArticle, mediaAlt, mediaUrl, toPaginated } from './payload'
export type { MediaSize, PayloadArticle, PayloadListResponse, PayloadMedia } from './payload'
export type { Article, ArticleCategory, PaginatedResponse, ApiError }
