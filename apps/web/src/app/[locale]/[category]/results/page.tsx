import { LOCALES } from '@/lib/i18n/config'
import { EsportSchedulePage, esportScheduleMetadata } from '../esport-schedule'

// /esport/results: finished pro matches of the last 3 days (lib/esport.ts).
// The sync runs every 10 min and doesn't ping the site: 5 min timer.
export const revalidate = 300

// Only /esport has it; listing it keeps the page cached (ISR) instead of per request.
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale, category: 'esport' }))
}

type Params = { params: Promise<{ locale: string; category: string }> }

export async function generateMetadata({ params }: Params) {
  return esportScheduleMetadata(params, 'results')
}

export default async function Page({ params }: Params) {
  return EsportSchedulePage(params, 'results')
}
