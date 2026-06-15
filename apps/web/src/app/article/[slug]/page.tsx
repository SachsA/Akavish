import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchArticleBySlug } from '@/lib/payload'
import { LexicalContent } from '@/components/LexicalContent'
import { absoluteUrl, SITE_NAME } from '@/lib/site'

export const revalidate = 30

const CATEGORY_LABELS: Record<string, string> = {
  news: 'News',
  leak: 'Leak',
  review: 'Review',
  preview: 'Preview',
  conference: 'Conference',
  esport: 'Esport',
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = await fetchArticleBySlug(slug).catch(() => null)
  if (!article) return { title: 'Article not found' }

  // Prefer the CMS SEO fields when set, fall back to the article's own title/excerpt.
  const title = article.seo?.title || article.title
  const description = article.seo?.description || article.excerpt
  const url = `/article/${article.slug}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      publishedTime: article.publishedAt,
      authors: [article.author.name],
      // Share image is provided by the sibling opengraph-image.tsx (branded,
      // always present). Twitter falls back to it automatically.
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  let article
  try {
    article = await fetchArticleBySlug(slug)
  } catch {
    article = null
  }

  if (!article) notFound()

  // Schema.org NewsArticle for rich results.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    image: article.coverImage ? [article.coverImage] : undefined,
    author: { '@type': 'Person', name: article.author.name },
    publisher: { '@type': 'Organization', name: SITE_NAME },
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(`/article/${article.slug}`) },
  }

  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link
        href="/"
        className="text-sm text-zinc-500 hover:text-white transition-colors inline-block mb-6"
      >
        ← Back
      </Link>

      <div className="space-y-3 mb-8">
        <span className="text-emerald-500 text-xs font-bold uppercase tracking-wide">
          {CATEGORY_LABELS[article.category] ?? article.category}
        </span>
        <h1 className="text-4xl font-black tracking-tight text-white leading-tight">
          {article.title}
        </h1>
        <p className="text-lg text-zinc-400">{article.excerpt}</p>
        <div className="flex items-center gap-2 text-sm text-zinc-600 pt-2">
          <span>
            By{' '}
            {article.author.slug ? (
              <a
                href={`/author/${article.author.slug}`}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                {article.author.name}
              </a>
            ) : (
              <span className="text-zinc-400">{article.author.name}</span>
            )}
          </span>
          {article.publishedAt && <span>· {formatDate(article.publishedAt)}</span>}
          {article.game?.slug && (
            <span>
              ·{' '}
              <a
                href={`/game/${article.game.slug}`}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                {article.game.name}
              </a>
            </span>
          )}
        </div>
      </div>

      {article.coverImage && (
        <div className="relative aspect-video bg-zinc-800 rounded-lg overflow-hidden mb-8">
          <Image
            src={article.coverImage}
            alt={article.title}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            priority
            className="object-cover"
          />
        </div>
      )}

      <div className="prose-invert">
        <LexicalContent content={article.content} />
      </div>

      {article.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-10 pt-6 border-t border-zinc-800">
          {article.tags.map((tag) => (
            <a
              key={tag}
              href={`/tag/${tag}`}
              className="px-3 py-1 rounded-full border border-zinc-800 text-xs text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
            >
              #{tag}
            </a>
          ))}
        </div>
      )}
    </article>
  )
}
