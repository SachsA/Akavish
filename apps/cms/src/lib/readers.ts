// ─── Reader accounts and saved articles ──────────────────────────────────────
// Readers sign up on the website with Clerk. This file keeps a `readers` row
// per Clerk account (collections/Readers.ts) and their saved articles
// (`bookmarks`), and exposes both to the website.
//
// Two ways in:
//
//  1. **The website** (apps/web/src/lib/readers.ts), server to server, with a
//     shared secret: READER_API_SECRET on both apps, sent as a Bearer token.
//     The web has already checked the Clerk session; it passes the Clerk user
//     id. A reader who doesn't exist yet is created on the spot, so the site
//     works even if the webhook below was never set up.
//       POST   /api/reader-api/sync        { profile }               → { reader }
//       GET    /api/reader-api/bookmarks   ?clerkId&page&limit       → saved articles, newest first
//       GET    /api/reader-api/saved       ?clerkId&articles=1,2,3   → { saved: [ids] }
//       POST   /api/reader-api/bookmarks   { profile, articleId }    → save (verified accounts)
//       DELETE /api/reader-api/bookmarks   { clerkId, articleId }    → unsave
//
//  2. **Clerk's webhook** (POST /api/clerk/webhook, signed, CLERK_WEBHOOK_SECRET):
//     user.created / user.updated refresh the profile, user.deleted deletes the
//     reader and everything attached (GDPR: the privacy policy promises it).
//
// Linking: a reader whose verified email is a CMS user's email gets that
// account and its author profile, and the Author badge if they had none.

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Payload, PayloadHandler, Where } from 'payload'
import type { ReaderRole } from '../collections/Readers'

export interface ReaderProfile {
  clerkId: string
  email?: string | null
  emailVerified?: boolean
  /** Full name: private, admins only. */
  displayName?: string | null
  /** Clerk username: the public name (comments), first name as a fallback. */
  username?: string | null
  firstName?: string | null
  imageUrl?: string | null
  /** When the Clerk account was created (ISO): new accounts wait before commenting. */
  createdAt?: string | null
}

export interface ReaderView {
  id: number | string
  clerkId: string
  displayName: string | null
  email: string | null
  imageUrl: string | null
  role: ReaderRole
  /** Slug of the linked author profile (the badge links to it). */
  authorSlug: string | null
  /** Public name, shown on comments. */
  username: string
  emailVerified: boolean
  banned: boolean
}

export type ReaderDoc = {
  id: number | string
  clerkId: string
  username?: string | null
  emailVerified?: boolean | null
  banned?: boolean | null
  clerkCreatedAt?: string | null
  displayName?: string | null
  email?: string | null
  imageUrl?: string | null
  role?: ReaderRole | null
  cmsUser?: unknown
  author?: unknown
}

const CLERK_ID = /^user_[A-Za-z0-9]{8,64}$/

export function isClerkId(value: unknown): value is string {
  return typeof value === 'string' && CLERK_ID.test(value)
}

export function clip(value: string | null | undefined, max: number): string | null {
  const v = (value ?? '').trim()
  return v ? v.slice(0, max) : null
}

export function idOf(value: unknown): number | string | null {
  if (value && typeof value === 'object' && 'id' in value) return (value as { id: number | string }).id
  if (typeof value === 'number' || typeof value === 'string') return value
  return null
}

export async function findReader(payload: Payload, clerkId: string): Promise<ReaderDoc | null> {
  const { docs } = await payload.find({
    collection: 'readers',
    where: { clerkId: { equals: clerkId } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  return (docs[0] as unknown as ReaderDoc) ?? null
}

/**
 * The CMS account (and its author profile) a reader should be linked to: same
 * email, and only when Clerk has verified that email.
 */
async function linkFor(payload: Payload, profile: ReaderProfile) {
  if (!profile.emailVerified || !profile.email) return null
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: profile.email.trim().toLowerCase() } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const user = docs[0] as { id: number | string; author?: unknown } | undefined
  return user ? { cmsUser: user.id, author: idOf(user.author) } : null
}

/** Create or refresh a reader from their Clerk profile. Fields left undefined are kept. */
export async function upsertReader(
  payload: Payload,
  profile: ReaderProfile,
  now = new Date(),
): Promise<ReaderView> {
  if (!isClerkId(profile.clerkId)) throw new Error('invalid clerk id')
  const existing = await findReader(payload, profile.clerkId)

  const data: Record<string, unknown> = { lastSeenAt: now.toISOString() }
  if (profile.displayName !== undefined) data.displayName = clip(profile.displayName, 80)
  if (profile.email !== undefined) data.email = clip(profile.email?.toLowerCase(), 254)
  if (profile.imageUrl !== undefined) data.imageUrl = clip(profile.imageUrl, 500)
  if (profile.username !== undefined || profile.firstName !== undefined) {
    data.username = publicNameOf(profile)
  }
  if (profile.emailVerified !== undefined) data.emailVerified = profile.emailVerified
  if (profile.createdAt) {
    const created = new Date(profile.createdAt)
    if (!Number.isNaN(created.getTime())) data.clerkCreatedAt = created.toISOString()
  }

  if (!existing?.cmsUser) {
    const link = await linkFor(payload, profile)
    if (link) {
      data.cmsUser = link.cmsUser
      if (link.author && !existing?.author) data.author = link.author
      if (!existing || existing.role === 'reader') data.role = 'author'
    }
  }

  let doc: unknown
  if (existing) {
    doc = await payload.update({
      collection: 'readers',
      id: existing.id,
      data,
      depth: 1,
      overrideAccess: true,
    })
  } else {
    try {
      doc = await payload.create({
        collection: 'readers',
        data: { clerkId: profile.clerkId, ...data } as never,
        depth: 1,
        overrideAccess: true,
      })
    } catch (error) {
      // Two first requests at once (the webhook and a page view): the other one
      // created it. Use theirs.
      const raced = await findReader(payload, profile.clerkId)
      if (!raced) throw error
      doc = raced
    }
  }
  return toView(doc as ReaderDoc)
}

/**
 * The name shown publicly (comments): the Clerk username (required at sign-up
 * since 2026-11-13), else the first name, never the full name or the email.
 */
export function publicNameOf(profile: Pick<ReaderProfile, 'username' | 'firstName'>): string {
  return clip(profile.username, 40) ?? clip(profile.firstName, 40) ?? 'reader'
}

/** The reader for a Clerk id, created bare if it doesn't exist yet. */
export async function ensureReader(payload: Payload, clerkId: string): Promise<ReaderDoc> {
  const found = await findReader(payload, clerkId)
  if (found) return found
  await upsertReader(payload, { clerkId })
  const created = await findReader(payload, clerkId)
  if (!created) throw new Error('reader not created')
  return created
}

export function toView(doc: ReaderDoc): ReaderView {
  const author = doc.author as { slug?: string } | null | undefined
  return {
    id: doc.id,
    clerkId: doc.clerkId,
    displayName: doc.displayName ?? null,
    email: doc.email ?? null,
    imageUrl: doc.imageUrl ?? null,
    role: doc.role ?? 'reader',
    authorSlug: author && typeof author === 'object' && author.slug ? author.slug : null,
    username: doc.username ?? 'reader',
    emailVerified: doc.emailVerified === true,
    banned: doc.banned === true,
  }
}

/** Delete a reader and their saved articles (the collection's afterDelete hook). */
export async function deleteReader(payload: Payload, clerkId: string): Promise<boolean> {
  const found = await findReader(payload, clerkId)
  if (!found) return false
  await payload.delete({ collection: 'readers', id: found.id, overrideAccess: true })
  return true
}

// ─── Saved articles ─────────────────────────────────────────────────────────

const PUBLISHED: Where = { 'article.status': { equals: 'published' } }

export async function listBookmarks(
  payload: Payload,
  readerId: number | string,
  { page = 1, limit = 20 }: { page?: number; limit?: number } = {},
) {
  const res = await payload.find({
    collection: 'bookmarks',
    // Only articles still published: an unpublished one simply drops off the list.
    where: { and: [{ reader: { equals: readerId } }, PUBLISHED] },
    sort: '-createdAt',
    page,
    limit,
    // article → its cover, game, author and tags, like the site's own lists.
    depth: 2,
    overrideAccess: true,
  })
  return {
    docs: res.docs.map((b) => ({
      savedAt: b.createdAt,
      article: (b as unknown as { article: unknown }).article,
    })),
    total: res.totalDocs,
    page: res.page ?? page,
    totalPages: res.totalPages,
  }
}

/** Which of these articles the reader has saved. */
export async function savedAmong(
  payload: Payload,
  readerId: number | string,
  articleIds: Array<number | string>,
): Promise<Array<number | string>> {
  if (articleIds.length === 0) return []
  const { docs } = await payload.find({
    collection: 'bookmarks',
    where: { and: [{ reader: { equals: readerId } }, { article: { in: articleIds } }] },
    limit: articleIds.length,
    depth: 0,
    overrideAccess: true,
  })
  return docs.map((b) => idOf((b as unknown as { article: unknown }).article)!).filter((v) => v !== null)
}

export type SaveOutcome = 'saved' | 'not-found'

export async function addBookmark(
  payload: Payload,
  readerId: number | string,
  articleId: number | string,
): Promise<SaveOutcome> {
  const { totalDocs } = await payload.count({
    collection: 'articles',
    where: { and: [{ id: { equals: articleId } }, { status: { equals: 'published' } }] },
    overrideAccess: true,
  })
  if (totalDocs === 0) return 'not-found'
  const already = await savedAmong(payload, readerId, [articleId])
  if (already.length > 0) return 'saved'
  try {
    await payload.create({
      collection: 'bookmarks',
      data: { reader: readerId, article: articleId } as never,
      overrideAccess: true,
    })
  } catch (error) {
    // Double click: the unique (reader, article) index refused the second one.
    if ((await savedAmong(payload, readerId, [articleId])).length === 0) throw error
  }
  return 'saved'
}

export async function removeBookmark(
  payload: Payload,
  readerId: number | string,
  articleId: number | string,
): Promise<void> {
  await payload.delete({
    collection: 'bookmarks',
    where: { and: [{ reader: { equals: readerId } }, { article: { equals: articleId } }] },
    overrideAccess: true,
  })
}

// ─── HTTP: the website's calls ──────────────────────────────────────────────

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** null when the call carries the right READER_API_SECRET, else the error response. */
export function checkSecret(headers: Headers): Response | null {
  const secret = process.env.READER_API_SECRET
  if (!secret) return json({ error: 'reader api not configured' }, 503)
  const auth = headers.get('authorization') ?? ''
  const given = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return given && sameSecret(given, secret) ? null : json({ error: 'unauthorized' }, 401)
}

export async function readBody(req: { json?: () => Promise<unknown> }): Promise<Record<string, unknown>> {
  try {
    const body = await req.json?.()
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function articleIdOf(value: unknown): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** The `profile` the website sends (from Clerk's currentUser()), checked field by field. */
export function profileFromBody(p: Record<string, unknown>): ReaderProfile {
  const text = (v: unknown) => (typeof v === 'string' ? v : null)
  return {
    clerkId: String(p.clerkId),
    email: text(p.email),
    emailVerified: p.emailVerified === true,
    displayName: text(p.displayName),
    username: text(p.username),
    firstName: text(p.firstName),
    imageUrl: text(p.imageUrl),
    createdAt: text(p.createdAt),
  }
}

/**
 * Who may write (save, comment, vote, report): a known Clerk account with a
 * verified email, not banned. Refreshes the reader from the profile on the way.
 * Returns the reader, or the error response.
 */
export async function writerFrom(
  payload: Payload,
  raw: unknown,
): Promise<{ reader: ReaderDoc; profile: ReaderProfile } | { error: Response }> {
  const p = (raw ?? {}) as Record<string, unknown>
  if (!isClerkId(p.clerkId)) return { error: json({ error: 'invalid clerkId' }, 400) }
  const profile = profileFromBody(p)
  await upsertReader(payload, profile)
  const reader = (await findReader(payload, profile.clerkId))!
  if (!profile.emailVerified) return { error: json({ error: 'unverified' }, 403) }
  if (reader.banned) return { error: json({ error: 'banned' }, 403) }
  return { reader, profile }
}

export const readerSyncHandler: PayloadHandler = async (req) => {
  const denied = checkSecret(req.headers)
  if (denied) return denied
  const body = await readBody(req)
  const p = (body.profile ?? {}) as Record<string, unknown>
  if (!isClerkId(p.clerkId)) return json({ error: 'invalid clerkId' }, 400)
  const reader = await upsertReader(req.payload, profileFromBody(p))
  return json({ reader })
}

export const readerBookmarksHandler: PayloadHandler = async (req) => {
  const denied = checkSecret(req.headers)
  if (denied) return denied

  if (req.method === 'GET') {
    const clerkId = req.searchParams.get('clerkId')
    if (!isClerkId(clerkId)) return json({ error: 'invalid clerkId' }, 400)
    const page = Math.max(1, Math.min(500, Number(req.searchParams.get('page')) || 1))
    const limit = Math.max(1, Math.min(50, Number(req.searchParams.get('limit')) || 20))
    const reader = await ensureReader(req.payload, clerkId)
    return json(await listBookmarks(req.payload, reader.id, { page, limit }))
  }

  const body = await readBody(req)
  const articleId = articleIdOf(body.articleId)

  if (req.method === 'DELETE') {
    // Unsaving is always allowed, even for a banned or unverified account.
    if (!isClerkId(body.clerkId)) return json({ error: 'invalid clerkId' }, 400)
    if (articleId === null) return json({ error: 'invalid articleId' }, 400)
    const reader = await ensureReader(req.payload, body.clerkId)
    await removeBookmark(req.payload, reader.id, articleId)
    return json({ saved: false })
  }
  // Saving: a verified account (the full profile, not just an id).
  const writer = await writerFrom(req.payload, body.profile)
  if ('error' in writer) return writer.error
  if (articleId === null) return json({ error: 'invalid articleId' }, 400)
  const outcome = await addBookmark(req.payload, writer.reader.id, articleId)
  return outcome === 'saved' ? json({ saved: true }) : json({ error: 'article not found' }, 404)
}

export const readerSavedHandler: PayloadHandler = async (req) => {
  const denied = checkSecret(req.headers)
  if (denied) return denied
  const clerkId = req.searchParams.get('clerkId')
  if (!isClerkId(clerkId)) return json({ error: 'invalid clerkId' }, 400)
  const ids = (req.searchParams.get('articles') ?? '')
    .split(',')
    .map(articleIdOf)
    .filter((n): n is number => n !== null)
    .slice(0, 50)
  // No reader yet means nothing saved yet: don't create one just for a lookup.
  const reader = await findReader(req.payload, clerkId)
  return json({ saved: reader ? await savedAmong(req.payload, reader.id, ids) : [] })
}

// ─── Clerk's webhook ─────────────────────────────────────────────────────────

const WEBHOOK_TOLERANCE_S = 5 * 60

/**
 * Check a Svix signature (Clerk sends its webhooks through Svix): HMAC-SHA256,
 * keyed with the base64 part of `whsec_…`, over `${id}.${timestamp}.${body}`,
 * compared with every `v1,…` signature in the header, timestamp within 5 minutes.
 */
export function verifyClerkWebhook(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers
  if (!secret || !id || !timestamp || !signature) return false
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > WEBHOOK_TOLERANCE_S) return false
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')
  return signature
    .split(' ')
    .map((part) => part.split(',', 2))
    .some(([version, sig]) => version === 'v1' && !!sig && sameSecret(sig, expected))
}

type ClerkUser = {
  id?: string
  created_at?: number | null
  first_name?: string | null
  last_name?: string | null
  username?: string | null
  image_url?: string | null
  primary_email_address_id?: string | null
  email_addresses?: Array<{
    id?: string
    email_address?: string
    verification?: { status?: string } | null
  }>
}

/** A Clerk user (webhook payload) as a reader profile. */
export function profileFromClerk(user: ClerkUser): ReaderProfile | null {
  if (!isClerkId(user.id)) return null
  const primary =
    user.email_addresses?.find((e) => e.id === user.primary_email_address_id) ??
    user.email_addresses?.[0]
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
  return {
    clerkId: user.id,
    email: primary?.email_address ?? null,
    emailVerified: primary?.verification?.status === 'verified',
    displayName: name || user.username || null,
    username: user.username ?? null,
    firstName: user.first_name ?? null,
    imageUrl: user.image_url ?? null,
    createdAt: typeof user.created_at === 'number' ? new Date(user.created_at).toISOString() : null,
  }
}

export const clerkWebhookHandler: PayloadHandler = async (req) => {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) return json({ error: 'webhook not configured' }, 503)
  const body = (await req.text?.()) ?? ''
  const ok = verifyClerkWebhook(
    secret,
    {
      id: req.headers.get('svix-id'),
      timestamp: req.headers.get('svix-timestamp'),
      signature: req.headers.get('svix-signature'),
    },
    body,
  )
  if (!ok) return json({ error: 'bad signature' }, 401)

  let event: { type?: string; data?: ClerkUser }
  try {
    event = JSON.parse(body)
  } catch {
    return json({ error: 'bad json' }, 400)
  }

  if (event.type === 'user.deleted') {
    if (isClerkId(event.data?.id)) await deleteReader(req.payload, event.data.id)
    return json({ ok: true })
  }
  if (event.type === 'user.created' || event.type === 'user.updated') {
    const profile = event.data ? profileFromClerk(event.data) : null
    if (profile) await upsertReader(req.payload, profile)
    return json({ ok: true })
  }
  // Other events: acknowledged, ignored (Clerk retries anything that isn't a 2xx).
  return json({ ok: true, ignored: event.type ?? null })
}
