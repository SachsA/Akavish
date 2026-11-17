// ─── The games library (/games) ──────────────────────────────────────────────
// Every game on the site with its releases (consoles + date + how precise the
// date is), filtered in the browser: "Switch in 2019", "PS5 in November
// 2027", "upcoming from Ubisoft". A release matches the console, year and
// month filters together, so a 2011 game ported to Switch in 2019 is under
// "Switch, 2019", not under "Switch, 2011". Pure: used by the page and its
// tests.

import { formatDate } from './i18n/dates'
import { intlTag, type Locale, type Region } from './i18n/config'
import { PLATFORM_VALUES, platformInfo } from './platforms'

export type Precision = 'day' | 'month' | 'quarter' | 'year' | 'tba'

export interface Release {
  platforms: string[]
  /** YYYY-MM-DD: the day, or the first day of the month / quarter / year. Null when TBA. */
  date: string | null
  precision: Precision
}

export interface LibraryGame {
  slug: string
  name: string
  cover?: string
  releases: Release[]
  /** Company slugs. */
  developers: string[]
  publishers: string[]
  genres: string[]
}

export interface LibraryCompany {
  slug: string
  name: string
}

export type LibrarySort = 'az' | 'new' | 'old'

export interface LibraryFilters {
  q?: string
  /** A to Z, or "#" (digits and symbols). */
  letter?: string
  platform?: string
  year?: number
  /** 1 to 12, with a year. */
  month?: number
  company?: string
  genre?: string
  status?: 'out' | 'upcoming'
  sort?: LibrarySort
}

// ─── URL ↔ filters ───────────────────────────────────────────────────────────

/** ?platform=ps5&year=2027&month=11… → filters; junk values are dropped. */
export function parseFilters(sp: URLSearchParams): LibraryFilters {
  const f: LibraryFilters = {}
  const q = sp.get('q')?.trim()
  if (q) f.q = q.slice(0, 80)
  const letter = sp.get('letter')?.toUpperCase()
  if (letter && /^([A-Z]|#)$/.test(letter)) f.letter = letter
  const platform = sp.get('platform')
  if (platform && PLATFORM_VALUES.includes(platform)) f.platform = platform
  const year = Number(sp.get('year'))
  if (Number.isInteger(year) && year >= 1970 && year <= 2100) f.year = year
  const month = Number(sp.get('month'))
  if (f.year && Number.isInteger(month) && month >= 1 && month <= 12) f.month = month
  const company = sp.get('company')
  if (company && /^[a-z0-9-]{1,80}$/.test(company)) f.company = company
  const genre = sp.get('genre')
  if (genre && genre.length <= 40) f.genre = genre
  const status = sp.get('status')
  if (status === 'out' || status === 'upcoming') f.status = status
  const sort = sp.get('sort')
  if (sort === 'az' || sort === 'new' || sort === 'old') f.sort = sort
  return f
}

/** Filters → query string (stable order, empty ones left out), "" when none. */
export function filtersToQuery(f: LibraryFilters): string {
  const sp = new URLSearchParams()
  if (f.q) sp.set('q', f.q)
  if (f.letter) sp.set('letter', f.letter)
  if (f.platform) sp.set('platform', f.platform)
  if (f.year) sp.set('year', String(f.year))
  if (f.year && f.month) sp.set('month', String(f.month))
  if (f.company) sp.set('company', f.company)
  if (f.genre) sp.set('genre', f.genre)
  if (f.status) sp.set('status', f.status)
  if (f.sort) sp.set('sort', f.sort)
  const s = sp.toString()
  return s ? `?${s}` : ''
}

/**
 * The order when the reader didn't pick one: by date as soon as they filter
 * on a period or on upcoming games (soonest first), newest first for games
 * that are out, else A to Z.
 */
export function effectiveSort(f: LibraryFilters): LibrarySort {
  if (f.sort) return f.sort
  if (f.status === 'out') return 'new'
  if (f.year || f.status === 'upcoming') return 'old'
  return 'az'
}

// ─── Dates ───────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** First and last day the release can fall on; null for TBA. */
export function period(r: Release): [string, string] | null {
  if (r.precision === 'tba' || !r.date) return null
  const [y, m, d] = r.date.slice(0, 10).split('-').map(Number)
  switch (r.precision) {
    case 'day':
      return [`${y}-${pad(m)}-${pad(d)}`, `${y}-${pad(m)}-${pad(d)}`]
    case 'month':
      return [`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${pad(lastDay(y, m))}`]
    case 'quarter': {
      const q0 = Math.floor((m - 1) / 3) * 3 + 1
      return [`${y}-${pad(q0)}-01`, `${y}-${pad(q0 + 2)}-${pad(lastDay(y, q0 + 2))}`]
    }
    default:
      return [`${y}-01-01`, `${y}-12-31`]
  }
}

/** Out once its last possible day is past ("November 2026" is out in December). */
export function isOut(r: Release, today: string): boolean {
  const p = period(r)
  return !!p && (r.precision === 'day' ? p[0] <= today : p[1] < today)
}

const TBA: Record<Locale, string> = { en: 'TBA', fr: 'Date à venir' }

/** "Nov 19, 2026", "November 2026", "Q4 2026" / "T4 2026", "2026", "TBA" / "Date à venir". */
export function formatRelease(r: Release, locale: Locale, region?: Region): string {
  if (r.precision === 'tba' || !r.date) return TBA[locale]
  const iso = `${r.date.slice(0, 10)}T00:00:00.000Z`
  const [y, m] = r.date.split('-').map(Number)
  switch (r.precision) {
    case 'day':
      return formatDate(iso, { locale, region, style: 'short' })
    case 'month': {
      const s = new Date(iso).toLocaleDateString(intlTag(locale, region), {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
      return s.charAt(0).toUpperCase() + s.slice(1)
    }
    case 'quarter':
      return `${locale === 'fr' ? 'T' : 'Q'}${Math.floor((m - 1) / 3) + 1} ${y}`
    default:
      return String(y)
  }
}

/** The consoles of a release, short names, in the site's order: "PS5, Xbox Series, PC". */
export function formatPlatforms(platforms: readonly string[]): string {
  return PLATFORM_VALUES.filter((p) => platforms.includes(p))
    .map((p) => platformInfo(p)?.short ?? p)
    .join(', ')
}

// ─── Filtering ───────────────────────────────────────────────────────────────

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** First letter without accent, A-Z; anything else (digits, symbols) is "#". */
export function letterOf(name: string): string {
  const c = name.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase()
  return /[A-Z]/.test(c) ? c : '#'
}

/**
 * Does this release fit the console / period / status filters? "exact", or
 * "vague" when only a coarser date is known ("Q4 2027" or "2027" for
 * November 2027: shown apart, under "date to be confirmed").
 */
export function releaseMatch(r: Release, f: LibraryFilters, today: string): 'exact' | 'vague' | null {
  if (f.platform && !r.platforms.includes(f.platform)) return null
  if (f.status === 'out' && !isOut(r, today)) return null
  if (f.status === 'upcoming' && isOut(r, today)) return null
  if (!f.year) return 'exact'
  if (!r.date || r.precision === 'tba') return null
  const [y, m] = r.date.split('-').map(Number)
  if (y !== f.year) return null
  if (!f.month) return 'exact'
  if (r.precision === 'day' || r.precision === 'month') return m === f.month ? 'exact' : null
  if (r.precision === 'quarter') return Math.floor((m - 1) / 3) === Math.floor((f.month - 1) / 3) ? 'vague' : null
  return 'vague'
}

export interface LibraryHit {
  game: LibraryGame
  /** The release to show on the card: the one that matched, else the first. */
  release?: Release
  vague: boolean
}

const firstRelease = (g: LibraryGame) =>
  [...g.releases].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))[0]

/** The games that fit, in the asked order. */
export function filterGames(
  games: LibraryGame[],
  f: LibraryFilters,
  today: string,
  locale: Locale,
): LibraryHit[] {
  const q = f.q ? norm(f.q) : ''
  const byRelease = Boolean(f.platform || f.year || f.status)
  const hits: LibraryHit[] = []
  for (const game of games) {
    if (q && !norm(game.name).includes(q)) continue
    if (f.letter && letterOf(game.name) !== f.letter) continue
    if (f.company && !game.developers.includes(f.company) && !game.publishers.includes(f.company)) continue
    if (f.genre && !game.genres.includes(f.genre)) continue
    if (!byRelease) {
      hits.push({ game, release: firstRelease(game), vague: false })
      continue
    }
    let vague: Release | undefined
    let exact: Release | undefined
    for (const r of [...game.releases].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))) {
      const m = releaseMatch(r, f, today)
      if (m === 'exact' && !exact) exact = r
      if (m === 'vague' && !vague) vague = r
    }
    if (exact) hits.push({ game, release: exact, vague: false })
    else if (vague) hits.push({ game, release: vague, vague: true })
  }
  const sort = effectiveSort(f)
  const name = (a: LibraryHit, b: LibraryHit) => a.game.name.localeCompare(b.game.name, locale)
  const when = (h: LibraryHit) => (h.release?.date ? h.release.date : null)
  return hits.sort((a, b) => {
    if (sort === 'az') return name(a, b)
    const da = when(a)
    const db = when(b)
    // Undated games last either way.
    if (!da || !db) return da ? -1 : db ? 1 : name(a, b)
    return (sort === 'new' ? db.localeCompare(da) : da.localeCompare(db)) || name(a, b)
  })
}

/**
 * Headings for a list sorted by date: "November 2026", "Q4 2026", "2026",
 * "TBA". A heading per period the releases are known to, in the list's order.
 */
export function dateGroupLabel(r: Release | undefined, locale: Locale): string {
  if (!r || r.precision === 'tba' || !r.date) return TBA[locale]
  if (r.precision === 'day') return formatRelease({ ...r, precision: 'month' }, locale)
  return formatRelease(r, locale)
}

/** The years the library spans (for the year menu), newest first. */
export function yearsOf(games: LibraryGame[]): number[] {
  const years = new Set<number>()
  for (const g of games) for (const r of g.releases) if (r.date && r.precision !== 'tba') years.add(Number(r.date.slice(0, 4)))
  return [...years].sort((a, b) => b - a)
}

/** The consoles at least one game is on, in the site's order. */
export function platformsOf(games: LibraryGame[]): string[] {
  const used = new Set(games.flatMap((g) => g.releases.flatMap((r) => r.platforms)))
  return PLATFORM_VALUES.filter((p) => used.has(p))
}
