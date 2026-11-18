// ─── Google News sitemap ─────────────────────────────────────────────────────
// /news-sitemap.xml: the articles published in the last 48 hours, in the
// format Google News reads (sitemaps.org + the news: namespace), each in
// English and, once translated, in French. Older articles stay in
// /sitemap.xml only, as Google asks. Pure: unit-tested.

import { SITE_NAME } from './site'

export interface NewsEntry {
  slug: string
  title: string
  publishedAt: string
  /** French title, when the French version exists. */
  frTitle?: string
}

/** Google News only wants the last two days. */
export const NEWS_WINDOW_MS = 48 * 60 * 60 * 1000

const escape = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

function url(loc: string, lang: 'en' | 'fr', title: string, publishedAt: string): string {
  return [
    '<url>',
    `<loc>${escape(loc)}</loc>`,
    '<news:news>',
    `<news:publication><news:name>${escape(SITE_NAME)}</news:name><news:language>${lang}</news:language></news:publication>`,
    `<news:publication_date>${escape(new Date(publishedAt).toISOString())}</news:publication_date>`,
    `<news:title>${escape(title)}</news:title>`,
    '</news:news>',
    '</url>',
  ].join('')
}

/** The sitemap for the articles of the last 48 hours (at most 1,000 URLs). */
export function newsSitemapXml(entries: NewsEntry[], siteUrl: string, now: Date): string {
  const since = now.getTime() - NEWS_WINDOW_MS
  const urls: string[] = []
  for (const e of entries) {
    const t = Date.parse(e.publishedAt)
    if (Number.isNaN(t) || t < since || t > now.getTime()) continue
    urls.push(url(`${siteUrl}/article/${e.slug}`, 'en', e.title, e.publishedAt))
    if (e.frTitle) urls.push(url(`${siteUrl}/fr/article/${e.slug}`, 'fr', e.frTitle, e.publishedAt))
  }
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n' +
    urls.slice(0, 1000).join('\n') +
    '\n</urlset>\n'
  )
}
