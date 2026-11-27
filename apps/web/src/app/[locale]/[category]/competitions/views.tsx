// /esport/competitions (all games, or one: /esport/competitions/cs2) and one
// competition (/esport/competitions/<slug>, e.g. cs2-pgl-major): its editions
// on now and coming, its past editions with their winner, its news. Data: the
// CMS's hourly PandaScore sync (esport-leagues / esport-series), laid out by
// lib/esport-competitions.ts. Winners follow anti-spoil (ChampionReveal).
import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import { ArticleCard } from '@/components/ArticleCard'
import { EsportNav } from '@/components/EsportNav'
import { EsportGameFilter } from '@/components/EsportGameFilter'
import { JsonLd } from '@/components/JsonLd'
import { ContentUnavailable } from '@/components/StatusMessage'
import { DateRange } from '@/components/esport/DateRange'
import { ChampionReveal } from '@/components/esport/ChampionReveal'
import { ESPORT_GAME_LABEL, type EsportGame } from '@/lib/esport'
import {
  countryName,
  editionStatus,
  editionTitle,
  formatPrize,
  groupEditions,
  palmares,
  sortCompetitions,
  type Competition,
  type CompetitionTeam,
  type Edition,
} from '@/lib/esport-competitions'
import { alternates } from '@/lib/i18n/metadata'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'
import {
  fetchArticles,
  fetchEsportCompetitions,
  fetchEsportEditionsAround,
  fetchStagePages,
} from '@/lib/payload'
import { breadcrumbList } from '@/lib/structured-data'
import { GameBadge, Logo, TierBadge } from '../tournaments/views'

function Champion({ team, game }: { team: CompetitionTeam; game: EsportGame }) {
  return (
    <ChampionReveal game={game} team={team.pandaId}>
      <Logo src={team.logo} size={20} />
      <span className="truncate font-semibold text-white">{team.name}</span>
    </ChampionReveal>
  )
}

/** Its stages as chips: a link when the stage has its tournament page. */
function StageChips({ e, pages }: { e: Edition; pages: Set<string> }) {
  if (e.stages.length < 2 && !e.stages.some((s) => s.slug && pages.has(s.slug))) return null
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {e.stages.map((s) => (
        <li key={s.pandaId}>
          {s.slug && pages.has(s.slug) ? (
            <Link
              href={`/esport/tournaments/${s.slug}`}
              className="inline-flex h-7 items-center rounded-full border border-zinc-700 px-3 text-xs text-zinc-200 hover:border-emerald-500 hover:text-white"
            >
              {s.name}
            </Link>
          ) : (
            <span className="inline-flex h-7 items-center rounded-full border border-zinc-800 px-3 text-xs text-zinc-400">
              {s.name}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

function EditionCard({ e, pages, locale }: { e: Edition; pages: Set<string>; locale: string }) {
  const t = getMessages()
  const c = e.competition
  const title = c ? editionTitle(c.name, e.name) : e.name
  const prize = formatPrize(e.prizePool, locale)
  const where = countryName(e.country, locale)
  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-start gap-3">
        <Logo src={c?.logo ?? null} size={36} />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-snug text-white">
            {c ? (
              <Link href={`/esport/competitions/${c.slug}`} className="hover:text-emerald-400">
                {title}
              </Link>
            ) : (
              title
            )}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <GameBadge game={e.game} />
            <TierBadge tier={e.tier} />
            <DateRange start={e.beginAt} end={e.endAt} />
            {where && <span>· {where}</span>}
            {prize && <span>· {prize}</span>}
          </p>
          {e.winner && editionStatus(e) === 'past' && (
            <p className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
              <span className="text-xs uppercase tracking-wide">{t.esport.winner}</span>
              <Champion team={e.winner} game={e.game} />
            </p>
          )}
        </div>
      </div>
      <StageChips e={e} pages={pages} />
    </article>
  )
}

function CompetitionRow({ c }: { c: Competition }) {
  const t = getMessages()
  return (
    <li className="flex items-center gap-3 py-3">
      <Logo src={c.logo} size={32} />
      <div className="min-w-0 flex-1">
        <Link href={`/esport/competitions/${c.slug}`} className="font-semibold text-white hover:text-emerald-400">
          {c.name}
        </Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <GameBadge game={c.game} />
          <TierBadge tier={c.tier} />
          {c.editions > 0 && <span>{t.esport.editions(c.editions)}</span>}
        </p>
      </div>
      {c.champion && (
        <div className="hidden min-w-0 max-w-[45%] text-right text-xs text-zinc-400 sm:block">
          <span className="block">
            {t.esport.lastWinner} · {c.champion.edition}
          </span>
          <span className="mt-1 inline-flex justify-end text-sm">
            <Champion team={c.champion.team} game={c.game} />
          </span>
        </div>
      )}
    </li>
  )
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

export async function competitionsIndexMetadata(rawLocale: string, game: EsportGame | null): Promise<Metadata> {
  const locale = setRequestLocale(rawLocale)
  const t = getMessages()
  const title = game ? t.esport.withGame(t.esport.competitionsTitle, ESPORT_GAME_LABEL[game]) : t.esport.competitionsTitle
  const path = game ? `/esport/competitions/${game}` : '/esport/competitions'
  return { title, description: t.esport.competitionsBlurb, alternates: alternates(locale, path) }
}

export async function CompetitionsIndex({ rawLocale, game }: { rawLocale: string; game: EsportGame | null }) {
  const locale = setRequestLocale(rawLocale)
  const t = getMessages()
  const [competitions, editions] = await Promise.all([
    fetchEsportCompetitions().catch(() => null),
    fetchEsportEditionsAround().catch(() => null),
  ])
  const mine = <T extends { game: EsportGame }>(xs: T[] | null) => (xs ?? []).filter((x) => !game || x.game === game)
  const { running, upcoming, recent } = groupEditions(mine(editions))
  const { active, archive } = sortCompetitions(mine(competitions))
  const shown = [...running, ...upcoming, ...recent]
  const pages = await fetchStagePages(
    [...new Set(shown.flatMap((e) => e.stages.flatMap((s) => (s.slug ? [s.slug] : []))))].slice(0, 300)
  ).catch(() => new Set<string>())
  const title = game ? t.esport.withGame(t.esport.competitionsTitle, ESPORT_GAME_LABEL[game]) : t.esport.competitionsTitle
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <JsonLd
        data={breadcrumbList(
          [
            { name: t.categories.esport.label, path: '/esport' },
            { name: t.esport.competitionsTitle, path: '/esport/competitions' },
            ...(game ? [{ name: ESPORT_GAME_LABEL[game], path: `/esport/competitions/${game}` }] : []),
          ],
          locale
        )}
      />
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tight text-white">{title}</h1>
        <p className="text-zinc-400 mt-2">{t.esport.competitionsBlurb}</p>
      </header>
      <EsportNav active="competitions" game={game} />
      <EsportGameFilter base="/esport/competitions" active={game} />
      {competitions === null ? (
        <ContentUnavailable />
      ) : competitions.length === 0 ? (
        <p className="text-zinc-400">{t.esport.compNone}</p>
      ) : (
        <>
          {[
            { id: 'running', label: t.esport.compRunning, list: running },
            { id: 'upcoming', label: t.esport.compUpcoming, list: upcoming },
            { id: 'recent', label: t.esport.compRecent, list: recent },
          ].map(
            (s) =>
              s.list.length > 0 && (
                <section key={s.id} aria-labelledby={`c-${s.id}`} className="mb-10">
                  <SectionTitle id={`c-${s.id}`}>{s.label}</SectionTitle>
                  <div className="grid gap-4 md:grid-cols-2">
                    {s.list.map((e) => (
                      <EditionCard key={e.id} e={e} pages={pages} locale={locale} />
                    ))}
                  </div>
                  {s.id === 'upcoming' && <p className="mt-3 text-xs text-zinc-400">{t.esport.compSoon}</p>}
                </section>
              )
          )}
          <section aria-labelledby="c-all">
            <SectionTitle id="c-all">{t.esport.compAll}</SectionTitle>
            <ul className="divide-y divide-zinc-800">
              {active.map((c) => (
                <CompetitionRow key={c.id} c={c} />
              ))}
            </ul>
            {archive.length > 0 && (
              <details className="mt-6">
                <summary className="cursor-pointer text-sm font-semibold text-zinc-300 hover:text-white">
                  {t.esport.compArchive(archive.length)}
                </summary>
                <ul className="mt-2 divide-y divide-zinc-800">
                  {archive.map((c) => (
                    <CompetitionRow key={c.id} c={c} />
                  ))}
                </ul>
              </details>
            )}
          </section>
          <p className="mt-10 text-xs text-zinc-400">{t.esport.compSource}</p>
        </>
      )}
    </div>
  )
}

// ─── One competition ─────────────────────────────────────────────────────────

export async function competitionMetadata(
  rawLocale: string,
  found: { competition: Competition } | null,
  slug: string
): Promise<Metadata> {
  const locale = setRequestLocale(rawLocale)
  const t = getMessages()
  if (!found) return { title: t.meta.notFound }
  const c = found.competition
  return {
    title: `${c.name} (${ESPORT_GAME_LABEL[c.game]})`,
    description: t.esport.competitionsBlurb,
    alternates: alternates(locale, `/esport/competitions/${slug}`),
  }
}

function PalmaresTable({ rows, locale }: { rows: Edition[]; locale: string }) {
  const t = getMessages()
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-400">
            <th className="py-2 pr-3 font-semibold">{t.esport.edition}</th>
            <th className="py-2 pr-3 font-semibold">{t.esport.dates}</th>
            <th className="hidden py-2 pr-3 font-semibold sm:table-cell">{t.esport.where}</th>
            <th className="hidden py-2 pr-3 font-semibold sm:table-cell">{t.esport.prize}</th>
            <th className="py-2 font-semibold">{t.esport.winner}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {rows.map((e) => (
            <tr key={e.id}>
              <td className="py-2.5 pr-3 font-semibold text-white">{e.name}</td>
              <td className="py-2.5 pr-3 text-zinc-400">
                <DateRange start={e.beginAt} end={e.endAt} />
              </td>
              <td className="hidden py-2.5 pr-3 text-zinc-400 sm:table-cell">{countryName(e.country, locale) ?? '–'}</td>
              <td className="hidden py-2.5 pr-3 text-zinc-400 sm:table-cell">{formatPrize(e.prizePool, locale) ?? '–'}</td>
              <td className="py-2.5">
                {e.winner && editionStatus(e) === 'past' ? (
                  <Champion team={e.winner} game={e.game} />
                ) : (
                  <span className="text-zinc-500">–</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export async function CompetitionView({
  rawLocale,
  found,
}: {
  rawLocale: string
  found: { competition: Competition; editions: Edition[] }
}) {
  const locale = setRequestLocale(rawLocale)
  const t = getMessages()
  const { competition: c } = found
  const editions = found.editions.map((e) => ({ ...e, competition: e.competition ?? c }))
  const now = new Date()
  const live = editions
    .filter((e) => editionStatus(e, now) !== 'past')
    .sort((a, b) => (a.beginAt ?? '').localeCompare(b.beginAt ?? ''))
  const { main, qualifiers } = palmares(editions.filter((e) => editionStatus(e, now) === 'past'))
  const [pages, news] = await Promise.all([
    fetchStagePages([...new Set(live.flatMap((e) => e.stages.flatMap((s) => (s.slug ? [s.slug] : []))))]).catch(
      () => new Set<string>()
    ),
    fetchArticles({ competitionId: c.id, limit: 8 }).catch(() => null),
  ])
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <JsonLd
        data={breadcrumbList(
          [
            { name: t.categories.esport.label, path: '/esport' },
            { name: t.esport.competitionsTitle, path: '/esport/competitions' },
            { name: c.name, path: `/esport/competitions/${c.slug}` },
          ],
          locale
        )}
      />
      <header className="mb-10 flex items-start gap-4">
        <Logo src={c.logo} size={64} />
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">{c.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            <GameBadge game={c.game} />
            <TierBadge tier={c.tier} />
            {c.editions > 0 && <span>{t.esport.editions(c.editions)}</span>}
          </p>
        </div>
      </header>
      <EsportNav active="competitions" game={c.game} />

      {live.length > 0 && (
        <section aria-labelledby="c-live" className="mb-10">
          <SectionTitle id="c-live">
            {live.some((e) => editionStatus(e, now) === 'running') ? t.esport.compCurrent : t.esport.compNext}
          </SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {live.map((e) => (
              <EditionCard key={e.id} e={e} pages={pages} locale={locale} />
            ))}
          </div>
        </section>
      )}

      {main.length > 0 && (
        <section aria-labelledby="c-palmares" className="mb-10">
          <SectionTitle id="c-palmares">{t.esport.palmares}</SectionTitle>
          <PalmaresTable rows={main} locale={locale} />
        </section>
      )}
      {qualifiers.length > 0 && (
        <details className="mb-10">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-300 hover:text-white">
            {t.esport.qualifiers(qualifiers.length)}
          </summary>
          <div className="mt-3">
            <PalmaresTable rows={qualifiers} locale={locale} />
          </div>
        </details>
      )}

      <section aria-labelledby="c-news" className="mb-10">
        <SectionTitle id="c-news">{t.esport.compNews}</SectionTitle>
        {news && news.data.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {news.data.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        ) : (
          <p className="text-zinc-400">{t.esport.compNoNews}</p>
        )}
      </section>
      <p className="mt-10 text-xs text-zinc-400">{t.esport.compSource}</p>
    </div>
  )
}
