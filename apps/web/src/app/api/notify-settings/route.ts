import { NextRequest } from 'next/server'
import { fetchNotifySettings, saveNotifySettings, type NotifySettings } from '@/lib/readers'
import { asReader, reply } from '@/lib/reader-route'

// What followed teams, events and matches notify the reader of (/account →
// Preferences): match starts, results, news and transfers. All on by default.
//
//   GET  /api/notify-settings            → { matchStart, results, news, hideScores, spoilerPrefs }
//   POST /api/notify-settings { settings } → the same, saved

export async function GET(req: NextRequest) {
  return asReader(req, { bucket: 'notify-settings', limit: 30, needProfile: false }, async ({ clerkId }) =>
    reply(await fetchNotifySettings(clerkId))
  )
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { settings?: Record<string, unknown> }
  return asReader(req, { bucket: 'notify-settings', limit: 30, needProfile: false }, async ({ clerkId }) => {
    // Only what is sent changes: Preferences sends the three switches, the
    // anti-spoil default hideScores, "What to hide" spoilerPrefs.
    const s = body.settings ?? {}
    const keys = ['matchStart', 'results', 'news', 'hideScores'] as const
    const settings: Partial<NotifySettings> = Object.fromEntries(
      keys.filter((k) => typeof s[k] === 'boolean').map((k) => [k, s[k] as boolean])
    )
    // "What to hide" (lib/spoilers.ts): the CMS cleans it.
    if (s.spoilerPrefs && typeof s.spoilerPrefs === 'object') settings.spoilerPrefs = s.spoilerPrefs
    return reply(await saveNotifySettings(clerkId, settings))
  })
}
