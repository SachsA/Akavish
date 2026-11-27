// /esport/tournaments/<PandaScore slug>: one stage, its bracket (views.tsx),
// linked up to its competition. The tournaments list moved into
// /esport/competitions on 2026-11-27 (/esport/tournaments and
// /esport/tournaments/<game> redirect there: next.config.ts).
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { fetchEditionOfSerie, fetchEsportStage } from '@/lib/payload'
import { TournamentView, tournamentMetadata } from '../views'

export const revalidate = 300

// None built ahead: a stage is rendered on its first visit, then cached (ISR).
export function generateStaticParams() {
  return [] as Array<{ locale: string; category: string; key: string }>
}

type Params = { params: Promise<{ locale: string; category: string; key: string }> }

const valid = (key: string) => /^[a-z0-9-]{1,160}$/.test(key)

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, category, key } = await params
  if (category !== 'esport' || !valid(key)) return {}
  return tournamentMetadata(locale, key)
}

export default async function Page({ params }: Params) {
  const { locale, category, key } = await params
  if (category !== 'esport' || !valid(key)) notFound()
  const found = await fetchEsportStage(key).catch(() => null)
  if (!found) notFound()
  const edition =
    found.stage.serieId !== null ? await fetchEditionOfSerie(found.stage.serieId).catch(() => null) : null
  return <TournamentView rawLocale={locale} found={found} edition={edition} />
}
