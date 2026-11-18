// The list itself, shared by page.tsx (page 1) and page/[n]/page.tsx (page
// n). The public URL stays `?page=N`: the proxy rewrites it to /page/N, so
// the page reads a path param instead of searchParams and can be cached.
import Image from 'next/image'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Article } from '@akavish/types'
import { alternates } from '@/lib/i18n/metadata'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'
import { fetchAllPlatforms, fetchGameBySlug, fetchArticles } from '@/lib/payload'
import { breadcrumbList } from '@/lib/structured-data'
import { JsonLd } from '@/components/JsonLd'
import { ArticleCard } from '@/components/ArticleCard'
import { PAGE_SIZE, pagedTitle, pageHref, parsePage } from '@/lib/pagination'
import { Pagination } from '@/components/Pagination'
import Link from '@/components/LocaleLink'
import { FollowButton } from '@/components/FollowButton'
import { ReleaseDate } from '@/components/ReleaseDate'
import { formatPlatforms } from '@/lib/game-library'
import { platformLabel, platformShort, type PlatformInfo } from '@/lib/platforms'


function CompanyLinks({ companies }: { companies: Array<{ slug: string; name: string }> }) {
  return (
    <>
      {companies.map((c, i) => (
        <span key={c.slug}>
          {i > 0 && ', '}
          <Link href={`/company/${c.slug}`} className="hover:text-emerald-400 underline-offset-2 hover:underline">
            {c.name}
          </Link>
        </span>
      ))}
    </>
  )
}

export async function listMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string; n?: string }>
}): Promise<Metadata> {
  const { slug, locale: raw } = await params
  const locale = setRequestLocale(raw)
  const t = getMessages()
  const page = parsePage((await params).n) ?? 1
  const game = await fetchGameBySlug(slug).catch(() => null)
  if (!game) return { title: t.game.notFound }
  const description = t.game.description(game.name)
  const links = alternates(locale, pageHref(`/game/${slug}`, page))
  return {
    title: pagedTitle(game.name, page),
    description,
    alternates: links,
    openGraph: {
      title: game.name,
      description,
      url: links.canonical as string,
      images: game.cover ? [game.cover] : undefined,
    },
  }
}

export async function ListPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; n?: string }>
}) {
  const { slug, locale: raw } = await params
  const locale = setRequestLocale(raw)
  const t = getMessages()
  const page = parsePage((await params).n)
  if (page === null) notFound()

  const platforms: PlatformInfo[] = await fetchAllPlatforms().catch(() => [])
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <JsonLd data={breadcrumbList([{ name: t.games.title, path: '/games' }, { name: game.name, path: `/game/${slug}` }], locale)} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'VideoGame',
          name: game.name,
          ...(game.cover ? { image: game.cover } : {}),
          ...(game.platforms.length ? { gamePlatform: game.platforms.map((p) => platformLabel(p, platforms)) } : {}),
          ...(game.genre.length ? { genre: game.genre } : {}),
          ...(game.developers.length ? { author: game.developers.map((c) => ({ '@type': 'Organization', name: c.name })) } : {}),
          ...(game.publishers.length ? { publisher: game.publishers.map((c) => ({ '@type': 'Organization', name: c.name })) } : {}),
          ...(game.releases[0]?.precision === 'day' && game.releases[0].date ? { datePublished: game.releases[0].date } : {}),
        }}
      />
      <header className="flex flex-col sm:flex-row gap-6 mb-10">
        {game.cover && (
          // Landscape: covers are key art or stills from official trailers.
          <div className="relative w-full sm:w-80 aspect-video bg-zinc-800 rounded-lg overflow-hidden shrink-0">
            <Image
              src={game.cover}
              alt={game.name}
              fill
              sizes="(max-width: 640px) 100vw, 320px"
              className="object-cover"
            />
          </div>
        )}
        <div className="space-y-4 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-black tracking-tight text-white">{game.name}</h1>
            <FollowButton gameId={game.id} />
          </div>
          {(game.platforms.length > 0 || game.genre.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {game.platforms.map((p) => (
                <Link
                  key={p}
                  href={`/platform/${p}`}
                  className="px-2.5 py-1 rounded-full border border-zinc-700 text-xs text-zinc-200 hover:border-emerald-500 hover:text-white transition-colors"
                >
                  {platformShort(p, platforms)}
                </Link>
              ))}
              {game.genre.map((g) => (
                <Link
                  key={g}
                  href={`/games?genre=${encodeURIComponent(g)}`}
                  className="px-2.5 py-1 rounded-full border border-zinc-800 text-xs text-zinc-400 hover:border-zinc-600 hover:text-white transition-colors"
                >
                  {g}
                </Link>
              ))}
            </div>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {game.developers.length > 0 && (
              <>
                <dt className="text-zinc-400">{t.game.developers(game.developers.length)}</dt>
                <dd className="text-zinc-200">
                  <CompanyLinks companies={game.developers} />
                </dd>
              </>
            )}
            {game.publishers.length > 0 && (
              <>
                <dt className="text-zinc-400">{t.game.publishers(game.publishers.length)}</dt>
                <dd className="text-zinc-200">
                  <CompanyLinks companies={game.publishers} />
                </dd>
              </>
            )}
            <dt className="text-zinc-400">{t.game.releases}</dt>
            <dd className="text-zinc-200">
              {game.releases.length === 0 ? (
                t.game.tba
              ) : (
                <ul className="space-y-0.5">
                  {game.releases.map((r, i) => (
                    <li key={i}>
                      <ReleaseDate release={r} />
                      {r.platforms.length > 0 && (
                        <span className="text-zinc-400"> · {formatPlatforms(r.platforms, platforms)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </dl>
        </div>
      </header>

      <h2 className="text-xs uppercase tracking-widest text-zinc-400 mb-6 font-bold">{t.game.coverage}</h2>
      {articles.length === 0 ? (
        <p className="text-zinc-400">{t.game.none}</p>
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
