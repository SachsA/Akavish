// ─── Newsletter sign-up (double opt-in) ──────────────────────────────────────
// The logic behind the three public endpoints mounted in payload.config.ts:
//
//   POST /api/newsletter/subscribe    { email, consent: true, source? }
//   POST /api/newsletter/confirm      { token }
//   POST /api/newsletter/unsubscribe  { token }
//
// The web calls them from its own route (/api/newsletter, rate-limited per IP)
// and pages (/newsletter/confirm, /newsletter/unsubscribe). Nothing here needs
// an editor login: they act through the local API with access overridden.
//
// Privacy rules this file is the proof of (the privacy policy states them):
// - nobody is subscribed without clicking the link sent to the address;
// - "subscribe" answers the same whether the address is new, pending or
//   already confirmed, so it can't be used to check who's subscribed;
// - unsubscribing deletes the row; unconfirmed rows go after 30 days;
// - the confirmation token is stored hashed.
//
// Two kinds of link:
// - confirm: a random token, emailed once, stored as a SHA-256 hash;
// - unsubscribe: `<id>.<HMAC of the id>` signed with PAYLOAD_SECRET, so every
//   future issue can carry a working link without storing anything. Rotating
//   PAYLOAD_SECRET invalidates the unsubscribe links already sent (the list
//   itself is unaffected); people can still write to privacy@.

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Payload, PayloadHandler } from 'payload'
import {
  newsletterConfirmHTML,
  newsletterConfirmSubject,
  newsletterConfirmText,
} from './emails/newsletter-confirm'

/** Unconfirmed sign-ups older than this are deleted. */
export const PENDING_TTL_MS = 30 * 24 * 60 * 60 * 1000
/**
 * A new confirmation email goes out at most this often per address, so the
 * form can't be used to flood someone's inbox (the web's per-IP limit doesn't
 * cover calls made straight to the CMS).
 */
export const RESEND_COOLDOWN_MS = 10 * 60 * 1000

const MAX_EMAIL_LENGTH = 254 // RFC 5321
// Deliberately loose: one @, no spaces, a dot in the domain. The confirmation
// email is the real check.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return null
  return EMAIL_RE.test(email) ? email : null
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function newToken(): string {
  return randomBytes(32).toString('base64url')
}

function siteUrl(): string {
  return (process.env.WEB_URL || 'http://localhost:3000').replace(/\/+$/, '')
}

function sign(id: string | number): string {
  return createHmac('sha256', process.env.PAYLOAD_SECRET || '')
    .update(`newsletter-unsubscribe:${id}`)
    .digest('base64url')
}

/** Token for a subscriber's unsubscribe link (see the header comment). */
export function unsubscribeToken(id: string | number): string {
  return `${id}.${sign(id)}`
}

/** The subscriber id an unsubscribe token was signed for, or null if it's forged or malformed. */
export function verifyUnsubscribeToken(token: unknown): string | null {
  if (typeof token !== 'string' || token.length > 200) return null
  const [id, signature, extra] = token.split('.')
  if (!id || !signature || extra !== undefined || !/^\d+$/.test(id)) return null
  const expected = Buffer.from(sign(id))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given) ? id : null
}

export function unsubscribeUrl(id: string | number): string {
  return `${siteUrl()}/newsletter/unsubscribe?token=${encodeURIComponent(unsubscribeToken(id))}`
}

export function confirmUrl(token: string): string {
  return `${siteUrl()}/newsletter/confirm?token=${encodeURIComponent(token)}`
}

/** Delete unconfirmed sign-ups past their 30 days. Cheap; run on each sign-up. */
export async function purgeExpiredPending(payload: Payload, now = Date.now()) {
  await payload.delete({
    collection: 'subscribers',
    where: {
      and: [
        { status: { equals: 'pending' } },
        { createdAt: { less_than: new Date(now - PENDING_TTL_MS).toISOString() } },
      ],
    },
    overrideAccess: true,
  })
}

export type SubscribeResult =
  | { ok: true; emailed: boolean }
  | { ok: false; error: 'invalid-email' | 'consent-required' | 'send-failed' }

/**
 * Register a sign-up and send the confirmation email. `emailed` says whether an
 * email actually went out (false for confirmed addresses and inside the
 * cooldown); callers must NOT show it to the visitor, only log it.
 */
export async function subscribe(
  payload: Payload,
  input: { email: unknown; consent: unknown; source?: unknown },
  now = Date.now(),
): Promise<SubscribeResult> {
  const email = normalizeEmail(input.email)
  if (!email) return { ok: false, error: 'invalid-email' }
  if (input.consent !== true) return { ok: false, error: 'consent-required' }
  const source = typeof input.source === 'string' ? input.source.slice(0, 32) : undefined

  await purgeExpiredPending(payload, now)

  const { docs } = await payload.find({
    collection: 'subscribers',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  const existing = docs[0]

  if (existing?.status === 'confirmed') return { ok: true, emailed: false }
  if (
    existing?.confirmationSentAt &&
    now - new Date(existing.confirmationSentAt).getTime() < RESEND_COOLDOWN_MS
  ) {
    return { ok: true, emailed: false }
  }

  const token = newToken()
  const stamp = new Date(now).toISOString()
  const data = { tokenHash: hashToken(token), consentAt: stamp, ...(source ? { source } : {}) }
  const doc = existing
    ? await payload.update({
        collection: 'subscribers',
        id: existing.id,
        data,
        overrideAccess: true,
      })
    : await payload.create({
        collection: 'subscribers',
        data: { email, status: 'pending', ...data },
        overrideAccess: true,
      })

  try {
    const url = confirmUrl(token)
    await payload.sendEmail({
      to: email,
      subject: newsletterConfirmSubject(),
      html: newsletterConfirmHTML(url),
      text: newsletterConfirmText(url),
    })
  } catch (err) {
    payload.logger.error(`[newsletter] confirmation email failed: ${String(err)}`)
    return { ok: false, error: 'send-failed' }
  }

  // Only after a successful send, so a failed attempt doesn't start the cooldown.
  await payload.update({
    collection: 'subscribers',
    id: doc.id,
    data: { confirmationSentAt: stamp },
    overrideAccess: true,
  })
  return { ok: true, emailed: true }
}

async function findByToken(payload: Payload, token: unknown) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null
  const { docs } = await payload.find({
    collection: 'subscribers',
    where: { tokenHash: { equals: hashToken(token) } },
    limit: 1,
    overrideAccess: true,
  })
  return docs[0] ?? null
}

/**
 * `confirmed` also when the link is clicked twice, with the subscriber's
 * unsubscribe token (the confirmation page offers the link straight away).
 * `invalid` for unknown or expired links.
 */
export async function confirm(
  payload: Payload,
  token: unknown,
  now = Date.now(),
): Promise<{ result: 'confirmed'; unsubscribeToken: string } | { result: 'invalid' }> {
  const sub = await findByToken(payload, token)
  if (!sub) return { result: 'invalid' }
  if (sub.status !== 'confirmed') {
    await payload.update({
      collection: 'subscribers',
      id: sub.id,
      data: { status: 'confirmed', confirmedAt: new Date(now).toISOString() },
      overrideAccess: true,
    })
  }
  return { result: 'confirmed', unsubscribeToken: unsubscribeToken(sub.id) }
}

/** Deletes the subscriber. `invalid` for a forged token or someone already gone. */
export async function unsubscribe(
  payload: Payload,
  token: unknown,
): Promise<'unsubscribed' | 'invalid'> {
  const id = verifyUnsubscribeToken(token)
  if (!id) return 'invalid'
  const { docs } = await payload.find({
    collection: 'subscribers',
    where: { id: { equals: Number(id) } },
    limit: 1,
    overrideAccess: true,
  })
  if (!docs[0]) return 'invalid'
  await payload.delete({ collection: 'subscribers', id: docs[0].id, overrideAccess: true })
  return 'unsubscribed'
}

// ─── REST handlers ───────────────────────────────────────────────────────────

async function readJson(req: Parameters<PayloadHandler>[0]): Promise<Record<string, unknown>> {
  try {
    const body = req.json ? await req.json() : null
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const noStore = { 'Cache-Control': 'no-store' }

export const subscribeHandler: PayloadHandler = async (req) => {
  const body = await readJson(req)
  const result = await subscribe(req.payload, {
    email: body.email,
    consent: body.consent,
    source: body.source,
  })
  if (result.ok) {
    req.payload.logger.info({ msg: '[newsletter] sign-up', emailed: result.emailed })
    return Response.json({ ok: true }, { headers: noStore })
  }
  const status = result.error === 'send-failed' ? 503 : 400
  return Response.json({ ok: false, error: result.error }, { status, headers: noStore })
}

export const confirmHandler: PayloadHandler = async (req) => {
  const { token } = await readJson(req)
  const outcome = await confirm(req.payload, token)
  return Response.json(
    { ok: outcome.result === 'confirmed', ...outcome },
    { status: outcome.result === 'confirmed' ? 200 : 404, headers: noStore },
  )
}

export const unsubscribeHandler: PayloadHandler = async (req) => {
  const { token } = await readJson(req)
  const result = await unsubscribe(req.payload, token)
  return Response.json(
    { ok: result === 'unsubscribed', result },
    { status: result === 'unsubscribed' ? 200 : 404, headers: noStore },
  )
}
