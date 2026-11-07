import Image from 'next/image'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Article } from '@akavish/types'
import { fetchAuthorBySlug, fetchArticles } from '@/lib/payload'
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
  const author = await fetchAuthorBySlug(slug).catch(() => null)
  if (!author) return { title: 'Author not found' }
  const description = author.bio ?? `Articles by ${author.name} on Akavish.`
  return {
    title: pagedTitle(author.name, page),
    description,
    alternates: { canonical: pageHref(`/author/${slug}`, page) },
    openGraph: { title: author.name, description, url: pageHref(`/author/${slug}`, page), type: 'profile' },
  }
}

export default async function AuthorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string | string[] }>
}) {
  const { slug } = await params
  const page = parsePage((await searchParams).page)
  if (page === null) notFound()

  let author
  try {
    author = await fetchAuthorBySlug(slug)
  } catch {
    author = null
  }
  if (!author) notFound()

  let articles: Article[] = []
  let totalPages = 1
  try {
    const result = await fetchArticles({ authorId: author.id, page, limit: PAGE_SIZE })
    articles = result.data
    totalPages = result.totalPages
  } catch {
    // Author still renders even if the article list fails.
  }

  // Past the last page (or a later page of an empty list): no such URL.
  if (page > 1 && page > totalPages) notFound()

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <JsonLd data={breadcrumbList([{ name: author.name, path: `/author/${slug}` }])} />
      <header className="flex items-center gap-5 mb-10">
        {author.avatar ? (
          <Image
            src={author.avatar}
            alt={author.name}
            width={80}
            height={80}
            className="w-20 h-20 rounded-full object-cover border border-zinc-800"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-2xl font-black text-zinc-400">
            {author.name.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">{author.name}</h1>
          {author.bio && <p className="text-zinc-400 mt-1 max-w-2xl">{author.bio}</p>}
          {author.twitter && (
            <a
              href={`https://twitter.com/${author.twitter}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 text-sm hover:text-emerald-300 mt-1 inline-block"
            >
              @{author.twitter}
            </a>
          )}
        </div>
      </header>

      <h2 className="text-xs uppercase tracking-widest text-zinc-400 mb-6 font-bold">
        Articles
      </h2>
      {articles.length === 0 ? (
        <p className="text-zinc-400">No published articles yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
          <Pagination basePath={`/author/${slug}`} page={page} totalPages={totalPages} />
        </>
      )}
    </div>
  )
}
