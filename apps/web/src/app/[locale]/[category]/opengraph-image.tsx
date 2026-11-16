import { categoryBySlug } from '@/lib/categories'
import { renderOgImage } from '@/lib/og'
import { isLocale } from '@/lib/i18n/config'
import { messagesFor } from '@/lib/i18n/messages'

export const runtime = 'nodejs'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Akavish section'

export default async function OgImage({ params }: { params: Promise<{ locale: string; category: string }> }) {
  const { category, locale } = await params
  const t = messagesFor(isLocale(locale) ? locale : 'en')
  const conf = categoryBySlug(category)
  const words = conf ? t.categories[conf.value] : null

  return renderOgImage({
    eyebrow: t.og.section,
    title: words?.label ?? 'Akavish',
    subtitle: words?.blurb,
  })
}
