// ─── Date groups for section pages ───────────────────────────────────────────
// A section page used to be one long grid. Splitting it under date headings
// ("Today", "Yesterday", "Tuesday, November 10") makes it read like a news
// feed. A quiet section (reviews, previews: a few a week) groups by month
// instead, or each day heading holds a single card (`autoUnit`). Conferences
// are a few per year, so they group by year.
//
// Dates are taken in UTC, like the dates on the cards, so a server in another
// zone renders the same headings. The labels are in the page's language
// (lib/i18n/dates.ts); `date` lets the page re-render a day heading in the
// reader's English date style (<DateText style="day">).

import { formatDate } from './i18n/dates'
import { intlTag } from './i18n/config'
import { messagesFor } from './i18n/messages'
import type { Locale } from './i18n/config'

export type DateUnit = 'day' | 'month' | 'year'

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
    const key = unit === 'year' ? String(d.getUTCFullYear()) : unit === 'month' ? dayKey(d).slice(0, 7) : dayKey(d)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(item)
    else
      groups.push({
        key,
        label:
          unit === 'year'
            ? key
            : unit === 'month'
              ? monthLabel(d, locale)
              : formatDate(d, { locale, style: 'day', now }),
        ...(unit === 'day' ? { date: d.toISOString() } : {}),
        items: [item],
      })
  }
  if (undated.length) {
    groups.push({ key: 'undated', label: messagesFor(locale).dates.undated, items: undated })
  }
  return groups
}

/** "November 2026" / "Novembre 2026". */
function monthLabel(d: Date, locale: Locale): string {
  const s = d.toLocaleDateString(intlTag(locale), { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Day headings while the list is busy (two articles a day or more on
 * average), else month headings: one card under each day looks empty.
 */
export function autoUnit(items: Array<{ publishedAt?: string }>): 'day' | 'month' {
  const days = new Set(items.flatMap((i) => (i.publishedAt ? [i.publishedAt.slice(0, 10)] : [])))
  return days.size > 0 && items.length >= days.size * 2 ? 'day' : 'month'
}
