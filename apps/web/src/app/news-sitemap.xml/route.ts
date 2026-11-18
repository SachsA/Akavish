import { fetchRecentArticles } from '@/lib/payload'
import { NEWS_WINDOW_MS, newsSitemapXml } from '@/lib/news-sitemap'
import { SITE_URL } from '@/lib/site'

// Google News sitemap (lib/news-sitemap.ts): the last 48 hours of articles,
// English and French. Submitted in Search Console next to /sitemap.xml and
// listed in robots.txt. Refreshed every 5 minutes; an empty list on a CMS
// hiccup rather than an error.
export const revalidate = 300

export async function GET() {
  const now = new Date()
  const entries = await fetchRecentArticles(new Date(now.getTime() - NEWS_WINDOW_MS).toISOString()).catch(() => [])
  return new Response(newsSitemapXml(entries, SITE_URL, now), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
