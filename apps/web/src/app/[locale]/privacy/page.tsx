import type { Metadata } from 'next'
import { alternates } from '@/lib/i18n/metadata'
import { setRequestLocale } from '@/lib/i18n/server'
import { PrivacyPage, metadata as en } from './en'
import { ConfidentialitePage, metadata as fr } from './fr'

// The legal texts are written in both languages (fr.tsx is the French
// original, en.tsx its English version), not machine-translated.

type Params = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = setRequestLocale((await params).locale)
  return { ...(locale === 'fr' ? fr : en), alternates: alternates(locale, '/privacy') }
}

export default async function Page({ params }: Params) {
  const locale = setRequestLocale((await params).locale)
  return locale === 'fr' ? <ConfidentialitePage /> : <PrivacyPage />
}
