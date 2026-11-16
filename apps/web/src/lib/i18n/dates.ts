// ─── Dates in the reader's language ──────────────────────────────────────────
// Every date on the site goes through here, so 🇬🇧 / 🇺🇸 / 🇫🇷 stay consistent:
//   short  Nov 16, 2026 · 16 Nov 2026 · 16 nov. 2026
//   long   November 16, 2026 · 16 November 2026 · 16 novembre 2026
//   day    Today · Yesterday · Tuesday, November 10 · Tuesday 10 November ·
//          mardi 10 novembre (year added when it isn't this one)
// In UTC, like before: a server in another zone renders the same dates.
//
// Pure: used on the server and inside <DateText> in the browser.

import { intlTag, type Locale, type Region } from './config'

export type DateStyle = 'short' | 'long' | 'day'

const DAY_MS = 24 * 60 * 60 * 1000
const RELATIVE: Record<Locale, { today: string; yesterday: string }> = {
  en: { today: 'Today', yesterday: 'Yesterday' },
  fr: { today: "Aujourd'hui", yesterday: 'Hier' },
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10)

export function formatDate(
  iso: string | Date | undefined | null,
  { locale, region, style = 'short', now = new Date() }: {
    locale: Locale
    region?: Region
    style?: DateStyle
    now?: Date
  },
): string {
  if (!iso) return ''
  const d = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const tag = intlTag(locale, region)
  if (style === 'day') {
    const diff = Math.round((Date.parse(dayKey(now)) - Date.parse(dayKey(d))) / DAY_MS)
    if (diff === 0) return RELATIVE[locale].today
    if (diff === 1) return RELATIVE[locale].yesterday
    const label = d.toLocaleDateString(tag, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      ...(d.getUTCFullYear() === now.getUTCFullYear() ? {} : { year: 'numeric' }),
      timeZone: 'UTC',
    })
    // French writes "mardi 10 novembre": capitalised as a heading.
    return label.charAt(0).toUpperCase() + label.slice(1)
  }
  return d.toLocaleDateString(tag, {
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
