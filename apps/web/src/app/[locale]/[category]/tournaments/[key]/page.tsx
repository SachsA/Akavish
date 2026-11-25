// /esport/tournaments/cs2 (the list for one game) or
// /esport/tournaments/<PandaScore slug> (one stage: its bracket). views.tsx.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LOCALES } from '@/lib/i18n/config'
import { ESPORT_GAMES, isEsportGame } from '@/lib/esport'
import { fetchEsportStage } from '@/lib/payload'
import { TournamentView, TournamentsIndex, tournamentMetadata, tournamentsIndexMetadata } from '../views'

export const revalidate = 300

// The five game lists are built ahead; a stage is rendered on its first visit, then cached.
export function generateStaticParams() {
  return LOCALES.flatMap((locale) => ESPORT_GAMES.map((key) => ({ locale, category: 'esport', key })))
}

type Params = { params: Promise<{ locale: string; category: string; key: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, category, key } = await params
  if (category !== 'esport') return {}
  return isEsportGame(key) ? tournamentsIndexMetadata(locale, key) : tournamentMetadata(locale, key)
}

export default async function Page({ params }: Params) {
  const { locale, category, key } = await params
  if (category !== 'esport') notFound()
  if (isEsportGame(key)) return <TournamentsIndex rawLocale={locale} game={key} />
  if (!/^[a-z0-9-]{1,160}$/.test(key)) notFound()
  const found = await fetchEsportStage(key).catch(() => null)
  if (!found) notFound()
  return <TournamentView rawLocale={locale} found={found} />
}
