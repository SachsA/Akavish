// ─── Clock helpers (Paris time) ──────────────────────────────────────────────
// Pure. The server runs in UTC; the digests follow Paris time, summer and
// winter, so the hour is computed with the IANA zone rather than an offset.

const ZONE = 'Europe/Paris'

/** Paris date and hour for an instant, e.g. { date: '2026-11-10', hour: 20 }. */
export function parisClock(now: Date): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}

export type DigestSlot = 'morning' | 'evening'

/**
 * Which digest is due now, if any: the 8 am one between 8:00 and 19:59, the
 * 8 pm one from 20:00, each once per Paris day. A server that was down at
 * 8:00 sends the morning digest late rather than never; one that comes back
 * after 20:00 sends only the evening digest (it covers everything pending).
 */
export function dueDigest(
  now: Date,
  last: { morning?: string | null; evening?: string | null },
): DigestSlot | null {
  const { date, hour } = parisClock(now)
  if (hour >= 20) return last.evening === date ? null : 'evening'
  if (hour >= 8) return last.morning === date ? null : 'morning'
  return null
}

/** Whether a source is due for a fetch: every 5 min (fast) or 15 (normal), 30 s of slack. */
export function isDue(
  lastFetchedAt: Date | null | undefined,
  cadence: 'fast' | 'normal',
  now: Date,
): boolean {
  if (!lastFetchedAt) return true
  const every = (cadence === 'fast' ? 5 : 15) * 60_000
  return now.getTime() - lastFetchedAt.getTime() >= every - 30_000
}

/** First instant of the current UTC month and day, for the budget sums. */
export function periodStarts(now: Date): { month: Date; day: Date } {
  return {
    month: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    day: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
  }
}
