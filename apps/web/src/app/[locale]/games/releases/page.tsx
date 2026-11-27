import type { Metadata } from 'next'
import { GamesNav } from '@/components/GamesNav'
import { JsonLd } from '@/components/JsonLd'
import { ReleaseCalendar } from '@/components/ReleaseCalendar'
import { ContentUnavailable } from '@/components/StatusMessage'
import { alternates } from '@/lib/i18n/metadata'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'
import { fetchAllGames, fetchAllPlatforms, type GameListItem } from '@/lib/payload'
import type { PlatformInfo } from '@/lib/platforms'
import { recentRows, releaseRows, upcomingRows } from '@/lib/release-calendar'
import { breadcrumbList } from '@/lib/structured-data'

// The release calendar: every upcoming release of the games library, month
// by month, and the last six months' (lib/release-calendar.ts). Same data as
// /games; the console filter runs in the browser (components/ReleaseCalendar.tsx).

// Safety net only: the CMS pings /api/revalidate on every game change. An
// hour keeps "out" vs "upcoming" right around midnight too.
export const revalidate = 3600

type Params = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = setRequestLocale((await params).locale)
  const t = getMessages()
  return {
    title: t.games.releasesTitle,
    description: t.games.releasesDescription,
    alternates: alternates(locale, '/games/releases'),
  }
}

export default async function ReleasesPage({ params }: Params) {
  const locale = setRequestLocale((await params).locale)
  const t = getMessages()
  let games: GameListItem[] | null = null
  let platforms: PlatformInfo[] = []
  try {
    ;[games, platforms] = await Promise.all([
      fetchAllGames(),
      fetchAllPlatforms()
        .then((list) => list.map(({ value, short, label, family, position }) => ({ value, short, label, family, position })))
        .catch(() => []),
    ])
  } catch {
    games = null
  }
  const today = new Date().toISOString().slice(0, 10)
  const rows = games ? releaseRows(games) : []
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <JsonLd
        data={breadcrumbList(
          [
            { name: t.games.title, path: '/games' },
            { name: t.games.releasesTitle, path: '/games/releases' },
          ],
          locale,
        )}
      />
      <header className="mb-8">
        <h1 className="text-4xl font-black tracking-tight text-white">{t.games.releasesTitle}</h1>
        <p className="text-zinc-400 mt-2">{t.games.releasesDescription}</p>
      </header>
      <GamesNav active="releases" />
      {!games ? (
        <ContentUnavailable />
      ) : (
        <ReleaseCalendar
          upcoming={upcomingRows(rows, today, locale)}
          recent={recentRows(rows, today, locale)}
          platforms={platforms}
        />
      )}
    </div>
  )
}
