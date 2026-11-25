import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import Link from '@/components/LocaleLink'
import { getMessages, localHref, setRequestLocale } from '@/lib/i18n/server'
import { currentUser } from '@clerk/nextjs/server'
import { AccountActions } from '@/components/AccountActions'
import { SpoilerPreference } from '@/components/SpoilerPreference'
import { NotifySettings } from '@/components/NotifySettings'
import { EsportFollowsManager, type TeamChoice } from '@/components/esport/EsportFollowsManager'
import { Pagination } from '@/components/Pagination'
import { RoleBadge } from '@/components/RoleBadge'
import { SavedArticleList, type SavedItem } from '@/components/SavedArticleList'
import { parsePage } from '@/lib/pagination'
import {
  fetchFollowedGames,
  fetchSavedArticles,
  profileFromUser,
  syncReader,
  type FollowedGame,
  type Reader,
} from '@/lib/readers'
import { ArticleCard } from '@/components/ArticleCard'
import { GameCard } from '@/components/GameCard'
import { fetchArticles, fetchEsportMatches } from '@/lib/payload'
import type { Article } from '@akavish/types'
import { log } from '@/lib/log'

// The signed-in reader's page: who they are (with their badge), the games
// they follow with the latest news about them, and the articles they saved. Protected by the middleware (`/account(.*)`), personal,
// so never cached and never indexed.
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  setRequestLocale((await params).locale)
  return { title: getMessages().account.title, robots: { index: false } }
}

const SAVED_PER_PAGE = 12
/** Latest articles about the followed games, under them. */
const GAMES_NEWS = 6

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ page?: string | string[] }>
}) {
  setRequestLocale((await params).locale)
  const t = getMessages()
  const page = parsePage((await searchParams).page)
  if (page === null) notFound()

  const user = await currentUser()
  if (!user) redirect(`${localHref('/sign-in')}?redirect_url=${localHref('/account')}`)

  const profile = profileFromUser(user)
  const name = profile.displayName ?? profile.username ?? profile.email ?? t.account.reader

  // The CMS side (role, saved articles) can be down or not configured: the
  // page still shows who you are, and says the rest is unavailable.
  let reader: Reader | null = null
  let saved: Awaited<ReturnType<typeof fetchSavedArticles>> | null = null
  let games: FollowedGame[] | null = null
  let gamesNews: Article[] = []
  try {
    reader = await syncReader(profile)
    ;[saved, games] = await Promise.all([
      fetchSavedArticles(user.id, { page, limit: SAVED_PER_PAGE }),
      fetchFollowedGames(user.id).catch(() => null),
    ])
    if (games?.length) {
      gamesNews =
        (
          await fetchArticles({ gameIds: games.map((g) => g.id), limit: GAMES_NEWS }).catch(
            () => null,
          )
        )?.data ?? []
    }
  } catch (error) {
    log.warn('account page without reader data', { error })
  }
  if (saved && page > 1 && page > saved.totalPages) notFound()

  const items: SavedItem[] = (saved?.articles ?? []).map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    category: a.category,
    coverImage: a.coverImageCard ?? a.coverImage,
    game: a.game?.name,
    savedAt: a.savedAt,
  }))

  // The teams of this week's matches, to follow one by name (Esport section).
  const teams: TeamChoice[] = []
  if (page === 1) {
    const rows = (
      await Promise.all([fetchEsportMatches('calendar').catch(() => []), fetchEsportMatches('results').catch(() => [])])
    ).flat()
    const seen = new Set<number>()
    for (const r of rows) {
      for (const team of [r.t1, r.t2]) {
        if (!team.id || seen.has(team.id) || team.name === 'TBD') continue
        seen.add(team.id)
        teams.push({ id: team.id, name: team.name, acronym: team.acronym, logo: team.logo, game: r.game })
      }
    }
    teams.sort((a, b) => a.name.localeCompare(b.name))
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="flex items-center gap-4 mb-10">
        {profile.imageUrl && (
          <Image
            src={profile.imageUrl}
            alt=""
            width={64}
            height={64}
            // Clerk's own CDN, already sized: no need to route it through ours.
            unoptimized
            className="w-16 h-16 rounded-full bg-zinc-800 object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-black tracking-tight text-white">
            <span className="truncate">{name}</span>
            <RoleBadge role={reader?.role} />
          </h1>
          {profile.email && <p className="text-sm text-zinc-400 truncate">{profile.email}</p>}
          {reader && (
            <p className="text-sm text-zinc-400">
              {t.account.commentsAs}{' '}
              <span className="text-zinc-200 font-medium">@{reader.username}</span>
            </p>
          )}
          {!profile.emailVerified && <p className="text-sm text-danger">{t.account.verifyEmail}</p>}
          {reader?.authorSlug && (
            <Link
              href={`/author/${reader.authorSlug}`}
              className="text-sm text-zinc-300 hover:text-white underline underline-offset-2"
            >
              {t.account.authorPage}
            </Link>
          )}
        </div>
      </div>

      <div className="mb-12">
        <AccountActions />
      </div>

      {page === 1 && (
        <section aria-labelledby="preferences" className="mb-12">
          <h2 id="preferences" className="text-xl font-bold text-white mb-4 scroll-mt-24">
            {t.spoilers.prefTitle}
          </h2>
          <div className="space-y-4">
            <SpoilerPreference />
            <NotifySettings />
          </div>
        </section>
      )}

      {page === 1 && (
        <section aria-labelledby="esport" className="mb-12">
          <h2 id="esport" className="text-xl font-bold text-white mb-4 scroll-mt-24">
            {t.esportFollow.title}
          </h2>
          <EsportFollowsManager teams={teams} />
        </section>
      )}

      {page === 1 && (
        <>
          <h2 id="games" className="text-xl font-bold text-white mb-4 scroll-mt-24">
            {t.account.games}
            {games && games.length > 0 ? ` (${games.length})` : ''}
          </h2>
          {!games ? (
            <p className="text-zinc-400 mb-12">{t.account.gamesUnavailable}</p>
          ) : games.length === 0 ? (
            <p className="text-zinc-400 mb-12">{t.account.nothingFollowed(t.follow.follow)}</p>
          ) : (
            <>
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
                {games.map((g) => (
                  <li key={g.id}>
                    <GameCard slug={g.slug} name={g.name} cover={g.cover} />
                  </li>
                ))}
              </ul>
              <h2 className="text-xl font-bold text-white mb-4">{t.account.gamesNews}</h2>
              {gamesNews.length === 0 ? (
                <p className="text-zinc-400 mb-12">{t.account.noGamesNews}</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
                  {gamesNews.map((a) => (
                    <ArticleCard key={a.id} article={a} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      <h2 id="saved" className="text-xl font-bold text-white mb-4 scroll-mt-24">
        {t.account.saved}
        {saved && saved.total > 0 ? ` (${saved.total})` : ''}
      </h2>

      {!saved ? (
        <p className="text-zinc-400">{t.account.unavailable}</p>
      ) : saved.total === 0 ? (
        <p className="text-zinc-400">{t.account.nothingSaved(t.save.save)}</p>
      ) : (
        <>
          <SavedArticleList items={items} />
          <Pagination basePath="/account" page={saved.page} totalPages={saved.totalPages} />
        </>
      )}
    </div>
  )
}
