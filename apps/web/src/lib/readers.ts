// ─── Reader accounts and saved articles (server only) ────────────────────────
// The CMS keeps one `readers` row per Clerk account and their saved articles
// (apps/cms/src/lib/readers.ts). The web talks to it server to server with a
// shared secret, READER_API_SECRET (same value on Vercel and Railway), after
// checking the Clerk session itself: the browser never sees the secret and can
// only act as the signed-in reader.
//
// Never import this from a client component.

import type { Article } from '@akavish/types'
import { mapArticle, type PayloadArticle } from '@akavish/api-client/payload'
import type { ReaderRole } from './roles'
import { log } from './log'

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:3001'
const TIMEOUT_MS = 8000

export interface Reader {
  id: number | string
  clerkId: string
  displayName: string | null
  email: string | null
  imageUrl: string | null
  role: ReaderRole
  authorSlug: string | null
}

export interface ReaderProfile {
  clerkId: string
  email: string | null
  emailVerified: boolean
  displayName: string | null
  imageUrl: string | null
}

/** No secret configured, or the CMS didn't answer properly. */
export class ReadersUnavailable extends Error {}

/** The article to save doesn't exist (or isn't published). */
export class NotFound extends Error {}

export function readersConfigured(): boolean {
  return Boolean(process.env.READER_API_SECRET)
}

async function call<T>(path: string, init: { method?: string; body?: unknown; query?: URLSearchParams } = {}): Promise<T> {
  const secret = process.env.READER_API_SECRET
  if (!secret) throw new ReadersUnavailable('READER_API_SECRET is not set')
  const url = `${CMS_URL}/api/reader-api/${path}${init.query ? `?${init.query.toString()}` : ''}`
  let res: Response
  try {
    res = await fetch(url, {
      method: init.method ?? 'GET',
      headers: {
        authorization: `Bearer ${secret}`,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    log.error('reader api unreachable', { path, error })
    throw new ReadersUnavailable('CMS unreachable')
  }
  if (res.status === 404) throw new NotFound()
  if (!res.ok) {
    log.warn('reader api answered an error', { path, status: res.status })
    throw new ReadersUnavailable(`CMS responded ${res.status}`)
  }
  return (await res.json()) as T
}

/** Create or refresh the reader from their Clerk profile, and get their role. */
export async function syncReader(profile: ReaderProfile): Promise<Reader> {
  const { reader } = await call<{ reader: Reader }>('sync', { method: 'POST', body: { profile } })
  return reader
}

export interface SavedArticle extends Article {
  savedAt: string
}

export async function fetchSavedArticles(
  clerkId: string,
  { page = 1, limit = 12 }: { page?: number; limit?: number } = {}
): Promise<{ articles: SavedArticle[]; total: number; page: number; totalPages: number }> {
  const query = new URLSearchParams({ clerkId, page: String(page), limit: String(limit) })
  const res = await call<{
    docs: { savedAt: string; article: PayloadArticle }[]
    total: number
    page: number
    totalPages: number
  }>('bookmarks', { query })
  return {
    articles: res.docs
      .filter((d) => d.article && typeof d.article === 'object')
      .map((d) => ({ ...mapArticle(d.article, CMS_URL), savedAt: d.savedAt })),
    total: res.total,
    page: res.page,
    totalPages: res.totalPages,
  }
}

/** Which of these article ids the reader has saved. */
export async function savedArticleIds(clerkId: string, articleIds: string[]): Promise<string[]> {
  const query = new URLSearchParams({ clerkId, articles: articleIds.join(',') })
  const { saved } = await call<{ saved: Array<number | string> }>('saved', { query })
  return saved.map(String)
}

export async function saveArticle(clerkId: string, articleId: string): Promise<void> {
  await call('bookmarks', { method: 'POST', body: { clerkId, articleId: Number(articleId) } })
}

export async function unsaveArticle(clerkId: string, articleId: string): Promise<void> {
  await call('bookmarks', { method: 'DELETE', body: { clerkId, articleId: Number(articleId) } })
}
