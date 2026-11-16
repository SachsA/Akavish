// Site-wide default share image. Next.js uses it for every route that has no
// `opengraph-image` of its own: the home page, about, contact, the legal pages,
// search… Articles, categories, authors, games and tags override it.
import { renderOgImage } from '@/lib/og'
import { SITE_DESCRIPTION } from '@/lib/site'
import { isLocale } from '@/lib/i18n/config'
import { messagesFor } from '@/lib/i18n/messages'

export const runtime = 'nodejs'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Akavish — gaming news, leaks and reviews'

export default async function OgImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = messagesFor(isLocale(locale) ? locale : 'en')
  return renderOgImage({
    eyebrow: t.og.gamingNews,
    title: t.og.homeTitle,
    subtitle: locale === 'fr' ? t.meta.ogDescription : SITE_DESCRIPTION,
  })
}
