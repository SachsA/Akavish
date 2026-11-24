// Shared by /esport/results and /esport/calendar (only under /esport: any
// other section answers 404). The matches come from the CMS's PandaScore
// sync; components/EsportMatches.tsx filters them in the browser.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EsportMatches } from '@/components/EsportMatches'
import { EsportNav } from '@/components/EsportNav'
import { JsonLd } from '@/components/JsonLd'
import { ContentUnavailable } from '@/components/StatusMessage'
import type { EsportRow } from '@/lib/esport'
import { alternates } from '@/lib/i18n/metadata'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'
import { fetchEsportMatches } from '@/lib/payload'
import { breadcrumbList } from '@/lib/structured-data'

type Kind = 'results' | 'calendar'

export async function esportScheduleMetadata(
  params: Promise<{ locale: string; category: string }>,
  kind: Kind,
): Promise<Metadata> {
  const { locale: raw, category } = await params
  const locale = setRequestLocale(raw)
  const t = getMessages()
  if (category !== 'esport') return { title: t.meta.notFound }
  const title = kind === 'results' ? t.esport.resultsTitle : t.esport.calendarTitle
  const description = kind === 'results' ? t.esport.resultsBlurb : t.esport.calendarBlurb
  const path = `/esport/${kind}`
  return {
    title,
    description,
    alternates: alternates(locale, path),
    openGraph: { title, description, url: alternates(locale, path).canonical as string },
  }
}

export async function EsportSchedulePage(params: Promise<{ locale: string; category: string }>, kind: Kind) {
  const { locale: raw, category } = await params
  const locale = setRequestLocale(raw)
  if (category !== 'esport') notFound()
  const t = getMessages()
  let rows: EsportRow[] | null = null
  try {
    rows = await fetchEsportMatches(kind)
  } catch {
    rows = null
  }
  const title = kind === 'results' ? t.esport.resultsTitle : t.esport.calendarTitle
  const blurb = kind === 'results' ? t.esport.resultsBlurb : t.esport.calendarBlurb
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <JsonLd
        data={breadcrumbList(
          [
            { name: t.categories.esport.label, path: '/esport' },
            { name: title, path: `/esport/${kind}` },
          ],
          locale,
        )}
      />
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tight text-white">{title}</h1>
        <p className="text-zinc-400 mt-2">{blurb}</p>
      </header>
      <EsportNav active={kind} />
      {rows === null ? (
        <ContentUnavailable />
      ) : (
        <EsportMatches rows={rows} mode={kind} now={new Date().toISOString()} basePath={`/esport/${kind}`} />
      )}
    </div>
  )
}
