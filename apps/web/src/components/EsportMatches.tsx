'use client'

// The esport Results and Calendar lists (/esport/results, /esport/calendar):
// filters by game, level, tournament and day, kept in the URL (?game=cs2…)
// like the games library, so a view can be shared. Every match of the window
// is in the page (a few hundred small rows); filtering happens here. Days and
// times follow the reader's time zone once mounted (Paris on the server).
// lib/esport.ts has the logic. With scores hidden (anti-spoil switch,
// lib/spoilers.ts) a played match shows "Show" instead of its score and no
// winner, until revealed one by one.

import { useEffect, useMemo, useState } from 'react'
import {
  ESPORT_GAME_LABEL,
  choicesOf,
  filterRows,
  filtersToQuery,
  groupRows,
  parseFilters,
  type EsportFilters,
  type EsportRow,
  type EsportTeam,
  type Tier,
} from '@/lib/esport'
import { intlTag } from '@/lib/i18n/config'
import { formatDate } from '@/lib/i18n/dates'
import { useI18n, useRegion } from './I18nProvider'

const field =
  'h-9 rounded-md border border-zinc-800 bg-zinc-900 px-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-hidden'

const TIER_CLASS: Record<Tier, string> = {
  // Text in the theme's colours (they flip in light mode); only borders and tints are fixed.
  s: 'border-amber-500/70 bg-amber-500/15 text-white',
  a: 'border-emerald-600/60 text-emerald-400',
  b: 'border-sky-600/60 text-zinc-200',
  c: 'border-zinc-600 text-zinc-300',
  d: 'border-zinc-700 text-zinc-400',
  unranked: 'border-zinc-800 text-zinc-500',
}

/** A not-started match this far in the past is stale (PandaScore never updated it). */
const STALE_MS = 6 * 3600 * 1000
/** Matches drawn at first, then this many more per click: a light page on phones. */
const STEP = 120

function Team({ team, won, side }: { team: EsportTeam; won: boolean; side: 'left' | 'right' }) {
  return (
    <span
      className={`flex min-w-0 flex-1 items-center gap-2 ${side === 'left' ? 'justify-end text-right' : ''} ${
        won ? 'akv-won font-bold text-white' : 'text-zinc-300'
      }`}
    >
      {side === 'right' && <Logo team={team} />}
      <span className="truncate" title={team.name}>
        <span className="sm:hidden">{team.acronym ?? team.name}</span>
        <span className="hidden sm:inline">{team.name}</span>
      </span>
      {side === 'left' && <Logo team={team} />}
    </span>
  )
}

function Logo({ team }: { team: EsportTeam }) {
  if (!team.logo)
    return <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-sm bg-zinc-800" />
  // A team logo from PandaScore's CDN: small, already sized, no Next image needed.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={team.logo}
      alt=""
      width={20}
      height={20}
      loading="lazy"
      className="h-5 w-5 shrink-0 object-contain"
    />
  )
}

export function EsportMatches({
  rows,
  mode,
  now,
  basePath,
}: {
  rows: EsportRow[]
  mode: 'results' | 'calendar'
  /** The page's time, so server and browser agree on what's stale and on Today. */
  now: string
  /** `/esport/results` or `/esport/calendar`, for the URL with the filters. */
  basePath: string
}) {
  const { locale, t, href } = useI18n()
  const region = useRegion()
  const tag = intlTag(locale, region)
  const [query, setQuery] = useState('')
  const [tz, setTz] = useState('Europe/Paris')
  useEffect(() => {
    const read = () => setQuery(window.location.search)
    const zone = () => {
      try {
        setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris')
      } catch {
        // keep Paris
      }
    }
    read()
    zone()
    window.addEventListener('popstate', read)
    return () => window.removeEventListener('popstate', read)
  }, [])
  const filters = useMemo(() => parseFilters(query), [query])
  const go = (next: EsportFilters) => {
    const search = filtersToQuery(next)
    window.history.replaceState(null, '', `${href(basePath)}${search}`)
    setQuery(search)
  }
  const set = (patch: Partial<EsportFilters>) => go({ ...filters, ...patch })

  const visible = useMemo(
    () =>
      mode === 'calendar'
        ? rows.filter(
            (r) => r.status === 'running' || Date.parse(r.at) > Date.parse(now) - STALE_MS,
          )
        : rows,
    [rows, mode, now],
  )
  const shown = useMemo(() => filterRows(visible, filters, tz), [visible, filters, tz])
  // How many are drawn; back to the first batch whenever the filters change.
  const [more, setMore] = useState({ key: '', n: STEP })
  const limit = more.key === query ? more.n : STEP
  const groups = useMemo(() => {
    // The first `limit` in display order (newest or soonest first).
    const ordered = [...shown].sort(
      (a, b) => (mode === 'results' ? -1 : 1) * (Date.parse(a.at) - Date.parse(b.at)),
    )
    return groupRows(ordered.slice(0, limit), tz, mode === 'results' ? 'newest' : 'soonest')
  }, [shown, tz, mode, limit])
  // Matches revealed one by one. Whether scores are hidden is pure CSS on
  // <html data-spoilers> (globals.css): right from the first paint, no flash.
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set())
  const choices = useMemo(() => choicesOf(visible, filters, tz), [visible, filters, tz])
  const active = Boolean(filters.game || filters.tiers.length || filters.event || filters.day)

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit', timeZone: tz })
  const dayLabel = (day: string) =>
    formatDate(`${day}T12:00:00Z`, { locale, region, style: 'day', now: new Date(now) })
  const tierValue = filters.tiers.join(',')

  if (visible.length === 0) return <p className="text-zinc-400">{t.esport.empty}</p>

  return (
    <div>
      <div role="group" aria-label={t.esport.filters} className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(['', ...choices.games] as const).map((g) => (
            <button
              key={g || 'all'}
              type="button"
              aria-pressed={filters.game === g}
              onClick={() => set({ game: g, event: '' })}
              className={`h-8 rounded-full border px-3 text-sm transition-colors ${
                filters.game === g
                  ? 'border-emerald-500 bg-emerald-500/10 text-white'
                  : 'border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {g ? ESPORT_GAME_LABEL[g] : t.esport.allGames}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="esport-tier">
            {t.esport.tier}
          </label>
          <select
            id="esport-tier"
            className={field}
            value={tierValue}
            onChange={(e) =>
              set({ tiers: (e.target.value ? e.target.value.split(',') : []) as Tier[], event: '' })
            }
          >
            <option value="">{t.esport.allTiers}</option>
            <option value="s,a">{t.esport.bigTiers}</option>
            {(['s', 'a', 'b', 'c', 'd'] as const).map((x) => (
              <option key={x} value={x}>
                {t.esport.tierLabel(x)}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="esport-event">
            {t.esport.event}
          </label>
          <select
            id="esport-event"
            className={`${field} max-w-full sm:max-w-xs`}
            value={filters.event}
            onChange={(e) => set({ event: e.target.value })}
          >
            <option value="">{t.esport.allEvents}</option>
            {choices.events.map((ev) => (
              <option key={ev} value={ev}>
                {ev}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="esport-day">
            {t.esport.day}
          </label>
          <select
            id="esport-day"
            className={field}
            value={filters.day}
            onChange={(e) => set({ day: e.target.value })}
          >
            <option value="">{t.esport.allDays}</option>
            {(mode === 'results' ? [...choices.days].reverse() : choices.days).map((d) => (
              <option key={d} value={d}>
                {dayLabel(d)}
              </option>
            ))}
          </select>
          {active && (
            <button
              type="button"
              onClick={() => go({ game: '', tiers: [], event: '', day: '' })}
              className="h-9 px-3 text-sm text-emerald-400 hover:text-emerald-300"
            >
              {t.esport.reset}
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-400">
          {t.esport.count(shown.length)} · {t.esport.timeNote}
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="text-zinc-400">{t.esport.none}</p>
      ) : (
        <div className="space-y-10">
          {groups.map((day) => (
            <section key={day.day} aria-labelledby={`day-${day.day}`}>
              <h2
                id={`day-${day.day}`}
                className="mb-4 pb-2 border-b border-zinc-800 text-sm font-semibold uppercase tracking-wider text-zinc-400"
                suppressHydrationWarning
              >
                {dayLabel(day.day)}
              </h2>
              <div className="space-y-4">
                {day.events.map((ev) => (
                  <div
                    key={`${ev.game}|${ev.event}`}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/50"
                  >
                    <h3 className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-4 py-2.5 text-sm">
                      <span className="rounded-sm bg-zinc-800 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-zinc-300">
                        {ESPORT_GAME_LABEL[ev.game]}
                      </span>
                      <span className="font-semibold text-white">{ev.event}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TIER_CLASS[ev.tier]}`}
                      >
                        {t.esport.tierLabel(ev.tier)}
                      </span>
                    </h3>
                    <ul className="divide-y divide-zinc-800/70">
                      {ev.rows.map((r) => {
                        const live = r.status === 'running'
                        const played = r.status === 'finished' || live
                        const scored = played && r.s1 != null && r.s2 != null
                        return (
                          <li
                            key={r.id}
                            data-revealed={revealed.has(r.id) || undefined}
                            className="akv-match flex items-center gap-3 px-4 py-2.5 text-sm"
                          >
                            <span
                              className="w-12 shrink-0 tabular-nums text-xs text-zinc-400"
                              suppressHydrationWarning
                            >
                              {live ? (
                                <span className="font-bold uppercase text-red-400">
                                  {t.esport.live}
                                </span>
                              ) : (
                                time(r.at)
                              )}
                            </span>
                            <Team team={r.t1} won={scored && r.winner === 1} side="left" />
                            <span className="w-14 shrink-0 text-center font-bold tabular-nums text-white">
                              {scored ? (
                                <>
                                  <span className="akv-score">{`${r.s1} – ${r.s2}`}</span>
                                  <button
                                    type="button"
                                    onClick={() => setRevealed((s) => new Set(s).add(r.id))}
                                    aria-label={t.spoilers.revealLabel(r.t1.name, r.t2.name)}
                                    className="akv-mask h-7 w-full rounded-md border border-emerald-500/60 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10"
                                  >
                                    {t.spoilers.reveal}
                                  </button>
                                </>
                              ) : (
                                'vs'
                              )}
                            </span>
                            <Team team={r.t2} won={scored && r.winner === 2} side="right" />
                            <span className="hidden w-28 shrink-0 text-right text-xs text-zinc-400 md:block">
                              {[
                                r.stage,
                                r.bestOf ? t.esport.bestOf(r.bestOf) : '',
                                r.forfeit ? t.esport.forfeit : '',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                            {mode === 'calendar' && r.stream ? (
                              <a
                                href={r.stream}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                className="hidden shrink-0 text-xs font-semibold text-emerald-400 hover:text-emerald-300 sm:inline"
                              >
                                {t.esport.watch}
                              </a>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {shown.length > limit && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setMore({ key: query, n: limit + STEP })}
            className="h-9 rounded-md border border-zinc-700 px-4 text-sm text-zinc-200 hover:border-zinc-500"
          >
            {t.esport.showMore(shown.length - limit)}
          </button>
        </div>
      )}
      <p className="mt-10 text-xs text-zinc-400">{t.esport.source}</p>
    </div>
  )
}
