// ─── Date groups for section pages ───────────────────────────────────────────
// A section page used to be one long grid. Splitting it under date headings
// ("Today", "Yesterday", "Tuesday, November 10") makes it read like a news
// feed. Conferences are a few per year, so they group by year instead.
//
// Dates are taken in UTC, like the dates on the cards, so a server in another
// zone renders the same headings. The labels are in the page's language
// (lib/i18n/dates.ts); `date` lets the page re-render a day heading in the
// reader's English date style (<DateText style="day">).

import { formatDate } from './i18n/dates'
import { messagesFor } from './i18n/messages'
import type { Locale } from './i18n/config'

export type DateUnit = 'day' | 'year'

export type DateGroup<T> = { key: string; label: string; date?: string; items: T[] }

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Splits items (already sorted newest first) into consecutive date groups.
 * Items without a date go in a last "Undated" group.
 */
export function groupByDate<T extends { publishedAt?: string }>(
  items: T[],
  unit: DateUnit = 'day',
  now: Date = new Date(),
  locale: Locale = 'en',
): DateGroup<T>[] {
  const groups: DateGroup<T>[] = []
  const undated: T[] = []
  for (const item of items) {
    const d = item.publishedAt ? new Date(item.publishedAt) : null
    if (!d || Number.isNaN(d.getTime())) {
      undated.push(item)
      continue
    }
    const key = unit === 'year' ? String(d.getUTCFullYear()) : dayKey(d)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(item)
    else
      groups.push({
        key,
        label: unit === 'year' ? key : formatDate(d, { locale, style: 'day', now }),
        ...(unit === 'day' ? { date: d.toISOString() } : {}),
        items: [item],
      })
  }
  if (undated.length) {
    groups.push({ key: 'undated', label: messagesFor(locale).dates.undated, items: undated })
  }
  return groups
}
