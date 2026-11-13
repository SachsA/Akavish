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
  username: string
  emailVerified: boolean
  banned: boolean
}

export interface ReaderProfile {
  clerkId: string
  email: string | null
  emailVerified: boolean
  displayName: string | null
  /** The public name (comments); the first name stands in when it's missing. */
  username: string | null
  firstName: string | null
  imageUrl: string | null
  /** When the Clerk account was created (ISO). */
  createdAt: string | null
}

/** What Clerk's `currentUser()` gives, reduced to what the CMS keeps. */
export function profileFromUser(user: {
  id: string
  fullName?: string | null
  username?: string | null
  firstName?: string | null
  imageUrl?: string | null
  createdAt?: number | null
  primaryEmailAddress?: { emailAddress: string; verification?: { status?: string | null } | null } | null
}): ReaderProfile {
  const primary = user.primaryEmailAddress
  return {
    clerkId: user.id,
    email: primary?.emailAddress ?? null,
    emailVerified: primary?.verification?.status === 'verified',
    displayName: user.fullName || user.username || null,
    username: user.username ?? null,
    firstName: user.firstName ?? null,
    imageUrl: user.imageUrl || null,
    createdAt: typeof user.createdAt === 'number' ? new Date(user.createdAt).toISOString() : null,
  }
}

/** No secret configured, or the CMS didn't answer properly. */
export class ReadersUnavailable extends Error {}

/**
 * The CMS refused the request for a reason the reader should hear about
 * (`code`: unverified, banned, slow-down, duplicate, closed…).
 */
export class ReaderApiError extends Error {
  constructor(
    public code: string,
    public status: number
  ) {
    super(code)
  }
}

/** The article or comment doesn't exist (or isn't published). */
export class NotFound extends ReaderApiError {
  constructor() {
    super('not-found', 404)
  }
}

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
  if ([400, 403, 409, 429].includes(res.status)) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new ReaderApiError(body.error ?? 'refused', res.status)
  }
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

/** Saving needs the full profile: the CMS checks the email is verified. */
export async function saveArticle(profile: ReaderProfile, articleId: string): Promise<void> {
  await call('bookmarks', { method: 'POST', body: { profile, articleId: Number(articleId) } })
}

export async function unsaveArticle(clerkId: string, articleId: string): Promise<void> {
  await call('bookmarks', { method: 'DELETE', body: { clerkId, articleId: Number(articleId) } })
}

// ─── Comments (apps/cms/src/lib/comments.ts) ────────────────────────────────

export type CommentStatus = 'visible' | 'hidden' | 'deleted'

export interface CommentView {
  id: number
  parentId: number | null
  replyToId: number | null
  replyToName: string | null
  status: CommentStatus
  body: string | null
  author: { name: string; role: ReaderRole } | null
  createdAt: string
  likes: number
  dislikes: number
  myVote: -1 | 0 | 1
  mine: boolean
  reported: boolean
  replies?: CommentView[]
}

export interface CommentList {
  enabled: boolean
  closed: boolean
  total: number
  page: number
  totalPages: number
  comments: CommentView[]
  viewer: { role: ReaderRole; canModerate: boolean; banned: boolean; verified: boolean } | null
}

export async function listComments(articleId: string, page: number, viewerClerkId: string | null) {
  const query = new URLSearchParams({ article: articleId, page: String(page) })
  if (viewerClerkId) query.set('clerkId', viewerClerkId)
  return call<CommentList>('comments', { query })
}

export async function postComment(
  profile: ReaderProfile,
  input: { articleId: string; body: string; replyTo: number | null }
) {
  const { comment } = await call<{ comment: CommentView }>('comments', {
    method: 'POST',
    body: { profile, articleId: Number(input.articleId), body: input.body, replyTo: input.replyTo },
  })
  return comment
}

export async function deleteComment(profile: ReaderProfile, commentId: number) {
  await call('comments', { method: 'DELETE', body: { profile, commentId } })
}

export async function voteComment(profile: ReaderProfile, commentId: number, value: -1 | 0 | 1) {
  return call<{ likes: number; dislikes: number; myVote: -1 | 0 | 1 }>('comments/vote', {
    method: 'POST',
    body: { profile, commentId, value },
  })
}

export async function reportComment(profile: ReaderProfile, commentId: number, reason: string, note: string) {
  return call<{ reported: boolean; hidden: boolean }>('comments/report', {
    method: 'POST',
    body: { profile, commentId, reason, note },
  })
}

export async function moderateComment(profile: ReaderProfile, commentId: number, action: 'hide' | 'restore') {
  await call('comments/moderate', { method: 'POST', body: { profile, commentId, action } })
}
