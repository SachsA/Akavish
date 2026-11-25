import { NextRequest } from 'next/server'
import { fetchNotifySettings, saveNotifySettings } from '@/lib/readers'
import { asReader, reply } from '@/lib/reader-route'

// What followed teams, events and matches notify the reader of (/account →
// Preferences): match starts, results, news and transfers. All on by default.
//
//   GET  /api/notify-settings            → { matchStart, results, news }
//   POST /api/notify-settings { settings } → the same, saved

export async function GET(req: NextRequest) {
  return asReader(req, { bucket: 'notify-settings', limit: 30, needProfile: false }, async ({ clerkId }) =>
    reply(await fetchNotifySettings(clerkId))
  )
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { settings?: Record<string, unknown> }
  return asReader(req, { bucket: 'notify-settings', limit: 30, needProfile: false }, async ({ clerkId }) => {
    const s = body.settings ?? {}
    return reply(
      await saveNotifySettings(clerkId, {
        matchStart: s.matchStart !== false,
        results: s.results !== false,
        news: s.news !== false,
      })
    )
  })
}
