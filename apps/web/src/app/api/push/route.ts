import { NextRequest } from 'next/server'
import { pushCount, pushSubscribe, pushUnsubscribe } from '@/lib/readers'
import { asReader, refuse, reply } from '@/lib/reader-route'

// Web push for the signed-in reader (components/PushToggle.tsx):
//
//   GET    /api/push                                → { count } (browsers with push on)
//   POST   /api/push { subscription, locale }       → { subscribed: true }
//   DELETE /api/push { endpoint }                   → { subscribed: false }
//
// The subscription is the browser's PushSubscription.toJSON(); the CMS checks it.

export async function GET(req: NextRequest) {
  return asReader(req, { bucket: 'push', limit: 30, needProfile: false }, async ({ clerkId }) =>
    reply(await pushCount(clerkId))
  )
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { subscription?: unknown; locale?: unknown }
  return asReader(req, { bucket: 'push', limit: 30, needProfile: false }, async ({ clerkId }) => {
    if (!body.subscription || typeof body.subscription !== 'object') return refuse('not-found', 400)
    await pushSubscribe(clerkId, body.subscription, body.locale === 'fr' ? 'fr' : 'en', req.headers.get('user-agent') ?? '')
    return reply({ subscribed: true })
  })
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { endpoint?: unknown }
  return asReader(req, { bucket: 'push', limit: 30, needProfile: false }, async ({ clerkId }) => {
    if (typeof body.endpoint !== 'string' || !body.endpoint) return refuse('not-found', 400)
    await pushUnsubscribe(clerkId, body.endpoint)
    return reply({ subscribed: false })
  })
}
