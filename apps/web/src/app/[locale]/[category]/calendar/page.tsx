import { LOCALES } from '@/lib/i18n/config'
import { EsportSchedulePage, esportScheduleMetadata } from '../esport-schedule'

// /esport/calendar: pro matches on now and in the next 7 days (lib/esport.ts).
export const revalidate = 300

// Only /esport has it; listing it keeps the page cached (ISR) instead of per request.
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale, category: 'esport' }))
}

type Params = { params: Promise<{ locale: string; category: string }> }

export async function generateMetadata({ params }: Params) {
  return esportScheduleMetadata(params, 'calendar')
}

export default async function Page({ params }: Params) {
  return EsportSchedulePage(params, 'calendar')
}
