// ─── Newsletter (web side) ───────────────────────────────────────────────────
// Server-side calls to the CMS's newsletter endpoints
// (apps/cms/src/lib/newsletter.ts, which holds the rules: double opt-in,
// cooldown, deletion on unsubscribe). The web adds the per-IP rate limit
// (app/api/newsletter/route.ts) and the pages readers land on.

import { log } from './log'

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:3001'

/**
 * Same loose check as the CMS (one @, no spaces, a dot in the domain), for an
 * instant error message in the form. The CMS re-checks; the confirmation email
 * is the real test.
 */
export function isPlausibleEmail(value: string): boolean {
  const email = value.trim()
  return email.length > 0 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Where a sign-up came from, stored with the subscriber (admin column). */
export type SignupSource = 'footer' | 'article'

export type SubscribeOutcome = 'ok' | 'invalid-email' | 'consent-required' | 'unavailable'

async function post(path: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(`${CMS_URL}/api/newsletter/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    log.error('newsletter: CMS unreachable', { path, error })
    return null
  }
}

export async function subscribeToNewsletter(input: {
  email: string
  consent: boolean
  source: SignupSource
}): Promise<SubscribeOutcome> {
  const res = await post('subscribe', input)
  if (!res) return 'unavailable'
  if (res.ok) return 'ok'
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (data.error === 'invalid-email' || data.error === 'consent-required') return data.error
  log.error('newsletter: subscribe failed', { status: res.status, error: data.error })
  return 'unavailable'
}

export type ConfirmOutcome =
  | { result: 'confirmed'; unsubscribeToken?: string }
  | { result: 'invalid' }
  /** The CMS couldn't be reached, as opposed to a link that's no longer valid. */
  | { result: 'error' }

export async function confirmSubscription(token: string): Promise<ConfirmOutcome> {
  const res = await post('confirm', { token })
  if (!res) return { result: 'error' }
  if (res.ok) {
    const data = (await res.json().catch(() => ({}))) as { unsubscribeToken?: unknown }
    return {
      result: 'confirmed',
      unsubscribeToken:
        typeof data.unsubscribeToken === 'string' ? data.unsubscribeToken : undefined,
    }
  }
  return { result: res.status === 404 ? 'invalid' : 'error' }
}

export async function unsubscribeFromNewsletter(
  token: string,
): Promise<'unsubscribed' | 'invalid' | 'error'> {
  const res = await post('unsubscribe', { token })
  if (!res) return 'error'
  if (res.ok) return 'unsubscribed'
  return res.status === 404 ? 'invalid' : 'error'
}
