// Site-wide default share image. Next.js uses it for every route that has no
// `opengraph-image` of its own: the home page, about, contact, the legal pages,
// search… Articles, categories, authors, games and tags override it.
import { renderOgImage } from '@/lib/og'
import { SITE_DESCRIPTION } from '@/lib/site'

export const runtime = 'nodejs'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Akavish — gaming news, leaks and reviews'

export default function OgImage() {
  return renderOgImage({
    eyebrow: 'Gaming news',
    title: 'Leaks, reviews and breaking news. No fluff.',
    subtitle: SITE_DESCRIPTION,
  })
}
