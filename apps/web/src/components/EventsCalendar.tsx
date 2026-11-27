'use client'

// The events calendar's list (/conferences/calendar): on now, coming up by
// month, past events with our recap. The page sorts them (lib/events.ts); the
// browser shows each start in the reader's time zone (Paris on the server and
// until mounted) and how many days are left.

import { useEffect, useState } from 'react'
import { intlTag } from '@/lib/i18n/config'
import { daysUntil, groupByMonth, type CalendarEvent } from '@/lib/events'
import { useI18n, useRegion } from './I18nProvider'
import Link from './LocaleLink'

const PARIS = 'Europe/Paris'

export function EventsCalendar({
  live,
  upcoming,
  past,
  now,
}: {
  live: CalendarEvent[]
  upcoming: CalendarEvent[]
  past: CalendarEvent[]
  /** When the page was rendered (ms), so the server and the first paint agree. */
  now: number
}) {
  const { locale, t } = useI18n()
  const region = useRegion()
  const tag = intlTag(locale, region)
  const [tz, setTz] = useState(PARIS)
  const [clock, setClock] = useState(now)
  useEffect(() => {
    // The reader's zone and clock, once mounted (same pattern as EsportMatches).
    const mount = () => {
      try {
        setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || PARIS)
      } catch {
        // keep Paris
      }
      setClock(Date.now())
    }
    mount()
  }, [])

  const monthLabel = (month: string) => {
    const s = new Date(`${month}-15T12:00:00Z`).toLocaleDateString(tag, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  }
  // A date-only event is a day, not an instant: read in UTC so nobody sees the eve.
  const day = (iso: string, timeKnown: boolean, opts: Intl.DateTimeFormatOptions) =>
    new Date(iso).toLocaleDateString(tag, { ...opts, timeZone: timeKnown ? tz : 'UTC' })
  const when = (e: CalendarEvent) => {
    const first = day(e.startAt, e.timeKnown, { weekday: 'short', day: 'numeric', month: 'short' })
    if (e.endAt && e.endAt.slice(0, 10) !== e.startAt.slice(0, 10)) {
      return `${first} – ${day(e.endAt, false, { weekday: 'short', day: 'numeric', month: 'short' })}`
    }
    return first
  }
  const time = (e: CalendarEvent) =>
    e.timeKnown
      ? `${new Date(e.startAt).toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit', timeZone: tz })} (${t.events.yourTime})`
      : e.endAt
        ? null
        : t.events.timeTba
  const countdown = (e: CalendarEvent) => {
    const n = daysUntil(e, clock, tz)
    return n === 0 ? t.events.today : n === 1 ? t.events.tomorrow : t.events.inDays(n)
  }

  const card = (e: CalendarEvent, state: 'live' | 'upcoming' | 'past') => {
    const summary = (locale === 'fr' && e.summaryFr) || e.summary
    const recapTitle = e.article ? (locale === 'fr' && e.article.titleFr) || e.article.title : null
    return (
      <li
        key={e.slug}
        id={e.slug}
        className={`rounded-lg border bg-zinc-900 p-4 sm:p-5 ${state === 'live' ? 'border-emerald-500/70' : 'border-zinc-800'}`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {state === 'live' ? (
            <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wide text-emerald-400">
              <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              {t.events.live}
            </span>
          ) : state === 'upcoming' ? (
            <span className="font-bold uppercase tracking-wide text-emerald-400" suppressHydrationWarning>
              {countdown(e)}
            </span>
          ) : null}
          <span className="font-semibold uppercase tracking-wide text-zinc-400">{t.events.kinds[e.kind]}</span>
          {e.location && <span className="text-zinc-400">{e.location}</span>}
        </div>
        <h3 className="mt-1.5 text-lg font-bold text-white">{e.name}</h3>
        <p className="mt-1 text-sm text-zinc-300" suppressHydrationWarning>
          <time dateTime={e.timeKnown ? e.startAt : e.startAt.slice(0, 10)}>{when(e)}</time>
          {state !== 'past' && time(e) && <span className="text-zinc-400"> · {time(e)}</span>}
        </p>
        {summary && state !== 'past' && <p className="mt-2 text-sm text-zinc-400">{summary}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {state !== 'past' && e.streamUrl && (
            <a
              href={e.streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-emerald-500 px-3 py-1.5 font-semibold text-[#ffffff] hover:bg-emerald-400"
            >
              {t.events.watch}
            </a>
          )}
          {e.article && (
            <Link
              href={`/article/${e.article.slug}`}
              className="rounded-md border border-emerald-700 px-3 py-1.5 font-semibold text-emerald-400 hover:border-emerald-500 hover:text-emerald-300"
              title={recapTitle ?? undefined}
            >
              {t.events.recap}
            </Link>
          )}
          {e.officialUrl && (
            <a
              href={e.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-zinc-700 px-3 py-1.5 font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white"
            >
              {t.events.site}
            </a>
          )}
        </div>
      </li>
    )
  }

  const heading = 'text-xs uppercase tracking-widest text-zinc-400 mb-4 font-bold'
  const month = 'text-sm font-bold text-white mb-3'
  return (
    <div className="space-y-12">
      {live.length > 0 && (
        <section>
          <h2 className={heading}>{t.events.live}</h2>
          <ul className="space-y-3">{live.map((e) => card(e, 'live'))}</ul>
        </section>
      )}
      <section>
        <h2 className={heading}>{t.events.upcoming}</h2>
        {upcoming.length === 0 ? (
          <p className="text-zinc-400">{t.events.none}</p>
        ) : (
          <div className="space-y-8">
            {groupByMonth(upcoming).map((g) => (
              <div key={g.month}>
                <h3 className={month}>{monthLabel(g.month)}</h3>
                <ul className="space-y-3">{g.events.map((e) => card(e, 'upcoming'))}</ul>
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className={heading}>{t.events.past}</h2>
        {past.length === 0 ? (
          <p className="text-zinc-400">{t.events.noPast}</p>
        ) : (
          <div className="space-y-8">
            {groupByMonth(past).map((g) => (
              <div key={g.month}>
                <h3 className={month}>{monthLabel(g.month)}</h3>
                <ul className="grid gap-3 sm:grid-cols-2">{g.events.map((e) => card(e, 'past'))}</ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
