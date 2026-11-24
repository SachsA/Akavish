// /esport/transfers: the esport articles tagged "transfers" (Mercato in
// French): signings, departures, roster moves. Only under /esport.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { Article } from '@akavish/types'
import { ArticleCard } from '@/components/ArticleCard'
import { EsportNav } from '@/components/EsportNav'
import { JsonLd } from '@/components/JsonLd'
import { ContentUnavailable } from '@/components/StatusMessage'
import { alternates } from '@/lib/i18n/metadata'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'
import { fetchArticles, fetchTagBySlug } from '@/lib/payload'
import { TAGS } from '@/lib/revalidate'
import { breadcrumbList } from '@/lib/structured-data'
import { LOCALES } from '@/lib/i18n/config'

// Safety net only: the CMS pings /api/revalidate on every change (lib/revalidate.ts).
export const revalidate = 3600

// Only /esport has it; listing it keeps the page cached (ISR) instead of per request.
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale, category: 'esport' }))
}

/** The tag the scout puts on roster news. */
export const TRANSFERS_TAG = 'transfers'

type Params = { params: Promise<{ locale: string; category: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale: raw, category } = await params
  const locale = setRequestLocale(raw)
  const t = getMessages()
  if (category !== 'esport') return { title: t.meta.notFound }
  return {
    title: t.esport.transfersTitle,
    description: t.esport.transfersBlurb,
    alternates: alternates(locale, '/esport/transfers'),
  }
}

export default async function TransfersPage({ params }: Params) {
  const { locale: raw, category } = await params
  const locale = setRequestLocale(raw)
  if (category !== 'esport') notFound()
  const t = getMessages()
  let articles: Article[] | null = []
  try {
    const tag = await fetchTagBySlug(TRANSFERS_TAG)
    if (tag) {
      articles = (await fetchArticles({ tagId: tag.id, limit: 30, cacheTags: [TAGS.tag(TRANSFERS_TAG)] })).data
    }
  } catch {
    articles = null
  }
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <JsonLd
        data={breadcrumbList(
          [
            { name: t.categories.esport.label, path: '/esport' },
            { name: t.esport.transfersTitle, path: '/esport/transfers' },
          ],
          locale,
        )}
      />
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tight text-white">{t.esport.transfersTitle}</h1>
        <p className="text-zinc-400 mt-2">{t.esport.transfersBlurb}</p>
      </header>
      <EsportNav active="transfers" />
      {articles === null ? (
        <ContentUnavailable />
      ) : articles.length === 0 ? (
        <p className="text-zinc-400">{t.status.nothingBody(t.esport.transfers.toLowerCase())}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </div>
  )
}
