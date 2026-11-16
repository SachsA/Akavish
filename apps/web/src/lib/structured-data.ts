// Schema.org structured data (JSON-LD) shared by the detail pages.
import { absoluteUrl, SITE_NAME } from './site'
import { localizePath, type Locale } from './i18n/config'

export type Crumb = { name: string; path: string }

/**
 * `BreadcrumbList` for a page, Home first. Google shows it instead of the raw
 * URL in results ("Akavish › Reviews › …"), which reads better than
 * `akavish.gg/article/some-long-slug`.
 */
export function breadcrumbList(crumbs: Crumb[], locale: Locale = 'en') {
  // '' = the bare site URL (absoluteUrl('/') would add a trailing slash).
  const home = locale === 'en' ? '' : localizePath(locale, '/')
  const items = [{ name: SITE_NAME, path: home }, ...crumbs.map((c) => ({ ...c, path: localizePath(locale, c.path) }))]
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  }
}

/**
 * Serialise for a `<script type="application/ld+json">`. `<` is escaped so a
 * title containing `</script>` can't close the tag early.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
