// /esport/teams/<slug> ("cs2-vitality"): one team (views.tsx). Under /esport
// only. Rendered on its first visit, then cached; the sync runs hourly.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { fetchEsportTeam } from '@/lib/payload'
import { TeamView, teamMetadata } from './views'

export const revalidate = 300

export function generateStaticParams() {
  return [] as Array<{ locale: string; category: string; slug: string }>
}

type Params = { params: Promise<{ locale: string; category: string; slug: string }> }

const valid = (slug: string) => /^[a-z0-9-]{1,160}$/.test(slug)

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, category, slug } = await params
  if (category !== 'esport' || !valid(slug)) return {}
  return teamMetadata(locale, slug)
}

export default async function Page({ params }: Params) {
  const { locale, category, slug } = await params
  if (category !== 'esport' || !valid(slug)) notFound()
  const found = await fetchEsportTeam(slug).catch(() => null)
  if (!found) notFound()
  return <TeamView rawLocale={locale} found={found} />
}
