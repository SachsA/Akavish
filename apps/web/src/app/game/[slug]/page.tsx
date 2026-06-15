import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchGameBySlug, fetchArticles } from '@/lib/payload'
import { ArticleCard } from '@/components/ArticleCard'

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
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const game = await fetchGameBySlug(slug).catch(() => null)
  if (!game) return { title: 'Game not found' }
  return {
    title: game.name,
    description: `News, leaks and reviews about ${game.name} on Akavish.`,
  }
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  let game
  try {
    game = await fetchGameBySlug(slug)
  } catch {
    game = null
  }
  if (!game) notFound()

  let articles = []
  try {
    const result = await fetchArticles({ gameId: game.id, limit: 24 })
    articles = result.data
  } catch {
    // Game still renders even if the article list fails.
  }

  const meta = [
    game.developer && `Dev: ${game.developer}`,
    game.publisher && `Publisher: ${game.publisher}`,
    game.releaseDate && `Released: ${formatDate(game.releaseDate)}`,
  ].filter(Boolean) as string[]

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="flex flex-col sm:flex-row gap-6 mb-10">
        {game.cover && (
          <div className="w-full sm:w-48 aspect-[3/4] bg-zinc-800 rounded-lg overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={game.cover} alt={game.name} className="w-full h-full object-cover" />
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
            <p className="text-sm text-zinc-500">{meta.join('  ·  ')}</p>
          )}
        </div>
      </header>

      <h2 className="text-xs uppercase tracking-widest text-zinc-600 mb-6 font-bold">
        Coverage
      </h2>
      {articles.length === 0 ? (
        <p className="text-zinc-500">No published articles about this game yet.</p>
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
