// ─── Date groups for section pages ───────────────────────────────────────────
// A section page used to be one long grid. Splitting it under date headings
// ("Today", "Yesterday", "Tuesday, November 10") makes it read like a news
// feed. Conferences are a few per year, so they group by year instead.
//
// Dates are taken in UTC, like the dates on the cards, so a server in another
// zone renders the same headings.

export type DateUnit = 'day' | 'year'

export type DateGroup<T> = { key: string; label: string; items: T[] }

const DAY_MS = 24 * 60 * 60 * 1000

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function dayLabel(d: Date, now: Date): string {
  const diff = Math.round((Date.parse(dayKey(now)) - Date.parse(dayKey(d))) / DAY_MS)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    // The year only when it isn't this one.
    ...(d.getUTCFullYear() === now.getUTCFullYear() ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  })
}

/**
 * Splits items (already sorted newest first) into consecutive date groups.
 * Items without a date go in a last "Undated" group.
 */
export function groupByDate<T extends { publishedAt?: string }>(
  items: T[],
  unit: DateUnit = 'day',
  now: Date = new Date(),
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
    else groups.push({ key, label: unit === 'year' ? key : dayLabel(d, now), items: [item] })
  }
  if (undated.length) groups.push({ key: 'undated', label: 'Undated', items: undated })
  return groups
}
