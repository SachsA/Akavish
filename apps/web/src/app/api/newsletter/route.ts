import { NextRequest, NextResponse } from 'next/server'
import { log } from '@/lib/log'
import { isPlausibleEmail, subscribeToNewsletter, type SignupSource } from '@/lib/newsletter'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'

// Newsletter sign-up from the site's forms (components/NewsletterSignup.tsx).
// The CMS does the real work (double opt-in, see lib/newsletter.ts); this route
// adds a per-IP limit and a honeypot, so a bot can't use the form to send
// confirmation emails to a list of strangers.

const NO_STORE = { 'Cache-Control': 'no-store' }

// `code` lets the form show the error in the page's language
// (lib/i18n/messages `newsletter.errors`); `message` stays English for the app.
const MESSAGES: Record<string, string> = {
  'invalid-request': 'Invalid request.',
  'invalid-email': 'Enter a valid email address.',
  consent: 'Tick the box to agree to receive the newsletter.',
  unavailable: "Couldn't sign you up right now. Try again in a few minutes.",
}

function reply(status: number, code?: string) {
  const body = status === 200 ? { ok: true } : { ok: false, code, message: code ? MESSAGES[code] : undefined }
  return NextResponse.json(body, {
    status,
    headers: NO_STORE,
  })
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(`newsletter:${clientIp(req)}`, 5, 60_000)
  if (!limited.ok) {
    log.warn('rate limited', { route: '/api/newsletter' })
    return tooManyRequests(limited.retryAfter)
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return reply(400, 'invalid-request')

  // Honeypot: a field hidden from people. Bots fill it; answer as if it worked
  // so they don't learn to skip it.
  if (typeof body.website === 'string' && body.website !== '') {
    log.info('newsletter: honeypot hit')
    return reply(200)
  }

  const email = typeof body.email === 'string' ? body.email : ''
  if (!isPlausibleEmail(email)) return reply(400, 'invalid-email')
  if (body.consent !== true) return reply(400, 'consent')
  const source: SignupSource = body.source === 'article' ? 'article' : 'footer'

  const outcome = await subscribeToNewsletter({ email, consent: true, source })
  switch (outcome) {
    case 'ok':
      return reply(200)
    case 'invalid-email':
      return reply(400, 'invalid-email')
    case 'consent-required':
      return reply(400, 'consent')
    default:
      return reply(503, 'unavailable')
  }
}
