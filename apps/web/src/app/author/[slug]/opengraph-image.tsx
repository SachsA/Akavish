import { fetchAuthorBySlug } from '@/lib/payload'
import { renderOgImage } from '@/lib/og'

export const runtime = 'nodejs'
export const revalidate = 300

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Akavish author'

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const author = await fetchAuthorBySlug(slug).catch(() => null)

  return renderOgImage({
    eyebrow: 'Author',
    title: author?.name ?? 'Akavish',
    subtitle: author?.bio,
  })
}
