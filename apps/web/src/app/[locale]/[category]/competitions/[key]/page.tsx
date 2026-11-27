// /esport/competitions/cs2 (the list for one game) or
// /esport/competitions/<slug> (one competition: cs2-pgl-major, lol-worlds). views.tsx.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LOCALES } from '@/lib/i18n/config'
import { ESPORT_GAMES, isEsportGame } from '@/lib/esport'
import { fetchEsportCompetition } from '@/lib/payload'
import { CompetitionView, CompetitionsIndex, competitionMetadata, competitionsIndexMetadata } from '../views'

export const revalidate = 300

// The five game lists are built ahead; a competition is rendered on its first visit, then cached.
export function generateStaticParams() {
  return LOCALES.flatMap((locale) => ESPORT_GAMES.map((key) => ({ locale, category: 'esport', key })))
}

type Params = { params: Promise<{ locale: string; category: string; key: string }> }

const valid = (key: string) => /^[a-z0-9-]{1,160}$/.test(key)

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, category, key } = await params
  if (category !== 'esport') return {}
  if (isEsportGame(key)) return competitionsIndexMetadata(locale, key)
  const found = valid(key) ? await fetchEsportCompetition(key).catch(() => null) : null
  return competitionMetadata(locale, found, key)
}

export default async function Page({ params }: Params) {
  const { locale, category, key } = await params
  if (category !== 'esport') notFound()
  if (isEsportGame(key)) return <CompetitionsIndex rawLocale={locale} game={key} />
  if (!valid(key)) notFound()
  const found = await fetchEsportCompetition(key).catch(() => null)
  if (!found) notFound()
  return <CompetitionView rawLocale={locale} found={found} />
}
