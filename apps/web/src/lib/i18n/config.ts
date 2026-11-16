// ─── Languages ───────────────────────────────────────────────────────────────
// English lives at the root (`/news`), French under `/fr` (`/fr/news`). Same
// slugs in both, so switching language is just adding or removing `/fr`.
//
// English has two date styles, picked in the language menu (🇬🇧 / 🇺🇸): the
// text is the same, only dates change ("16 Nov 2026" / "Nov 16, 2026"). That
// choice is a cookie, not a URL: two English URLs per page would be duplicate
// content for search engines.
//
// Pure: no React, no Next. Used by the proxy, server and client components.

export const LOCALES = ['en', 'fr'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'

export const REGIONS = ['US', 'GB'] as const
export type Region = (typeof REGIONS)[number]
export const DEFAULT_REGION: Region = 'US'

/** Cookie holding the reader's language (`en` / `fr`), set by the menu or on the first visit. */
export const LOCALE_COOKIE = 'NEXT_LOCALE'
/** Cookie holding the English date style (`US` / `GB`). */
export const REGION_COOKIE = 'akavish-region'
/** One year: a language choice sticks. */
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

export function isRegion(value: unknown): value is Region {
  return typeof value === 'string' && (REGIONS as readonly string[]).includes(value)
}

/**
 * Paths that are the same in every language: API routes, files (`/feed.xml`,
 * `/sitemap.xml`, icons) and the framework's own.
 */
export function isSharedPath(path: string): boolean {
  const first = path.split(/[/?#]/)[1] ?? ''
  return first.includes('.') || ['api', 'monitoring', '_next', '_vercel'].includes(first)
}

/** `/news` in `fr` → `/fr/news`; in `en` it stays `/news`. Leaves absolute URLs, anchors and shared paths alone. */
export function localizePath(locale: Locale, path: string): string {
  if (!path.startsWith('/') || path.startsWith('//') || isSharedPath(path)) return path
  const bare = stripLocale(path)
  if (locale === DEFAULT_LOCALE) return bare
  return bare === '/' ? `/${locale}` : `/${locale}${bare.startsWith('/?') ? bare.slice(1) : bare}`
}

/** `/fr/news?page=2` → `/news?page=2`, `/fr` → `/`. Unprefixed paths are returned as is. */
export function stripLocale(path: string): string {
  for (const l of LOCALES) {
    if (path === `/${l}`) return '/'
    if (path.startsWith(`/${l}/`) || path.startsWith(`/${l}?`) || path.startsWith(`/${l}#`)) {
      const rest = path.slice(l.length + 1)
      return rest.startsWith('/') ? rest : `/${rest}`
    }
  }
  return path
}

/** The language a path is in: `/fr/...` → `fr`, anything else → `en`. */
export function localeOfPath(path: string): Locale {
  const first = path.split(/[/?#]/)[1]
  return isLocale(first) ? first : DEFAULT_LOCALE
}

/**
 * The reader's preferred language and English date style from an
 * `Accept-Language` header ("fr-FR,fr;q=0.9,en;q=0.8"). The first supported
 * language by weight wins; English defaults to US dates, except for the
 * English variants that write day-month (en-GB, en-IE, en-AU, en-NZ, en-IN,
 * en-ZA). Nothing usable → null (crawlers usually send no header).
 */
export function fromAcceptLanguage(
  header: string | null | undefined,
): { locale: Locale; region: Region } | null {
  if (!header) return null
  const entries = header
    .split(',')
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      const weight = q ? Number(q.slice(2)) : 1
      return { tag: tag.trim().toLowerCase(), weight: Number.isFinite(weight) ? weight : 0, i }
    })
    .filter((e) => e.tag && e.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.i - b.i)
  for (const { tag } of entries) {
    const [lang, country] = tag.split('-')
    if (lang === 'fr') return { locale: 'fr', region: DEFAULT_REGION }
    if (lang === 'en') {
      const dayFirst = ['gb', 'uk', 'ie', 'au', 'nz', 'in', 'za']
      return { locale: 'en', region: country && dayFirst.includes(country) ? 'GB' : 'US' }
    }
  }
  return null
}

/** BCP 47 tag for dates and `<html lang>`: en-US, en-GB, fr-FR. */
export function intlTag(locale: Locale, region: Region = DEFAULT_REGION): string {
  return locale === 'fr' ? 'fr-FR' : region === 'GB' ? 'en-GB' : 'en-US'
}

/** Open Graph locale: en_US / fr_FR. */
export function ogLocale(locale: Locale): string {
  return locale === 'fr' ? 'fr_FR' : 'en_US'
}
