// A studio's or publisher's page: its games in the library (what it made,
// what it published, out and upcoming), then the news about them: articles
// about one of its games, or tagged with the company. Shared by page.tsx
// (page 1) and page/[n]/page.tsx; the public URL keeps `?page=N` (proxy).
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Article } from '@akavish/types'
import Link from '@/components/LocaleLink'
import { ArticleCard } from '@/components/ArticleCard'
import { GameCard } from '@/components/GameCard'
import { JsonLd } from '@/components/JsonLd'
import { Pagination } from '@/components/Pagination'
import { ReleaseDate } from '@/components/ReleaseDate'
import { formatPlatforms } from '@/lib/game-library'
import { alternates } from '@/lib/i18n/metadata'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'
import { PAGE_SIZE, pagedTitle, pageHref, parsePage } from '@/lib/pagination'
import { fetchAllGames, fetchArticles, fetchCompanyBySlug, type GameListItem } from '@/lib/payload'
import { breadcrumbList } from '@/lib/structured-data'

type Params = { params: Promise<{ locale: string; slug: string; n?: string }> }

export async function listMetadata({ params }: Params): Promise<Metadata> {
  const { slug, locale: raw, n } = await params
  const locale = setRequestLocale(raw)
  const t = getMessages()
  const page = parsePage(n) ?? 1
  const company = await fetchCompanyBySlug(slug).catch(() => null)
  if (!company) return { title: t.company.notFound }
  const description = t.company.description(company.name)
  const links = alternates(locale, pageHref(`/company/${slug}`, page))
  return {
    title: pagedTitle(company.name, page),
    description,
    alternates: links,
    openGraph: { title: company.name, description, url: links.canonical as string },
  }
}

const firstDate = (g: GameListItem) =>
  g.releases.map((r) => r.date ?? '9999').sort()[0] ?? '9999'

export async function ListPage({ params }: Params) {
  const { slug, locale: raw, n } = await params
  const locale = setRequestLocale(raw)
  const t = getMessages()
  const page = parsePage(n)
  if (page === null) notFound()

  const company = await fetchCompanyBySlug(slug).catch(() => null)
  if (!company) notFound()

  // Its games, newest release first (upcoming ones on top).
  const games = (await fetchAllGames().catch(() => [] as GameListItem[]))
    .filter((g) => g.developers.includes(slug) || g.publishers.includes(slug))
    .sort((a, b) => firstDate(b).localeCompare(firstDate(a)) || a.name.localeCompare(b.name, locale))

  let articles: Article[] = []
  let totalPages = 1
  if (games.length || company.tagId) {
    try {
      const result = await fetchArticles({
        company: { gameIds: games.map((g) => g.id), tagId: company.tagId },
        page,
        limit: PAGE_SIZE,
      })
      articles = result.data
      totalPages = result.totalPages
    } catch {
      // The games still show.
    }
  }
  if (page > 1 && page > totalPages) notFound()

  const role = (g: GameListItem) => {
    const dev = g.developers.includes(slug)
    const pub = g.publishers.includes(slug)
    return dev && pub ? t.company.both : dev ? t.company.developer : t.company.publisher
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <JsonLd
        data={breadcrumbList(
          [
            { name: t.games.title, path: '/games' },
            { name: company.name, path: `/company/${slug}` },
          ],
          locale,
        )}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: company.name,
          ...(company.aliases.length ? { alternateName: company.aliases } : {}),
          ...(company.logo ? { logo: company.logo } : {}),
        }}
      />
      <header className="mb-10 space-y-2">
        <h1 className="text-4xl font-black tracking-tight text-white">{company.name}</h1>
        {company.aliases.length > 0 && (
          <p className="text-sm text-zinc-400">{t.company.also(company.aliases.join(', '))}</p>
        )}
        <p className="text-sm text-zinc-400">
          {t.company.games(games.length)}
          {games.length > 0 && (
            <>
              {' · '}
              <Link href={`/games?company=${slug}`} className="text-emerald-400 hover:text-emerald-300">
                {t.company.library}
              </Link>
            </>
          )}
        </p>
      </header>

      {page === 1 &&
        (games.length === 0 ? (
          <p className="text-zinc-400 mb-12">{t.company.noGames}</p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-12">
            {games.map((g) => {
              const first = [...g.releases].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))[0]
              return (
                <li key={g.slug}>
                  <GameCard
                    slug={g.slug}
                    name={g.name}
                    cover={g.cover}
                    line={
                      <>
                        {role(g)}
                        {first && (
                          <>
                            {' · '}
                            <ReleaseDate release={first} />
                          </>
                        )}
                        {first?.platforms.length ? <> · {formatPlatforms(first.platforms)}</> : null}
                      </>
                    }
                  />
                </li>
              )
            })}
          </ul>
        ))}

      <h2 className="text-xs uppercase tracking-widest text-zinc-400 mb-6 font-bold">{t.company.news}</h2>
      {articles.length === 0 ? (
        <p className="text-zinc-400">{t.company.none}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
          <Pagination basePath={`/company/${slug}`} page={page} totalPages={totalPages} />
        </>
      )}
    </div>
  )
}
