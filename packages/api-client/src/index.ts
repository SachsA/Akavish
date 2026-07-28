import type { Article, ArticleCategory, PaginatedResponse, ApiError } from '@akavish/types'

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
    }));

    throw error as ApiError;
  }

  return res.json() as Promise<T>
}

// ─── Articles ──────────────────────────────────────────────────────────────

export const articlesApi = {
  list: (params?: {
    page?: number
    limit?: number
    category?: ArticleCategory
    tag?: string
    q?: string
    status?: 'published' | 'draft'
  }) => {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.status) query.set('where[status][equals]', params.status)
    if (params?.category) query.set('where[category][equals]', params.category)
    const qs = query.toString()
    return fetcher<PaginatedResponse<Article>>(`/articles${qs ? `?${qs}` : ''}`)
  },

  get: (slug: string) =>
    fetcher<{ docs: Article[] }>(`/articles?where[slug][equals]=${slug}&limit=1`)
      .then((res) => res.docs[0] ?? null),
}

// ─── Export ────────────────────────────────────────────────────────────────

export { fetcher }
export type { Article, ArticleCategory, PaginatedResponse, ApiError }
