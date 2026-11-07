import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Article } from '@akavish/types'
import { fetchTagBySlug, fetchArticles } from '@/lib/payload'
import { breadcrumbList } from '@/lib/structured-data'
import { JsonLd } from '@/components/JsonLd'
import { ArticleCard } from '@/components/ArticleCard'
import { PAGE_SIZE, pagedTitle, pageHref, parsePage } from '@/lib/pagination'
import { Pagination } from '@/components/Pagination'

export const revalidate = 30

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string | string[] }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = parsePage((await searchParams).page) ?? 1
  const tag = await fetchTagBySlug(slug).catch(() => null)
  if (!tag) return { title: 'Tag not found' }
  const description = `Articles tagged ${tag.name} on Akavish.`
  return {
    title: pagedTitle(`#${tag.name}`, page),
    description,
    alternates: { canonical: pageHref(`/tag/${slug}`, page) },
    openGraph: { title: `#${tag.name}`, description, url: pageHref(`/tag/${slug}`, page) },
  }
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string | string[] }>
}) {
  const { slug } = await params
  const page = parsePage((await searchParams).page)
  if (page === null) notFound()

  let tag
  try {
    tag = await fetchTagBySlug(slug)
  } catch {
    tag = null
  }
  if (!tag) notFound()

  let articles: Article[] = []
  let totalPages = 1
  try {
    const result = await fetchArticles({ tagId: tag.id, page, limit: PAGE_SIZE })
    articles = result.data
    totalPages = result.totalPages
  } catch {
    // Tag still renders even if the article list fails.
  }

  // Past the last page (or a later page of an empty list): no such URL.
  if (page > 1 && page > totalPages) notFound()

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <JsonLd data={breadcrumbList([{ name: `#${tag.name}`, path: `/tag/${slug}` }])} />
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tight text-white">#{tag.name}</h1>
        <p className="text-zinc-400 mt-2">Everything tagged {tag.name}.</p>
      </header>

      {articles.length === 0 ? (
        <p className="text-zinc-400">No published articles with this tag yet.</p>
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
          <Pagination basePath={`/tag/${slug}`} page={page} totalPages={totalPages} />
        </>
      )}
    </div>
  )
}
