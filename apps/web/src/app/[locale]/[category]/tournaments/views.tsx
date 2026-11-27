// /esport/tournaments (all games, or one: /esport/tournaments/cs2) and one
// tournament stage (/esport/tournaments/<PandaScore slug>): bracket or rounds,
// standings, the event's other stages. Data: the CMS's PandaScore sync
// (esport-tournaments, `structure`), lib/esport-tournaments.ts lays it out.
import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import { EsportNav } from '@/components/EsportNav'
import { EsportGameFilter } from '@/components/EsportGameFilter'
import { JsonLd } from '@/components/JsonLd'
import { ContentUnavailable } from '@/components/StatusMessage'
import { DateRange } from '@/components/esport/DateRange'
import { SpoilerZone } from '@/components/esport/SpoilerZone'
import { EsportFollowButton } from '@/components/esport/EsportFollowButton'
import { TeamsToFollow } from '@/components/esport/TeamsToFollow'
import { MatchHighlighter } from '@/components/esport/MatchHighlighter'
import { TournamentBracket } from '@/components/esport/TournamentBracket'
import { TournamentStandings } from '@/components/esport/TournamentStandings'
import { ESPORT_GAME_BADGE, ESPORT_GAME_LABEL, type EsportGame, type Tier } from '@/lib/esport'
import { groupEvents, type EsportStage, type EventGroup } from '@/lib/esport-tournaments'
import { alternates } from '@/lib/i18n/metadata'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'
import { fetchEsportStage, fetchEsportStages } from '@/lib/payload'
import { breadcrumbList } from '@/lib/structured-data'

const TIER_CLASS: Record<Tier, string> = {
  s: 'border-amber-500/70 bg-amber-500/15 text-white',
  a: 'border-emerald-600/60 text-emerald-400',
  b: 'border-sky-600/60 text-zinc-200',
  c: 'border-zinc-600 text-zinc-300',
  d: 'border-zinc-700 text-zinc-400',
  unranked: 'border-zinc-800 text-zinc-500',
}

const BIG: Tier[] = ['s', 'a', 'b']

export function TierBadge({ tier }: { tier: Tier }) {
  const t = getMessages()
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TIER_CLASS[tier]}`}>
      {t.esport.tierLabel(tier)}
    </span>
  )
}

export function GameBadge({ game }: { game: EsportGame }) {
  return (
    <span className={`rounded-sm px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${ESPORT_GAME_BADGE[game]}`}>
      {ESPORT_GAME_LABEL[game]}
    </span>
  )
}

export function Logo({ src, size }: { src: string | null; size: number }) {
  if (!src) return <span aria-hidden="true" style={{ width: size, height: size }} className="shrink-0 rounded-sm bg-zinc-800" />
  // League logos come from PandaScore's CDN, already sized.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} loading="lazy" style={{ width: size, height: size }} className="shrink-0 object-contain" />
}

/** The stage to open from an event: the latest one already started, else the first. */
function mainStage(g: EventGroup, now = new Date().toISOString()): EsportStage {
  const started = g.stages.filter((s) => s.beginAt && s.beginAt <= now)
  return started[started.length - 1] ?? g.stages[0]
}

function StageChips({ stages, active }: { stages: EsportStage[]; active?: number }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {stages.map((s) => (
        <li key={s.id}>
          <Link
            href={`/esport/tournaments/${s.slug}`}
            aria-current={s.id === active ? 'page' : undefined}
            className={`inline-flex h-7 items-center rounded-full border px-3 text-xs transition-colors ${
              s.id === active ? 'border-emerald-500 bg-emerald-500/10 text-white' : 'border-zinc-800 text-zinc-300 hover:text-white'
            }`}
          >
            {s.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function EventCard({ g }: { g: EventGroup }) {
  const main = mainStage(g)
  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-start gap-3">
        <Logo src={g.logo} size={36} />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-snug text-white">
            <Link href={`/esport/tournaments/${main.slug}`} className="hover:text-emerald-400">
              {g.event}
            </Link>
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <GameBadge game={g.game} />
            <TierBadge tier={g.tier} />
            <DateRange start={g.beginAt} end={g.endAt} />
          </p>
        </div>
      </div>
      {g.stages.length > 1 && (
        <div className="mt-3">
          <StageChips stages={g.stages} />
        </div>
      )}
    </article>
  )
}

export async function tournamentsIndexMetadata(rawLocale: string, game: EsportGame | null): Promise<Metadata> {
  const locale = setRequestLocale(rawLocale)
  const t = getMessages()
  const title = game ? t.esport.withGame(t.esport.tournamentsTitle, ESPORT_GAME_LABEL[game]) : t.esport.tournamentsTitle
  const path = game ? `/esport/tournaments/${game}` : '/esport/tournaments'
  return { title, description: t.esport.tournamentsBlurb, alternates: alternates(locale, path) }
}

export async function TournamentsIndex({ rawLocale, game }: { rawLocale: string; game: EsportGame | null }) {
  const locale = setRequestLocale(rawLocale)
  const t = getMessages()
  let stages: EsportStage[] | null = null
  try {
    stages = (await fetchEsportStages()).filter((s) => !game || s.game === game)
  } catch {
    stages = null
  }
  const groups = stages ? groupEvents(stages) : []
  const big = groups.filter((g) => BIG.includes(g.tier))
  const other = groups.filter((g) => !BIG.includes(g.tier))
  const title = game ? t.esport.withGame(t.esport.tournamentsTitle, ESPORT_GAME_LABEL[game]) : t.esport.tournamentsTitle
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <JsonLd
        data={breadcrumbList(
          [
            { name: t.categories.esport.label, path: '/esport' },
            { name: t.esport.tournamentsTitle, path: '/esport/tournaments' },
            ...(game ? [{ name: ESPORT_GAME_LABEL[game], path: `/esport/tournaments/${game}` }] : []),
          ],
          locale,
        )}
      />
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tight text-white">{title}</h1>
        <p className="text-zinc-400 mt-2">{t.esport.tournamentsBlurb}</p>
      </header>
      <EsportNav active="tournaments" game={game} />
      <EsportGameFilter base="/esport/tournaments" active={game} />
      {stages === null ? (
        <ContentUnavailable />
      ) : groups.length === 0 ? (
        <p className="text-zinc-400">{t.esport.noTournaments}</p>
      ) : (
        <>
          {big.length > 0 && (
            <section aria-labelledby="big" className="mb-10">
              <h2 id="big" className="mb-4 pb-2 border-b border-zinc-800 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                {t.esport.bigEvents}
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {big.map((g) => (
                  <EventCard key={g.key} g={g} />
                ))}
              </div>
            </section>
          )}
          {other.length > 0 && (
            <section aria-labelledby="other">
              <h2 id="other" className="mb-4 pb-2 border-b border-zinc-800 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                {t.esport.otherEvents} ({other.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {other.map((g) => (
                  <EventCard key={g.key} g={g} />
                ))}
              </div>
            </section>
          )}
          <p className="mt-10 text-xs text-zinc-400">{t.esport.source}</p>
        </>
      )}
    </div>
  )
}

const stageTitle = (s: EsportStage) => `${s.event}: ${s.name}`

export async function tournamentMetadata(rawLocale: string, slug: string): Promise<Metadata> {
  const locale = setRequestLocale(rawLocale)
  const t = getMessages()
  const found = await fetchEsportStage(slug).catch(() => null)
  if (!found) return { title: t.meta.notFound }
  return {
    title: stageTitle(found.stage),
    description: t.esport.tournamentsBlurb,
    alternates: alternates(locale, `/esport/tournaments/${slug}`),
  }
}

export async function TournamentView({
  rawLocale,
  found,
}: {
  rawLocale: string
  found: { stage: EsportStage; siblings: EsportStage[] }
}) {
  const locale = setRequestLocale(rawLocale)
  const t = getMessages()
  const { stage, siblings } = found
  const matches = stage.structure?.matches ?? []
  const standings = stage.structure?.standings ?? []
  const linked = matches.some((m) => m.prev.length > 0)
  const query = new URLSearchParams({ game: stage.game, event: stage.event }).toString()
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <JsonLd
        data={breadcrumbList(
          [
            { name: t.categories.esport.label, path: '/esport' },
            { name: t.esport.tournamentsTitle, path: '/esport/tournaments' },
            { name: stageTitle(stage), path: `/esport/tournaments/${stage.slug}` },
          ],
          locale,
        )}
      />
      <header className="mb-10 flex items-start gap-4">
        <Logo src={stage.logo} size={56} />
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">{stage.event}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            <GameBadge game={stage.game} />
            <TierBadge tier={stage.tier} />
            <span className="font-semibold text-zinc-200">{stage.name}</span>
            <DateRange start={stage.beginAt} end={stage.endAt} />
          </p>
          {stage.serieId !== null && (
            <div className="mt-4">
              <EsportFollowButton
                look="button"
                follow={{
                  kind: 'event',
                  pandaId: stage.serieId,
                  game: stage.game,
                  label: stage.event,
                  acronym: null,
                  logo: stage.logo,
                  slug: stage.slug,
                  at: stage.beginAt,
                }}
              />
            </div>
          )}
        </div>
      </header>
      <EsportNav active="tournaments" />
      {siblings.length > 1 && (
        <nav aria-label={t.esport.stages} className="mb-6">
          <StageChips stages={siblings} active={stage.id} />
        </nav>
      )}
      <p className="mb-8 flex flex-wrap gap-4 text-sm">
        <Link href={`/esport/results?${query}`} className="font-semibold text-emerald-400 hover:text-emerald-300">
          {t.esport.seeResults}
        </Link>
        <Link href={`/esport/calendar?${query}`} className="font-semibold text-emerald-400 hover:text-emerald-300">
          {t.esport.seeCalendar}
        </Link>
      </p>
      <MatchHighlighter />
      <TeamsToFollow stage={stage} />
      {matches.length === 0 && standings.length === 0 ? (
        <p className="text-zinc-400">{t.esport.noStructure}</p>
      ) : (
        <SpoilerZone
          game={stage.game}
          teams={[...matches.flatMap((m) => [m.t1?.id, m.t2?.id]), ...standings.map((r) => r.team.id)]}
        >
          {standings.length > 0 && (
            <section aria-labelledby="standings" className="mb-10 max-w-xl">
              <h2 id="standings" className="mb-4 text-xl font-bold text-white">
                {t.esport.standings}
              </h2>
              <TournamentStandings stage={stage} rows={standings} />
            </section>
          )}
          {matches.length > 0 && (
            <section aria-labelledby="bracket">
              <h2 id="bracket" className="mb-4 text-xl font-bold text-white">
                {linked ? t.esport.bracket : t.esport.rounds}
              </h2>
              <TournamentBracket matches={matches} game={stage.game} />
            </section>
          )}
        </SpoilerZone>
      )}
      <p className="mt-10 text-xs text-zinc-400">{t.esport.source}</p>
    </div>
  )
}
