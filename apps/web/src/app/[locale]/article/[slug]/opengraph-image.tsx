import { fetchArticleBySlug } from '@/lib/payload'
import { isLocale } from '@/lib/i18n/config'
import { messagesFor } from '@/lib/i18n/messages'
import { renderOgImage } from '@/lib/og'

export const runtime = 'nodejs'
export const revalidate = 300

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Akavish article'

export default async function OgImage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug, locale } = await params
  const t = messagesFor(isLocale(locale) ? locale : 'en')
  const article = await fetchArticleBySlug(slug).catch(() => null)

  return renderOgImage({
    eyebrow: article ? (t.categories[article.category]?.singular ?? article.category) : undefined,
    title: article?.title ?? 'Akavish',
  })
}
