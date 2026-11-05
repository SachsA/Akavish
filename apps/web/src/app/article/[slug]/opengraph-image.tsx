import { fetchArticleBySlug } from '@/lib/payload'
import { categoryByValue } from '@/lib/categories'
import { renderOgImage } from '@/lib/og'

export const runtime = 'nodejs'
export const revalidate = 300

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Akavish article'

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await fetchArticleBySlug(slug).catch(() => null)

  return renderOgImage({
    eyebrow: article ? (categoryByValue(article.category)?.singular ?? article.category) : undefined,
    title: article?.title ?? 'Akavish',
  })
}
