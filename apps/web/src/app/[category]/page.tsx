import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Article } from '@akavish/types'
import { fetchArticles } from '@/lib/payload'
import { CATEGORIES, categoryBySlug } from '@/lib/categories'
import { breadcrumbList } from '@/lib/structured-data'
import { JsonLd } from '@/components/JsonLd'
import { ArticleCard } from '@/components/ArticleCard'
import { PAGE_SIZE, pagedTitle, pageHref, parsePage } from '@/lib/pagination'
import { Pagination } from '@/components/Pagination'
import { ContentUnavailable, NothingYet } from '@/components/StatusMessage'

export const revalidate = 30

// Pre-render the known category pages at build time.
export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }))
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>
  searchParams: Promise<{ page?: string | string[] }>
}): Promise<Metadata> {
  const { category } = await params
  const page = parsePage((await searchParams).page) ?? 1
  const conf = categoryBySlug(category)
  if (!conf) return { title: 'Not found' }
  return {
    title: pagedTitle(conf.label, page),
    description: conf.blurb,
    alternates: { canonical: pageHref(`/${category}`, page) },
    openGraph: { title: conf.label, description: conf.blurb, url: pageHref(`/${category}`, page) },
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>
  searchParams: Promise<{ page?: string | string[] }>
}) {
  const { category } = await params
  const conf = categoryBySlug(category)
  if (!conf) notFound()
  const page = parsePage((await searchParams).page)
  if (page === null) notFound()

  let articles: Article[] = []
  let totalPages = 1
  let cmsError = false
  try {
    const result = await fetchArticles({ category: conf.value, page, limit: PAGE_SIZE })
    articles = result.data
    totalPages = result.totalPages
  } catch {
    cmsError = true
  }

  // Past the last page (or a later page of an empty list): no such URL.
  if (page > 1 && page > totalPages) notFound()

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <JsonLd data={breadcrumbList([{ name: conf.label, path: `/${conf.slug}` }])} />
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tight text-white">{conf.label}</h1>
        <p className="text-zinc-400 mt-2">{conf.blurb}</p>
      </header>

      {cmsError ? (
        <ContentUnavailable />
      ) : articles.length === 0 ? (
        <NothingYet what={conf.label.toLowerCase()} />
      ) : (
        <>
          {/* Cards use <h3>; this keeps the outline h1 → h2 → h3 for screen
              readers without adding a visible heading. */}
          <h2 className="sr-only">Articles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
          <Pagination basePath={`/${conf.slug}`} page={page} totalPages={totalPages} />
        </>
      )}
    </div>
  )
}
