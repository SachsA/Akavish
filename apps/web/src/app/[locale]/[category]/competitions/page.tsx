// /esport/competitions: the big competitions, on now, coming and past (views.tsx).
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LOCALES } from '@/lib/i18n/config'
import { CompetitionsIndex, competitionsIndexMetadata } from './views'

// The sync runs hourly; the list's cache is the esport lists' 5 minutes.
export const revalidate = 300

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale, category: 'esport' }))
}

type Params = { params: Promise<{ locale: string; category: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, category } = await params
  if (category !== 'esport') return {}
  return competitionsIndexMetadata(locale, null)
}

export default async function Page({ params }: Params) {
  const { locale, category } = await params
  if (category !== 'esport') notFound()
  return <CompetitionsIndex rawLocale={locale} game={null} />
}
