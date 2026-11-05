import { categoryBySlug } from '@/lib/categories'
import { renderOgImage } from '@/lib/og'

export const runtime = 'nodejs'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Akavish section'

export default async function OgImage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  const conf = categoryBySlug(category)

  return renderOgImage({
    eyebrow: 'Section',
    title: conf?.label ?? 'Akavish',
    subtitle: conf?.blurb,
  })
}
