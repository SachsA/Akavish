// /esport/transfers: the esport articles tagged "transfers" (Mercato in
// French): signings, departures, roster moves. Only under /esport.
// transfers/[game] (/esport/transfers/cs2) is the same page for one game.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { Article } from '@akavish/types'
import { ArticlesByDate } from '@/components/ArticlesByDate'
import { EsportNav } from '@/components/EsportNav'
import { EsportGameFilter } from '@/components/EsportGameFilter'
import { ESPORT_GAME_LABEL, ESPORT_GAME_SLUGS, isEsportGame, type EsportGame } from '@/lib/esport'
import { JsonLd } from '@/components/JsonLd'
import { ContentUnavailable } from '@/components/StatusMessage'
import { alternates } from '@/lib/i18n/metadata'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'
import { fetchArticles, fetchGameIdsBySlugs, fetchTagBySlug } from '@/lib/payload'
import { TAGS } from '@/lib/revalidate'
import { breadcrumbList } from '@/lib/structured-data'
import { LOCALES } from '@/lib/i18n/config'

// Safety net only: the CMS pings /api/revalidate on every change (lib/revalidate.ts).
export const revalidate = 3600

// Only /esport has it; listing it keeps the page cached (ISR) instead of per request.
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale, category: 'esport' }))
}

/** The tag the scout puts on roster news. */
export const TRANSFERS_TAG = 'transfers'

type Params = { params: Promise<{ locale: string; category: string; game?: string }> }

/** The game of /esport/transfers/<game>: null without one, false for a wrong one. */
const gameOf = (category: string, game?: string): EsportGame | null | false =>
  category !== 'esport' ? false : game === undefined ? null : isEsportGame(game) ? game : false

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale: raw, category, game: rawGame } = await params
  const locale = setRequestLocale(raw)
  const t = getMessages()
  const game = gameOf(category, rawGame)
  if (game === false) return { title: t.meta.notFound }
  return {
    title: game
      ? t.esport.withGame(t.esport.transfersTitle, ESPORT_GAME_LABEL[game])
      : t.esport.transfersTitle,
    description: t.esport.transfersBlurb,
    alternates: alternates(locale, game ? `/esport/transfers/${game}` : '/esport/transfers'),
  }
}

export default async function TransfersPage({ params }: Params) {
  const { locale: raw, category, game: rawGame } = await params
  const locale = setRequestLocale(raw)
  const game = gameOf(category, rawGame)
  if (game === false) notFound()
  const t = getMessages()
  const title = game
    ? t.esport.withGame(t.esport.transfersTitle, ESPORT_GAME_LABEL[game])
    : t.esport.transfersTitle
  let articles: Article[] | null = []
  try {
    const tag = await fetchTagBySlug(TRANSFERS_TAG)
    if (tag) {
      const gameIds = game ? await fetchGameIdsBySlugs(ESPORT_GAME_SLUGS[game]) : undefined
      articles = (
        await fetchArticles({
          tagId: tag.id,
          gameIds,
          limit: 30,
          cacheTags: [TAGS.tag(TRANSFERS_TAG), TAGS.games],
        })
      ).data
    }
  } catch {
    articles = null
  }
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <JsonLd
        data={breadcrumbList(
          [
            { name: t.categories.esport.label, path: '/esport' },
            { name: t.esport.transfersTitle, path: '/esport/transfers' },
            ...(game ? [{ name: ESPORT_GAME_LABEL[game], path: `/esport/transfers/${game}` }] : []),
          ],
          locale,
        )}
      />
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tight text-white">{title}</h1>
        <p className="text-zinc-400 mt-2">{t.esport.transfersBlurb}</p>
      </header>
      <EsportNav active="transfers" game={game} />
      <EsportGameFilter base="/esport/transfers" active={game} />
      {articles === null ? (
        <ContentUnavailable />
      ) : articles.length === 0 ? (
        <p className="text-zinc-400">
          {game
            ? t.status.nothingBody(t.status.articles)
            : t.status.nothingBody(t.esport.transfers.toLowerCase())}
        </p>
      ) : (
        // Like the other sections: the 4 newest, then by day (esport).
        <ArticlesByDate articles={articles} unit="day" locale={locale} />
      )}
    </div>
  )
}
