// A console's page: its release, the games coming on it (soonest first) and
// its latest releases, from the games library, then the news: articles
// tagged with it (and, while it has few games, articles about one of them: a
// console just revealed has no tag yet). Shared by page.tsx (page 1) and
// page/[n]/page.tsx; the public URL keeps `?page=N` (proxy).
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Article } from '@akavish/types'
import Link from '@/components/LocaleLink'
import { ArticleCard } from '@/components/ArticleCard'
import { GameCard } from '@/components/GameCard'
import { JsonLd } from '@/components/JsonLd'
import { Pagination } from '@/components/Pagination'
import { ReleaseDate } from '@/components/ReleaseDate'
import { isOut, period, type Release } from '@/lib/game-library'
import { alternates } from '@/lib/i18n/metadata'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'
import { PAGE_SIZE, pagedTitle, pageHref, parsePage } from '@/lib/pagination'
import { fetchAllGames, fetchArticles, fetchPlatformBySlug, type GameListItem } from '@/lib/payload'
import { TAGS } from '@/lib/revalidate'
import { breadcrumbList } from '@/lib/structured-data'

type Params = { params: Promise<{ locale: string; slug: string; n?: string }> }

/** Up to this many games, the news also lists articles about any of them. */
const FEW_GAMES = 30
const RECENT = 10
const COMING = 20

export async function listMetadata({ params }: Params): Promise<Metadata> {
  const { slug, locale: raw, n } = await params
  const locale = setRequestLocale(raw)
  const t = getMessages()
  const page = parsePage(n) ?? 1
  const platform = await fetchPlatformBySlug(slug).catch(() => null)
  if (!platform) return { title: t.platform.notFound }
  const description = t.platform.description(platform.label)
  const links = alternates(locale, pageHref(`/platform/${slug}`, page))
  return {
    title: pagedTitle(platform.label, page),
    description,
    alternates: links,
    openGraph: { title: platform.label, description, url: links.canonical as string },
  }
}

const byDate = (a: Release, b: Release) => (a.date ?? '9999').localeCompare(b.date ?? '9999')
/** Soonest first by the last day it can fall on: "Jan 15, 2027" before "2027"; TBA last. */
const bySoonest = (a: Release, b: Release) => (period(a)?.[1] ?? '9999').localeCompare(period(b)?.[1] ?? '9999')

export async function ListPage({ params }: Params) {
  const { slug, locale: raw, n } = await params
  const locale = setRequestLocale(raw)
  const t = getMessages()
  const page = parsePage(n)
  if (page === null) notFound()

  const platform = await fetchPlatformBySlug(slug).catch(() => null)
  if (!platform) notFound()

  // Its games: each with its first release on this console.
  const today = new Date().toISOString().slice(0, 10)
  const on = (await fetchAllGames().catch(() => [] as GameListItem[])).flatMap((game) => {
    const release = game.releases.filter((r) => r.platforms.includes(slug)).sort(byDate)[0]
    return release ? [{ game, release }] : []
  })
  const upcoming = on
    .filter((x) => !isOut(x.release, today))
    .sort((a, b) => bySoonest(a.release, b.release) || a.game.name.localeCompare(b.game.name, locale))
    .slice(0, COMING)
  const released = on
    .filter((x) => isOut(x.release, today))
    .sort((a, b) => byDate(b.release, a.release) || a.game.name.localeCompare(b.game.name, locale))
    .slice(0, RECENT)

  let articles: Article[] = []
  let totalPages = 1
  const gameIds = on.length <= FEW_GAMES ? on.map((x) => x.game.id) : []
  if (gameIds.length || platform.tagId) {
    try {
      const result = await fetchArticles({
        company: { gameIds, tagId: platform.tagId },
        page,
        limit: PAGE_SIZE,
        cacheTags: [TAGS.platform(slug)],
      })
      articles = result.data
      totalPages = result.totalPages
    } catch {
      // The games still show.
    }
  }
  if (page > 1 && page > totalPages) notFound()

  const grid = (items: typeof on) => (
    <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map(({ game, release }) => (
        <li key={game.slug}>
          <GameCard slug={game.slug} name={game.name} cover={game.cover} line={<ReleaseDate release={release} />} />
        </li>
      ))}
    </ul>
  )
  const heading = 'text-xs uppercase tracking-widest text-zinc-400 mb-6 font-bold'

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <JsonLd
        data={breadcrumbList(
          [
            { name: t.games.title, path: '/games' },
            { name: platform.label, path: `/platform/${slug}` },
          ],
          locale,
        )}
      />
      <header className="mb-10 space-y-2">
        <h1 className="text-4xl font-black tracking-tight text-white">{platform.label}</h1>
        {platform.aliases.length > 0 && (
          <p className="text-sm text-zinc-400">{t.platform.also(platform.aliases.join(', '))}</p>
        )}
        {platform.release && (
          <p className="text-sm text-zinc-300">
            {t.platform.release}
            <ReleaseDate release={platform.release} />
          </p>
        )}
        <p className="text-sm text-zinc-400">
          {t.platform.games(on.length)}
          {on.length > 0 && (
            <>
              {' · '}
              <Link href={`/games?platform=${slug}`} className="text-emerald-400 hover:text-emerald-300">
                {t.platform.library}
              </Link>
            </>
          )}
        </p>
      </header>

      {page === 1 &&
        (on.length === 0 ? (
          <p className="text-zinc-400 mb-12">{t.platform.noGames}</p>
        ) : (
          <div className="space-y-10 mb-12">
            {upcoming.length > 0 && (
              <section>
                <h2 className={heading}>{t.platform.upcoming}</h2>
                {grid(upcoming)}
              </section>
            )}
            {released.length > 0 && (
              <section>
                <h2 className={heading}>{t.platform.released}</h2>
                {grid(released)}
              </section>
            )}
          </div>
        ))}

      <h2 className={heading}>{t.platform.news}</h2>
      {articles.length === 0 ? (
        <p className="text-zinc-400">{t.platform.none}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
          <Pagination basePath={`/platform/${slug}`} page={page} totalPages={totalPages} />
        </>
      )}
    </div>
  )
}
