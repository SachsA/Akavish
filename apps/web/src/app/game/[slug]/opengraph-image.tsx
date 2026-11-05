import { fetchGameBySlug } from '@/lib/payload'
import { renderOgImage } from '@/lib/og'

export const runtime = 'nodejs'
export const revalidate = 300

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Akavish game coverage'

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const game = await fetchGameBySlug(slug).catch(() => null)

  const details = [game?.developer, game?.platform.join(' · ')].filter(Boolean).join(' — ')

  return renderOgImage({
    eyebrow: 'Game',
    title: game?.name ?? 'Akavish',
    subtitle: details || 'News, leaks and reviews',
  })
}
