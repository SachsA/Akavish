import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  fetchAdjacentArticles,
  fetchArticleBySlug,
  fetchRelatedArticles,
} from '@/lib/payload'
import { LexicalContent } from '@/components/LexicalContent'
import { ArticleCard } from '@/components/ArticleCard'
import { ShareButtons } from '@/components/ShareButtons'
import { countWords, readingTimeLabel, readingTimeMinutes } from '@/lib/reading-time'
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

  // Secondary content: never let it break the page. The article itself is what
  // matters — if the CMS is slow or these queries fail, we drop the extras
  // rather than 500 on a page that already has everything a reader came for.
  const [related, adjacent] = await Promise.all([
    fetchRelatedArticles(article).catch(() => []),
    fetchAdjacentArticles(article).catch(() => ({ next: null, previous: null })),
  ])

  const readingTime = readingTimeLabel(article.content)
  const shareUrl = absoluteUrl(`/article/${article.slug}`)

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
    // Now that reading time is computed, expose it to search engines too.
    // `timeRequired` is an ISO 8601 duration.
    wordCount: countWords(article.content) || undefined,
    timeRequired: readingTimeMinutes(article.content)
      ? `PT${readingTimeMinutes(article.content)}M`
      : undefined,
  }

  return (
    // The <article> below wraps only the piece itself — share links, prev/next
    // and suggestions are page furniture, not part of the article.
    <div className="max-w-3xl mx-auto px-4 py-12">
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

      <article>
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
            {readingTime && <span>· {readingTime}</span>}
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

      <div
        className={`mt-8 ${article.tags.length > 0 ? '' : 'pt-6 border-t border-zinc-800'}`}
      >
        <ShareButtons url={shareUrl} title={article.title} />
      </div>

      {(adjacent.previous || adjacent.next) && (
        <nav
          aria-label="Article navigation"
          className="grid gap-3 sm:grid-cols-2 mt-10 pt-6 border-t border-zinc-800"
        >
          {adjacent.previous ? (
            <Link
              href={`/article/${adjacent.previous.slug}`}
              className="group rounded-lg border border-zinc-800 p-4 hover:border-zinc-700 transition-colors"
            >
              <span className="block text-xs text-zinc-600 mb-1">← Previous</span>
              <span className="block font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-2">
                {adjacent.previous.title}
              </span>
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}

          {adjacent.next && (
            <Link
              href={`/article/${adjacent.next.slug}`}
              className="group rounded-lg border border-zinc-800 p-4 hover:border-zinc-700 transition-colors sm:text-right"
            >
              <span className="block text-xs text-zinc-600 mb-1">Next →</span>
              <span className="block font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-2">
                {adjacent.next.title}
              </span>
            </Link>
          )}
        </nav>
      )}

      {related.length > 0 && (
        <section className="mt-12 pt-8 border-t border-zinc-800">
          <h2 className="text-xl font-black tracking-tight text-white mb-5">Read next</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
