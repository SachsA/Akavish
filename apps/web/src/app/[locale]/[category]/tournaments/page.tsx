// /esport/tournaments: the tournaments on now, lately or this week (views.tsx).
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LOCALES } from '@/lib/i18n/config'
import { TournamentsIndex, tournamentsIndexMetadata } from './views'

// Same window as the matches; the sync's changes show within 5 minutes.
export const revalidate = 300

// Only /esport has it; listing it keeps the page cached (ISR).
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale, category: 'esport' }))
}

type Params = { params: Promise<{ locale: string; category: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, category } = await params
  if (category !== 'esport') return {}
  return tournamentsIndexMetadata(locale, null)
}

export default async function Page({ params }: Params) {
  const { locale, category } = await params
  if (category !== 'esport') notFound()
  return <TournamentsIndex rawLocale={locale} game={null} />
}
