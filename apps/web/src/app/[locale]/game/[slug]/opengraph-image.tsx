import { fetchGameBySlug } from '@/lib/payload'
import { renderOgImage } from '@/lib/og'
import { isLocale } from '@/lib/i18n/config'
import { messagesFor } from '@/lib/i18n/messages'

export const runtime = 'nodejs'
export const revalidate = 300

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Akavish game coverage'

export default async function OgImage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug, locale } = await params
  const t = messagesFor(isLocale(locale) ? locale : 'en')
  const game = await fetchGameBySlug(slug).catch(() => null)

  const details = [game?.developer, game?.platform.join(' · ')].filter(Boolean).join(' — ')

  return renderOgImage({
    eyebrow: t.og.game,
    title: game?.name ?? 'Akavish',
    subtitle: details || t.og.gameFallback,
  })
}
