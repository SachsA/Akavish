import { notFound } from 'next/navigation'
import { LOCALES } from '@/lib/i18n/config'
import { EsportSchedulePage, esportScheduleMetadata } from '../esport-schedule'
import { EventsCalendarPage, eventsCalendarMetadata } from '../events-calendar'

// /esport/calendar: pro matches on now and in the next 7 days (lib/esport.ts).
// /conferences/calendar: the events calendar (lib/events.ts).
export const revalidate = 300

// Only these two sections have one; listing them keeps the pages cached (ISR) instead of per request.
export function generateStaticParams() {
  return LOCALES.flatMap((locale) => [
    { locale, category: 'esport' },
    { locale, category: 'conferences' },
  ])
}

type Params = { params: Promise<{ locale: string; category: string }> }

export async function generateMetadata({ params }: Params) {
  const { locale, category } = await params
  if (category === 'conferences') return eventsCalendarMetadata(locale)
  return esportScheduleMetadata(params, 'calendar')
}

export default async function Page({ params }: Params) {
  const { locale, category } = await params
  if (category === 'conferences') return EventsCalendarPage(locale)
  if (category !== 'esport') notFound()
  return EsportSchedulePage(params, 'calendar')
}
