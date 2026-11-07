import Image from 'next/image'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Article } from '@akavish/types'
import { fetchGameBySlug, fetchArticles } from '@/lib/payload'
import { breadcrumbList } from '@/lib/structured-data'
import { JsonLd } from '@/components/JsonLd'
import { ArticleCard } from '@/components/ArticleCard'
import { PAGE_SIZE, pagedTitle, pageHref, parsePage } from '@/lib/pagination'
import { Pagination } from '@/components/Pagination'

export const revalidate = 30

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
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string | string[] }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = parsePage((await searchParams).page) ?? 1
  const game = await fetchGameBySlug(slug).catch(() => null)
  if (!game) return { title: 'Game not found' }
  const description = `News, leaks and reviews about ${game.name} on Akavish.`
  return {
    title: pagedTitle(game.name, page),
    description,
    alternates: { canonical: pageHref(`/game/${slug}`, page) },
    openGraph: {
      title: game.name,
      description,
      url: pageHref(`/game/${slug}`, page),
      images: game.cover ? [game.cover] : undefined,
    },
  }
}

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string | string[] }>
}) {
  const { slug } = await params
  const page = parsePage((await searchParams).page)
  if (page === null) notFound()

  let game
  try {
    game = await fetchGameBySlug(slug)
  } catch {
    game = null
  }
  if (!game) notFound()

  let articles: Article[] = []
  let totalPages = 1
  try {
    const result = await fetchArticles({ gameId: game.id, page, limit: PAGE_SIZE })
    articles = result.data
    totalPages = result.totalPages
  } catch {
    // Game still renders even if the article list fails.
  }

  // Past the last page (or a later page of an empty list): no such URL.
  if (page > 1 && page > totalPages) notFound()

  const meta = [
    game.developer && `Dev: ${game.developer}`,
    game.publisher && `Publisher: ${game.publisher}`,
    game.releaseDate && `Released: ${formatDate(game.releaseDate)}`,
  ].filter(Boolean) as string[]

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <JsonLd data={breadcrumbList([{ name: game.name, path: `/game/${slug}` }])} />
      <header className="flex flex-col sm:flex-row gap-6 mb-10">
        {game.cover && (
          <div className="relative w-full sm:w-48 aspect-[3/4] bg-zinc-800 rounded-lg overflow-hidden shrink-0">
            <Image
              src={game.cover}
              alt={game.name}
              fill
              sizes="(max-width: 640px) 100vw, 192px"
              className="object-cover"
            />
          </div>
        )}
        <div className="space-y-3">
          <h1 className="text-4xl font-black tracking-tight text-white">{game.name}</h1>
          <div className="flex flex-wrap gap-2">
            {[...game.platform, ...game.genre].map((t) => (
              <span
                key={t}
                className="px-2.5 py-1 rounded-full border border-zinc-800 text-xs text-zinc-400"
              >
                {t}
              </span>
            ))}
          </div>
          {meta.length > 0 && (
            <p className="text-sm text-zinc-400">{meta.join('  ·  ')}</p>
          )}
        </div>
      </header>

      <h2 className="text-xs uppercase tracking-widest text-zinc-400 mb-6 font-bold">
        Coverage
      </h2>
      {articles.length === 0 ? (
        <p className="text-zinc-400">No published articles about this game yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
          <Pagination basePath={`/game/${slug}`} page={page} totalPages={totalPages} />
        </>
      )}
    </div>
  )
}
