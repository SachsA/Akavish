import { fetchArticles } from '@/lib/payload'
import { absoluteUrl, SITE_NAME, SITE_DESCRIPTION } from '@/lib/site'

export const revalidate = 300

// Escape XML special characters in text nodes.
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  let items = ''
  try {
    const { data: articles } = await fetchArticles({ limit: 50 })
    items = articles
      .map((a) => {
        const link = absoluteUrl(`/article/${a.slug}`)
        const date = a.publishedAt ?? a.createdAt
        return `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${escapeXml(a.excerpt)}</description>
      <category>${escapeXml(a.category)}</category>
      <dc:creator>${escapeXml(a.author.name)}</dc:creator>
      <pubDate>${new Date(date).toUTCString()}</pubDate>
    </item>`
      })
      .join('\n')
  } catch {
    // Serve a valid but empty feed if the CMS is unreachable.
    items = ''
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${absoluteUrl('/')}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>en</language>
    <atom:link href="${absoluteUrl('/feed.xml')}" rel="self" type="application/rss+xml" />
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
