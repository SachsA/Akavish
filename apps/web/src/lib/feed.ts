// ─── RSS feeds ───────────────────────────────────────────────────────────────
// /feed.xml (English) and /fr/feed.xml (French: the translated articles only,
// in French). The latest 50 published articles.

import type { Locale } from './i18n/config'
import { localizePath } from './i18n/config'
import { isInLanguage } from './i18n/content'
import { messagesFor } from './i18n/messages'
import { fetchArticles } from './payload'
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from './site'

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function feedResponse(locale: Locale): Promise<Response> {
  const t = messagesFor(locale)
  let items = ''
  try {
    const { data: articles } = await fetchArticles({ limit: 50, locale })
    items = articles
      .filter((a) => isInLanguage(a, locale))
      .map((a) => {
        const link = absoluteUrl(localizePath(locale, `/article/${a.slug}`))
        const date = a.publishedAt ?? a.createdAt
        return `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${escapeXml(a.excerpt)}</description>
      <category>${escapeXml(t.categories[a.category]?.singular ?? a.category)}</category>
      <dc:creator>${escapeXml(a.author.name)}</dc:creator>
      <pubDate>${new Date(date).toUTCString()}</pubDate>
    </item>`
      })
      .join('\n')
  } catch {
    // Serve a valid but empty feed if the CMS is unreachable.
    items = ''
  }

  const self = locale === 'en' ? '/feed.xml' : `/${locale}/feed.xml`
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${absoluteUrl(localizePath(locale, '/'))}</link>
    <description>${escapeXml(locale === 'en' ? SITE_DESCRIPTION : t.meta.siteDescription)}</description>
    <language>${locale}</language>
    <atom:link href="${absoluteUrl(self)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}

/** The feed URL of a language, for the footer and `<link rel="alternate">`. */
export function feedPath(locale: Locale): string {
  return locale === 'en' ? '/feed.xml' : `/${locale}/feed.xml`
}
