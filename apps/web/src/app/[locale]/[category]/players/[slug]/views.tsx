// One esport player (/esport/players/<slug>, 2026-11-27): who they are
// (nickname, real name, country, role; no photo), their team now and its
// matches, their career team by team, their titles, every competition they
// played and with whom, their news. Data: lib/payload.ts fetchEsportPlayer
// (the CMS's PandaScore sync), laid out by lib/esport-players.ts.
import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import { ArticleCard } from '@/components/ArticleCard'
import { DateText } from '@/components/DateText'
import { EsportNav } from '@/components/EsportNav'
import { JsonLd } from '@/components/JsonLd'
import { DateRange } from '@/components/esport/DateRange'
import { ChampionReveal } from '@/components/esport/ChampionReveal'
import { TeamMatches } from '@/components/esport/TeamMatches'
import { ESPORT_GAME_LABEL, type EsportRow } from '@/lib/esport'
import { countryName, editionStatus, editionTitle, type CompetitionTeam, type Edition } from '@/lib/esport-competitions'
import { career, playerTitles, teamNow, type Player } from '@/lib/esport-players'
import type { Lineup } from '@/lib/esport-teams'
import { alternates } from '@/lib/i18n/metadata'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'
import { fetchArticles, fetchEsportPlayer, fetchPlayerPages, fetchTeamPages } from '@/lib/payload'
import { breadcrumbList } from '@/lib/structured-data'
import { GameBadge, Logo, TierBadge } from '../../tournaments/views'

/** Titles won this recently are masked while anti-spoil hides winners. */
const FRESH_MS = 60 * 86_400_000

export async function playerMetadata(rawLocale: string, slug: string): Promise<Metadata> {
  const locale = setRequestLocale(rawLocale)
  const t = getMessages()
  const found = await fetchEsportPlayer(slug).catch(() => null)
  if (!found) return { title: t.meta.notFound }
  const p = found.player
  const game = p.game ? ESPORT_GAME_LABEL[p.game] : ''
  return {
    title: `${p.name}${game ? ` (${game})` : ''}`,
    description: t.esport.playerBlurb(p.name, teamNow(p)?.team.name ?? null),
    alternates: alternates(locale, `/esport/players/${slug}`),
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

function TeamLink({ team }: { team: CompetitionTeam }) {
  return team.slug ? (
    <Link href={`/esport/teams/${team.slug}`} className="inline-flex items-center gap-2 font-semibold text-white hover:text-emerald-400">
      <Logo src={team.logo} size={20} />
      {team.name}
    </Link>
  ) : (
    <span className="inline-flex items-center gap-2 font-semibold text-white">
      <Logo src={team.logo} size={20} />
      {team.name}
    </span>
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

/** Teammates, each linked to their page when they have one. */
function Mates({ lineup, self, pages }: { lineup: Lineup; self: number; pages: Record<number, string> }) {
  const mates = lineup.players.filter((p) => p.pandaId !== self)
  return (
    <>
      {mates.map((p, i) => (
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

export async function PlayerView({
  rawLocale,
  found,
}: {
  rawLocale: string
  found: { player: Player; lineups: Lineup[]; matches: EsportRow[] }
}) {
  const locale = setRequestLocale(rawLocale)
  const t = getMessages()
  const { player: p, lineups, matches } = found
  const now = new Date().getTime()
  const now_ = teamNow(p)
  const team = now_?.team ?? null
  const stints = career(lineups)
  const titles = playerTitles(lineups)
  const played = lineups.filter((l) => editionStatus(l.edition) !== 'upcoming')
  const next = matches
    .filter((m) => m.status === 'running' || (m.status === 'not_started' && Date.parse(m.at) > now - 6 * 3600_000))
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 5)
  const last = matches.filter((m) => m.status === 'finished').slice(0, 5)
  const [playerPages, teamPages, news] = await Promise.all([
    fetchPlayerPages(played.slice(0, 40).flatMap((l) => l.players.map((x) => x.pandaId))).catch(
      () => ({}) as Record<number, string>
    ),
    fetchTeamPages([...next, ...last].flatMap((m) => [m.t1.id, m.t2.id]).filter((x): x is number => x != null)).catch(
      () => ({}) as Record<number, string>
    ),
    fetchArticles({ playerId: p.id, limit: 8 }).catch(() => null),
  ])
  const realName = [p.firstName, p.lastName].filter(Boolean).join(' ')
  const where = countryName(p.nationality, locale)
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <JsonLd
        data={[
          breadcrumbList(
            [
              { name: t.categories.esport.label, path: '/esport' },
              ...(team?.slug ? [{ name: team.name, path: `/esport/teams/${team.slug}` }] : []),
              { name: p.name, path: `/esport/players/${p.slug}` },
            ],
            locale
          ),
          {
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: realName || p.name,
            alternateName: p.name,
            ...(p.nationality ? { nationality: p.nationality } : {}),
            ...(team ? { memberOf: { '@type': 'SportsTeam', name: team.name } } : {}),
          },
        ]}
      />
      <header className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">{p.name}</h1>
        {realName && <p className="mt-1 text-lg text-zinc-300">{realName}</p>}
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
          {p.game && <GameBadge game={p.game} />}
          {where && <span>{where}</span>}
          {p.role && <span>· {p.role}</span>}
          {titles.length > 0 && <span>· {t.esport.titlesCount(titles.length)}</span>}
        </p>
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs uppercase tracking-wide text-zinc-400">
            {now_ && !now_.current ? t.esport.lastTeam : t.esport.teamNow}
          </span>
          {team ? <TeamLink team={team} /> : <span className="text-zinc-300">{t.esport.noTeam}</span>}
        </p>
      </header>
      <EsportNav active="competitions" game={p.game} />

      {team && next.length > 0 && (
        <section aria-labelledby="p-next" className="mb-10">
          <SectionTitle id="p-next">{t.esport.teamNextMatches(team.name)}</SectionTitle>
          <TeamMatches rows={next} team={team.pandaId!} teamPages={teamPages} />
        </section>
      )}
      {team && last.length > 0 && (
        <section aria-labelledby="p-last" className="mb-10">
          <SectionTitle id="p-last">{t.esport.teamLastResults(team.name)}</SectionTitle>
          <TeamMatches rows={last} team={team.pandaId!} teamPages={teamPages} />
        </section>
      )}

      {stints.length > 0 && (
        <section aria-labelledby="p-career" className="mb-10">
          <SectionTitle id="p-career">{t.esport.career}</SectionTitle>
          <ol className="divide-y divide-zinc-800">
            {stints.map((s, i) => (
              <li key={`${s.from}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <TeamLink team={s.team} />
                <span className="text-xs text-zinc-400">
                  {s.from && s.to !== s.from ? (
                    <DateRange start={s.from} end={s.to} />
                  ) : (
                    s.from && <DateText iso={s.from} style="short" />
                  )}{' '}
                  · {t.esport.editions(s.editions)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {titles.length > 0 && (
        <section aria-labelledby="p-titles" className="mb-10">
          <SectionTitle id="p-titles">{t.esport.titles}</SectionTitle>
          <ul className="divide-y divide-zinc-800">
            {titles.map((l) => {
              const row = (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <EditionLink e={l.edition} />
                  <TierBadge tier={l.edition.tier} />
                  {l.team && <span className="text-xs text-zinc-400">{t.esport.withTeam(l.team.name)}</span>}
                </span>
              )
              const fresh = l.edition.endAt && now - Date.parse(l.edition.endAt) < FRESH_MS
              return (
                <li key={l.edition.id} className="py-2.5 text-sm">
                  {fresh && p.game ? (
                    <ChampionReveal game={p.game} team={l.team?.pandaId ?? null} label={t.esport.showTitle}>
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

      {played.length > 0 && (
        <section aria-labelledby="p-played" className="mb-10">
          <SectionTitle id="p-played">{t.esport.played(played.length)}</SectionTitle>
          <ul className="divide-y divide-zinc-800">
            {played.slice(0, 40).map((l) => (
              <li key={l.edition.id} className="py-2.5 text-sm">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <EditionLink e={l.edition} />
                  <TierBadge tier={l.edition.tier} />
                  <span className="text-xs text-zinc-400">
                    <DateRange start={l.edition.beginAt} end={l.edition.endAt} />
                  </span>
                </span>
                {l.team && (
                  <span className="mt-1 block text-xs text-zinc-500">
                    {l.team.name} · <Mates lineup={l} self={p.pandaId} pages={playerPages} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="p-news" className="mb-10">
        <SectionTitle id="p-news">{t.esport.compNews}</SectionTitle>
        {news && news.data.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {news.data.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        ) : (
          <p className="text-zinc-400">{t.esport.playerNoNews}</p>
        )}
      </section>
      <p className="mt-10 text-xs text-zinc-400">{t.esport.teamSource}</p>
    </div>
  )
}
