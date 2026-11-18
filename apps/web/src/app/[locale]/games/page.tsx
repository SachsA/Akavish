import type { Metadata } from 'next'
import { GamesLibrary } from '@/components/GamesLibrary'
import { JsonLd } from '@/components/JsonLd'
import { ContentUnavailable } from '@/components/StatusMessage'
import { alternates } from '@/lib/i18n/metadata'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'
import type { LibraryCompany } from '@/lib/game-library'
import { fetchAllCompanies, fetchAllGames, fetchAllPlatforms, type GameListItem } from '@/lib/payload'
import type { PlatformInfo } from '@/lib/platforms'
import { breadcrumbList } from '@/lib/structured-data'

// The games library: every game on the site, filtered by console, year and
// month of release, studio or publisher, genre, out or upcoming, letter
// (components/GamesLibrary.tsx, in the browser, filters in the URL). The
// server renders the first cards A to Z; every game page is in the sitemap.

export const revalidate = 30

type Params = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = setRequestLocale((await params).locale)
  const t = getMessages()
  return {
    title: t.games.title,
    description: t.games.description,
    alternates: alternates(locale, '/games'),
  }
}

export default async function GamesPage({ params }: Params) {
  const locale = setRequestLocale((await params).locale)
  const t = getMessages()

  let games: GameListItem[] | null = null
  let companies: LibraryCompany[] = []
  let platforms: PlatformInfo[] = []
  try {
    ;[games, companies, platforms] = await Promise.all([
      fetchAllGames(),
      fetchAllCompanies().catch(() => []),
      // Only what the filter and the cards use.
      fetchAllPlatforms()
        .then((list) => list.map(({ value, short, label, family, position }) => ({ value, short, label, family, position })))
        .catch(() => []),
    ])
  } catch {
    games = null
  }
  const today = new Date().toISOString().slice(0, 10)
  const sorted = [...(games ?? [])].sort((a, b) => a.name.localeCompare(b.name, locale))
  const genres = [...new Set(sorted.flatMap((g) => g.genres))].sort()

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <JsonLd data={breadcrumbList([{ name: t.games.title, path: '/games' }], locale)} />
      <header className="mb-8">
        <h1 className="text-4xl font-black tracking-tight text-white">{t.games.title}</h1>
        {games && games.length > 0 && <p className="text-zinc-400 mt-2">{t.games.count(games.length)}</p>}
      </header>

      {!games ? (
        <ContentUnavailable />
      ) : games.length === 0 ? (
        <p className="text-zinc-400">{t.games.none}</p>
      ) : (
        <GamesLibrary
          // Only what the grid and the filters use, to keep the page light.
          games={sorted.map(({ slug, name, cover, releases, developers, publishers, genres }) => ({
            slug,
            name,
            cover,
            releases,
            developers,
            publishers,
            genres,
          }))}
          companies={companies}
          platforms={platforms}
          genres={genres}
          today={today}
        />
      )}
    </div>
  )
}
