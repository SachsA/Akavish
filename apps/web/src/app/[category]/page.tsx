import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Article } from '@akavish/types'
import { fetchArticles } from '@/lib/payload'
import { CATEGORIES, categoryBySlug } from '@/lib/categories'
import { ArticleCard } from '@/components/ArticleCard'
import { ContentUnavailable, NothingYet } from '@/components/StatusMessage'

export const revalidate = 30

// Pre-render the known category pages at build time.
export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const { category } = await params
  const conf = categoryBySlug(category)
  if (!conf) return { title: 'Not found' }
  return {
    title: conf.label,
    description: conf.blurb,
    alternates: { canonical: `/${category}` },
    openGraph: { title: conf.label, description: conf.blurb, url: `/${category}` },
  }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  const conf = categoryBySlug(category)
  if (!conf) notFound()

  let articles: Article[] = []
  let cmsError = false
  try {
    const result = await fetchArticles({ category: conf.value, limit: 24 })
    articles = result.data
  } catch {
    cmsError = true
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tight text-white">{conf.label}</h1>
        <p className="text-zinc-400 mt-2">{conf.blurb}</p>
      </header>

      {cmsError ? (
        <ContentUnavailable />
      ) : articles.length === 0 ? (
        <NothingYet what={conf.label.toLowerCase()} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  )
}
