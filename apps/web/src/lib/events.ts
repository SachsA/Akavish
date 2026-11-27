// ─── The events calendar (/conferences/calendar) ─────────────────────────────
// The industry's events from the CMS (collections/Events.ts): showcases,
// awards, expos, developer conferences. On now, upcoming (soonest first) and
// past (latest first, with the Akavish recap when there is one). Pure: the
// page renders it, the browser only formats the times in the reader's zone.

export type EventKind = 'showcase' | 'awards' | 'expo' | 'conference' | 'other'

export interface CalendarEvent {
  slug: string
  name: string
  kind: EventKind
  /** ISO start; only the date counts when `timeKnown` is false. */
  startAt: string
  timeKnown: boolean
  /** Last day of a multi-day event (ISO), else null. */
  endAt: string | null
  location: string | null
  streamUrl: string | null
  officialUrl: string | null
  summary: string | null
  summaryFr: string | null
  /** The Akavish recap. */
  article: { slug: string; title: string; titleFr: string | null } | null
}

const HOUR = 3600_000
const DAY = 24 * HOUR
/** A show without an end is "on now" for this long after it starts. */
export const SHOW_LENGTH = 4 * HOUR

/** When the event is over: the end of its last day, else start + 4 h (a whole day without a time). */
export function endsAt(e: CalendarEvent): number {
  if (e.endAt) return Date.parse(e.endAt.slice(0, 10) + 'T00:00:00Z') + DAY + 12 * HOUR
  const start = Date.parse(e.startAt)
  return e.timeKnown ? start + SHOW_LENGTH : Date.parse(e.startAt.slice(0, 10) + 'T00:00:00Z') + DAY + 12 * HOUR
}

/** When it starts, for the "on now" test: a date-only event from its morning anywhere (UTC-12). */
function startsAt(e: CalendarEvent): number {
  return e.timeKnown ? Date.parse(e.startAt) : Date.parse(e.startAt.slice(0, 10) + 'T00:00:00Z') - 12 * HOUR
}

export function splitEvents(
  events: CalendarEvent[],
  now: number,
): { live: CalendarEvent[]; upcoming: CalendarEvent[]; past: CalendarEvent[] } {
  const live: CalendarEvent[] = []
  const upcoming: CalendarEvent[] = []
  const past: CalendarEvent[] = []
  for (const e of events) {
    if (endsAt(e) < now) past.push(e)
    else if (startsAt(e) <= now) live.push(e)
    else upcoming.push(e)
  }
  const byStart = (a: CalendarEvent, b: CalendarEvent) => Date.parse(a.startAt) - Date.parse(b.startAt)
  return { live: live.sort(byStart), upcoming: upcoming.sort(byStart), past: past.sort((a, b) => byStart(b, a)) }
}

/** "2026-12": the month of an event, for the headings (UTC: dates are days, not instants). */
export function monthKey(e: CalendarEvent): string {
  return e.startAt.slice(0, 7)
}

/** Consecutive events of the same month together, in the list's order. */
export function groupByMonth(events: CalendarEvent[]): Array<{ month: string; events: CalendarEvent[] }> {
  const out: Array<{ month: string; events: CalendarEvent[] }> = []
  for (const e of events) {
    const m = monthKey(e)
    const last = out[out.length - 1]
    if (last && last.month === m) last.events.push(e)
    else out.push({ month: m, events: [e] })
  }
  return out
}

/** YYYY-MM-DD of an instant in a time zone. */
const dayIn = (ms: number, tz: string) => new Date(ms).toLocaleDateString('en-CA', { timeZone: tz })

/**
 * Whole days from today to the start, both in the reader's zone ("in 13 days"
 * in New York for The Game Awards on Dec 10 at 8 pm, already Dec 11 in UTC);
 * 0 today. A date-only event is that calendar day wherever you are.
 */
export function daysUntil(e: CalendarEvent, now: number, tz = 'UTC'): number {
  const start = e.timeKnown ? dayIn(Date.parse(e.startAt), tz) : e.startAt.slice(0, 10)
  const today = dayIn(now, tz)
  return Math.max(0, Math.round((Date.parse(`${start}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY))
}

/** Only an http(s) link is shown. */
export function safeUrl(u: unknown): string | null {
  if (typeof u !== 'string') return null
  const s = u.trim()
  return /^https?:\/\/\S+$/i.test(s) ? s : null
}
