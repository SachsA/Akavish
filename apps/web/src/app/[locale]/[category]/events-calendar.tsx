// /conferences/calendar: the industry's events, on now, upcoming and past
// (CMS `events`, lib/events.ts), next to the Conferences recaps.
import type { Metadata } from 'next'
import { ConferencesNav } from '@/components/ConferencesNav'
import { EventsCalendar } from '@/components/EventsCalendar'
import { JsonLd } from '@/components/JsonLd'
import { ContentUnavailable } from '@/components/StatusMessage'
import { splitEvents, type CalendarEvent } from '@/lib/events'
import { alternates } from '@/lib/i18n/metadata'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'
import { fetchEvents } from '@/lib/payload'
import { breadcrumbList } from '@/lib/structured-data'

const SITE = 'https://akavish.gg'

export async function eventsCalendarMetadata(raw: string): Promise<Metadata> {
  const locale = setRequestLocale(raw)
  const t = getMessages()
  const path = '/conferences/calendar'
  return {
    title: t.events.title,
    description: t.events.description,
    alternates: alternates(locale, path),
    openGraph: { title: t.events.title, description: t.events.description, url: alternates(locale, path).canonical as string },
  }
}

/** schema.org Event for the ones still to come (search engines' event listings). */
function eventLd(e: CalendarEvent) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.name,
    startDate: e.timeKnown ? e.startAt : e.startAt.slice(0, 10),
    ...(e.endAt ? { endDate: e.endAt.slice(0, 10) } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode:
      e.kind === 'expo' || e.kind === 'conference'
        ? 'https://schema.org/OfflineEventAttendanceMode'
        : 'https://schema.org/MixedEventAttendanceMode',
    location: e.location
      ? { '@type': 'Place', name: e.location, address: e.location }
      : { '@type': 'VirtualLocation', url: e.streamUrl ?? e.officialUrl ?? `${SITE}/conferences/calendar` },
    ...(e.summary ? { description: e.summary } : {}),
    ...(e.officialUrl ? { url: e.officialUrl } : {}),
  }
}

export async function EventsCalendarPage(rawLocale: string) {
  const locale = setRequestLocale(rawLocale)
  const t = getMessages()
  let events: CalendarEvent[] | null = null
  try {
    events = await fetchEvents()
  } catch {
    events = null
  }
  const now = Date.now()
  const split = events ? splitEvents(events, now) : null
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <JsonLd
        data={breadcrumbList(
          [
            { name: t.categories.conference.label, path: '/conferences' },
            { name: t.events.title, path: '/conferences/calendar' },
          ],
          locale,
        )}
      />
      {split && split.upcoming.slice(0, 20).map((e) => <JsonLd key={e.slug} data={eventLd(e)} />)}
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tight text-white">{t.events.title}</h1>
        <p className="text-zinc-400 mt-2">{t.events.description}</p>
      </header>
      <ConferencesNav active="calendar" />
      {!split ? <ContentUnavailable /> : <EventsCalendar {...split} now={now} />}
    </div>
  )
}
