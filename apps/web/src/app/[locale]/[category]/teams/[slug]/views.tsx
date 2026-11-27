// One esport team (/esport/teams/<slug>, 2026-11-27): who plays now, its next
// matches and last results, its titles, every edition it played with its
// lineup, its roster changes, its news. Data: lib/payload.ts fetchEsportTeam
// (the CMS's PandaScore sync), laid out by lib/esport-teams.ts. Results and
// titles follow anti-spoil. No player photos.
import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import { ArticleCard } from '@/components/ArticleCard'
import { EsportNav } from '@/components/EsportNav'
import { JsonLd } from '@/components/JsonLd'
import { DateRange } from '@/components/esport/DateRange'
import { DateText } from '@/components/DateText'
import { ChampionReveal } from '@/components/esport/ChampionReveal'
import { EsportFollowButton } from '@/components/esport/EsportFollowButton'
import { TeamMatches } from '@/components/esport/TeamMatches'
import { ESPORT_GAME_LABEL, type EsportRow } from '@/lib/esport'
import { countryName, editionStatus, editionTitle, type Edition } from '@/lib/esport-competitions'
import { rosterHistory, rosterMoves, type Lineup, type Team, type TeamPlayer } from '@/lib/esport-teams'
import { alternates } from '@/lib/i18n/metadata'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'
import { fetchArticles, fetchEsportTeam, fetchPlayerPages, fetchTeamPages } from '@/lib/payload'
import { breadcrumbList } from '@/lib/structured-data'
import { GameBadge, Logo, TierBadge } from '../../tournaments/views'

/** Titles won this recently are masked while anti-spoil hides winners. */
const FRESH_MS = 60 * 86_400_000

export async function teamMetadata(rawLocale: string, slug: string): Promise<Metadata> {
  const locale = setRequestLocale(rawLocale)
  const t = getMessages()
  const found = await fetchEsportTeam(slug).catch(() => null)
  if (!found) return { title: t.meta.notFound }
  const team = found.team
  return {
    title: `${team.name} (${ESPORT_GAME_LABEL[team.game]})`,
    description: t.esport.teamBlurb(team.name, ESPORT_GAME_LABEL[team.game]),
    alternates: alternates(locale, `/esport/teams/${slug}`),
  }
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="mb-4 pb-2 border-b border-zinc-800 text-sm font-semibold uppercase tracking-wider text-zinc-400"
    >
      {children}
    </h2>
  )
}

/** Players, each linked to their page when they have one. */
function PlayerNames({ players, pages }: { players: TeamPlayer[]; pages: Record<number, string> }) {
  return (
    <>
      {players.map((p, i) => (
        <span key={p.pandaId}>
          {i > 0 && ', '}
          {pages[p.pandaId] ? (
            <Link href={`/esport/players/${pages[p.pandaId]}`} className="hover:text-emerald-400">
              {p.name}
            </Link>
          ) : (
            p.name
          )}
        </span>
      ))}
    </>
  )
}

function EditionLink({ e }: { e: Edition }) {
  const c = e.competition
  const title = c ? editionTitle(c.name, e.name) : e.name
  return c ? (
    <Link href={`/esport/competitions/${c.slug}`} className="font-semibold text-white hover:text-emerald-400">
      {title}
    </Link>
  ) : (
    <span className="font-semibold text-white">{title}</span>
  )
}

export async function TeamView({
  rawLocale,
  found,
}: {
  rawLocale: string
  found: { team: Team; lineups: Lineup[]; titles: Edition[]; matches: EsportRow[] }
}) {
  const locale = setRequestLocale(rawLocale)
  const t = getMessages()
  const { team, lineups, titles, matches } = found
  const now = new Date().getTime()
  const next = matches
    .filter((m) => m.status === 'running' || (m.status === 'not_started' && Date.parse(m.at) > now - 6 * 3600_000))
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 8)
  const last = matches.filter((m) => m.status === 'finished').slice(0, 10)
  const history = rosterHistory(lineups)
  // Who plays now: PandaScore's current roster, else the latest lineup.
  const roster = team.players.length ? team.players : (history[0]?.players ?? [])
  const played = lineups.filter((l) => editionStatus(l.edition) !== 'upcoming')
  const [playerPages, teamPages, news] = await Promise.all([
    fetchPlayerPages([
      ...roster,
      ...history.slice(0, 13).flatMap((h) => h.players),
      ...played.slice(0, 40).flatMap((l) => l.players),
    ].map((x) => x.pandaId)).catch(() => ({}) as Record<number, string>),
    fetchTeamPages([...next, ...last].flatMap((m) => [m.t1.id, m.t2.id]).filter((x): x is number => x != null)).catch(
      () => ({}) as Record<number, string>
    ),
    fetchArticles({ teamId: team.id, limit: 8 }).catch(() => null),
  ])
  const where = countryName(team.location, locale)
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <JsonLd
        data={[
          breadcrumbList(
            [
              { name: t.categories.esport.label, path: '/esport' },
              { name: t.esport.competitionsTitle, path: '/esport/competitions' },
              { name: team.name, path: `/esport/teams/${team.slug}` },
            ],
            locale
          ),
          {
            '@context': 'https://schema.org',
            '@type': 'SportsTeam',
            name: team.name,
            sport: ESPORT_GAME_LABEL[team.game],
            ...(team.logo ? { logo: team.logo } : {}),
            ...(roster.length ? { athlete: roster.map((p) => ({ '@type': 'Person', name: p.name })) } : {}),
          },
        ]}
      />
      <header className="mb-10 flex items-start gap-4">
        <Logo src={team.logo} size={72} />
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">{team.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            <GameBadge game={team.game} />
            <TierBadge tier={team.tier} />
            {team.acronym && team.acronym !== team.name && <span>{team.acronym}</span>}
            {where && <span>· {where}</span>}
            {titles.length > 0 && <span>· {t.esport.titlesCount(titles.length)}</span>}
          </p>
          <div className="mt-4">
            <EsportFollowButton
              look="button"
              follow={{
                kind: 'team',
                pandaId: team.pandaId,
                game: team.game,
                label: team.name,
                acronym: team.acronym,
                logo: team.logo,
                slug: null,
                at: null,
              }}
            />
          </div>
        </div>
      </header>
      <EsportNav active="competitions" game={team.game} />

      {roster.length > 0 && (
        <section aria-labelledby="t-roster" className="mb-10">
          <SectionTitle id="t-roster">{t.esport.roster}</SectionTitle>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {roster.map((p) => (
              <li key={p.pandaId} className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-3">
                {playerPages[p.pandaId] ? (
                  <Link
                    href={`/esport/players/${playerPages[p.pandaId]}`}
                    className="block truncate font-bold text-white hover:text-emerald-400"
                  >
                    {p.name}
                  </Link>
                ) : (
                  <span className="block truncate font-bold text-white">{p.name}</span>
                )}
                {(p.firstName || p.lastName) && (
                  <span className="block truncate text-xs text-zinc-400">
                    {[p.firstName, p.lastName].filter(Boolean).join(' ')}
                  </span>
                )}
                <span className="mt-1 block truncate text-xs text-zinc-500">
                  {[countryName(p.nationality, locale), p.role].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {next.length > 0 && (
        <section aria-labelledby="t-next" className="mb-10">
          <SectionTitle id="t-next">{t.esport.nextMatches}</SectionTitle>
          <TeamMatches rows={next} team={team.pandaId} teamPages={teamPages} />
        </section>
      )}
      {last.length > 0 && (
        <section aria-labelledby="t-last" className="mb-10">
          <SectionTitle id="t-last">{t.esport.lastResults}</SectionTitle>
          <TeamMatches rows={last} team={team.pandaId} teamPages={teamPages} />
        </section>
      )}

      {titles.length > 0 && (
        <section aria-labelledby="t-titles" className="mb-10">
          <SectionTitle id="t-titles">{t.esport.titles}</SectionTitle>
          <ul className="divide-y divide-zinc-800">
            {titles.map((e) => {
              const row = (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <EditionLink e={e} />
                  <TierBadge tier={e.tier} />
                  <span className="text-xs text-zinc-400">
                    <DateRange start={e.beginAt} end={e.endAt} />
                  </span>
                </span>
              )
              const fresh = e.endAt && now - Date.parse(e.endAt) < FRESH_MS
              return (
                <li key={e.id} className="py-2.5 text-sm">
                  {fresh ? (
                    <ChampionReveal game={team.game} team={team.pandaId} label={t.esport.showTitle}>
                      {row}
                    </ChampionReveal>
                  ) : (
                    row
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <section aria-labelledby="t-history" className="mb-10">
          <SectionTitle id="t-history">{t.esport.rosterHistory}</SectionTitle>
          <ol className="space-y-3">
            {history.slice(0, 12).map((period, i) => {
              const older = history[i + 1]
              const moves = older ? rosterMoves(period, older) : null
              return (
                <li key={`${period.from}-${i}`} className="rounded-lg border border-zinc-800 px-4 py-3 text-sm">
                  <p className="text-xs text-zinc-400">
                    {period.from && period.to !== period.from ? (
                      <DateRange start={period.from} end={period.to} />
                    ) : (
                      period.from && <DateText iso={period.from} style="short" />
                    )}{' '}
                    ·{' '}
                    {t.esport.editions(period.editions)}
                  </p>
                  <p className="mt-1 font-semibold text-white">
                    <PlayerNames players={period.players} pages={playerPages} />
                  </p>
                  {moves && (moves.joined.length > 0 || moves.left.length > 0) && (
                    <p className="mt-1 text-xs text-zinc-400">
                      {moves.joined.length > 0 && (
                        <span className="text-emerald-400">
                          + <PlayerNames players={moves.joined} pages={playerPages} />
                        </span>
                      )}
                      {moves.joined.length > 0 && moves.left.length > 0 && ' · '}
                      {moves.left.length > 0 && (
                        <span className="text-red-400">
                          − <PlayerNames players={moves.left} pages={playerPages} />
                        </span>
                      )}
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {played.length > 0 && (
        <section aria-labelledby="t-played" className="mb-10">
          <SectionTitle id="t-played">{t.esport.played(played.length)}</SectionTitle>
          <ul className="divide-y divide-zinc-800">
            {played.slice(0, 40).map((l) => (
              <li key={l.edition.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <EditionLink e={l.edition} />
                <TierBadge tier={l.edition.tier} />
                <span className="text-xs text-zinc-400">
                  <DateRange start={l.edition.beginAt} end={l.edition.endAt} />
                </span>
                {l.players.length > 0 && (
                  <span className="w-full text-xs text-zinc-500 sm:w-auto">
                    <PlayerNames players={l.players} pages={playerPages} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="t-news" className="mb-10">
        <SectionTitle id="t-news">{t.esport.compNews}</SectionTitle>
        {news && news.data.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {news.data.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        ) : (
          <p className="text-zinc-400">{t.esport.teamNoNews}</p>
        )}
      </section>
      <p className="mt-10 text-xs text-zinc-400">{t.esport.teamSource}</p>
    </div>
  )
}
