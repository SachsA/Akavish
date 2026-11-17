// ─── Game releases ───────────────────────────────────────────────────────────
// A game has one row per release: the consoles it came out on together, the
// date and how precise that date is (Games.releases). From those rows the
// Games hook derives the game's consoles and its first release date, which
// the site sorts and filters on. The scout merges what a news story says into
// the rows (mergeReleases). Pure, unit-tested.

import { DATE_PRECISIONS, PLATFORM_VALUES, type DatePrecision, type Platform } from './platforms'

export interface Release {
  platforms: Platform[]
  /** ISO date: the day, or the first day of the month / quarter / year. Null when TBA. */
  date: string | null
  precision: DatePrecision
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * "2026-11-19" → day, "2026-11" → month, "2026-Q4" → quarter, "2026" → year,
 * "TBA" (or anything empty) → tba. Returns null for anything else.
 */
export function parseReleaseDate(text: string | null | undefined): Pick<Release, 'date' | 'precision'> | null {
  const s = (text ?? '').trim().toUpperCase()
  if (!s || s === 'TBA' || s === 'TBD') return { date: null, precision: 'tba' }
  let m = s.match(DAY)
  if (m && valid(+m[1], +m[2], +m[3])) return { date: iso(+m[1], +m[2], +m[3]), precision: 'day' }
  m = s.match(/^(\d{4})-(\d{2})$/)
  if (m && valid(+m[1], +m[2], 1)) return { date: iso(+m[1], +m[2], 1), precision: 'month' }
  m = s.match(/^(\d{4})-Q([1-4])$/)
  if (m) return { date: iso(+m[1], (+m[2] - 1) * 3 + 1, 1), precision: 'quarter' }
  m = s.match(/^(\d{4})$/)
  if (m && +m[1] >= 1970 && +m[1] <= 2100) return { date: iso(+m[1], 1, 1), precision: 'year' }
  return null
}

function valid(y: number, mo: number, d: number): boolean {
  if (y < 1970 || y > 2100 || mo < 1 || mo > 12 || d < 1) return false
  return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate()
}
const iso = (y: number, mo: number, d: number) =>
  `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** The first and last day a release can fall on (null for TBA). */
export function period(r: Pick<Release, 'date' | 'precision'>): [string, string] | null {
  if (r.precision === 'tba' || !r.date) return null
  const [y, mo, d] = r.date.slice(0, 10).split('-').map(Number)
  const end = (yy: number, mm: number) => iso(yy, mm, new Date(Date.UTC(yy, mm, 0)).getUTCDate())
  switch (r.precision) {
    case 'day':
      return [iso(y, mo, d), iso(y, mo, d)]
    case 'month':
      return [iso(y, mo, 1), end(y, mo)]
    case 'quarter': {
      const q0 = Math.floor((mo - 1) / 3) * 3 + 1
      return [iso(y, q0, 1), end(y, q0 + 2)]
    }
    default:
      return [iso(y, 1, 1), iso(y, 12, 31)]
  }
}

/** Rows as stored → clean rows (known consoles only, valid precision, date only when not TBA). */
export function cleanReleases(rows: unknown): Release[] {
  if (!Array.isArray(rows)) return []
  return rows.flatMap((row) => {
    const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
    const platforms = [
      ...new Set((Array.isArray(r.platforms) ? r.platforms : []).filter((p): p is Platform =>
        PLATFORM_VALUES.includes(p as Platform),
      )),
    ]
    const precision = DATE_PRECISIONS.includes(r.precision as DatePrecision)
      ? (r.precision as DatePrecision)
      : r.date
        ? 'day'
        : 'tba'
    const date = precision !== 'tba' ? dayOf(r.date) : null
    return [{ platforms, date, precision: date ? precision : 'tba' }]
  })
}

/**
 * The calendar day of a stored date. The admin's date picker saves midnight
 * (or noon) in the editor's time zone, so "19 Nov" from Paris arrives as
 * 2026-11-18T23:00Z: the nearest UTC day is the one meant.
 */
function dayOf(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null
  if (DAY.test(v)) return v
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : new Date(t + 12 * 3600_000).toISOString().slice(0, 10)
}

const byDate = (a: Release, b: Release) =>
  (a.date ?? '9999') < (b.date ?? '9999') ? -1 : (a.date ?? '9999') > (b.date ?? '9999') ? 1 : 0

/**
 * What the game shows and is sorted on: every console of its releases, and
 * its first known date (TBA when none).
 */
export function summarize(releases: Release[]): {
  platforms: Platform[]
  releaseDate: string | null
  releaseDatePrecision: DatePrecision | null
} {
  const platforms = PLATFORM_VALUES.filter((p) => releases.some((r) => r.platforms.includes(p)))
  const first = [...releases].sort(byDate).find((r) => r.date)
  return {
    platforms,
    releaseDate: first?.date ? `${first.date}T00:00:00.000Z` : null,
    releaseDatePrecision: first ? first.precision : releases.length ? 'tba' : null,
  }
}

/**
 * Fold what a news story says into a game's releases. Per console, the news
 * wins: a delay or a date replaces that console's row, a new console adds
 * one. A release without consoles ("delayed to 2027") moves the game's
 * releases that aren't out yet. A vaguer date that agrees with the known one
 * ("out in 2026" when the day is known) changes nothing. Pure.
 */
export function mergeReleases(current: Release[], incoming: Release[], today: string): Release[] {
  let out = current.map((r) => ({ ...r, platforms: [...r.platforms] }))
  const vaguer = (inc: Release, known: Release) => {
    const p = period(inc)
    const k = period(known)
    if (!k) return false
    if (!p) return true // TBA never replaces a date
    return p[0] <= k[0] && k[1] <= p[1] && (p[1] > k[1] || p[0] < k[0] || inc.precision === known.precision)
  }
  for (const inc of incoming) {
    if (inc.platforms.length === 0) {
      const pending = out.filter((r) => !r.date || r.date > today)
      if (pending.length === 0) {
        if (out.length === 0) out.push({ ...inc })
        continue
      }
      for (const r of pending) {
        if (vaguer(inc, r)) continue
        r.date = inc.date
        r.precision = inc.precision
      }
      continue
    }
    const known = out.filter((r) => r.platforms.some((p) => inc.platforms.includes(p)))
    if (known.length && known.every((r) => vaguer(inc, r))) {
      // Same news, less precise: keep what we know. Consoles it adds go on as their own row.
      const extra = inc.platforms.filter((p) => !out.some((r) => r.platforms.includes(p)))
      if (extra.length) out.push({ ...inc, platforms: extra })
      continue
    }
    // Those consoles move to the news' date; a row left without consoles (or
    // one that never had any: "consoles unknown") goes.
    for (const r of out) r.platforms = r.platforms.filter((p) => !inc.platforms.includes(p))
    out = out.filter((r) => r.platforms.length > 0)
    // Rows with the same date and precision become one.
    const same = out.find((r) => r.date === inc.date && r.precision === inc.precision)
    if (same) same.platforms = PLATFORM_VALUES.filter((p) => same.platforms.includes(p) || inc.platforms.includes(p))
    else out.push({ ...inc, platforms: [...inc.platforms] })
  }
  return out.sort(byDate)
}
