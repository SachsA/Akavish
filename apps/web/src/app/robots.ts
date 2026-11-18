import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // `/monitoring` is Sentry's tunnel endpoint, not a page.
      disallow: ['/api/', '/account', '/sign-in', '/sign-up', '/monitoring'],
    },
    // The full sitemap, and the Google News one (last 48 hours of articles).
    sitemap: [absoluteUrl('/sitemap.xml'), absoluteUrl('/news-sitemap.xml')],
  }
}
