import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchArticleBySlug } from '@/lib/payload'
import { LexicalContent } from '@/components/LexicalContent'

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
  return {
    title: article.title,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: article.coverImage ? [article.coverImage] : undefined,
      type: 'article',
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

  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <a
        href="/"
        className="text-sm text-zinc-500 hover:text-white transition-colors inline-block mb-6"
      >
        ← Back
      </a>

      <div className="space-y-3 mb-8">
        <span className="text-emerald-500 text-xs font-bold uppercase tracking-wide">
          {CATEGORY_LABELS[article.category] ?? article.category}
        </span>
        <h1 className="text-4xl font-black tracking-tight text-white leading-tight">
          {article.title}
        </h1>
        <p className="text-lg text-zinc-400">{article.excerpt}</p>
        <div className="flex items-center gap-2 text-sm text-zinc-600 pt-2">
          <span>By {article.author.name}</span>
          {article.publishedAt && <span>· {formatDate(article.publishedAt)}</span>}
        </div>
      </div>

      {article.coverImage && (
        <div className="aspect-video bg-zinc-800 rounded-lg overflow-hidden mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.coverImage}
            alt={article.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="prose-invert">
        <LexicalContent content={article.content} />
      </div>
    </article>
  )
}
