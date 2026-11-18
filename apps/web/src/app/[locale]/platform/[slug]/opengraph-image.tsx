import { fetchPlatformBySlug } from '@/lib/payload'
import { renderOgImage } from '@/lib/og'
import { isLocale } from '@/lib/i18n/config'
import { messagesFor } from '@/lib/i18n/messages'
import { setRequestLocale } from '@/lib/i18n/server'

export const runtime = 'nodejs'
export const revalidate = 300

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Akavish console page'

export default async function OgImage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug, locale } = await params
  setRequestLocale(locale)
  const t = messagesFor(isLocale(locale) ? locale : 'en')
  const platform = await fetchPlatformBySlug(slug).catch(() => null)
  return renderOgImage({
    eyebrow: t.og.platform,
    title: platform?.label ?? 'Akavish',
    subtitle: t.og.gameFallback,
  })
}
