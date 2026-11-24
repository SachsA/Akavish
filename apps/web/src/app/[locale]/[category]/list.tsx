// The list itself, shared by page.tsx (page 1) and page/[n]/page.tsx (page
// n). The public URL stays `?page=N`: the proxy rewrites it to /page/N, so
// the page reads a path param instead of searchParams and can be cached.
import { notFound } from 'next/navigation'
import { alternates } from '@/lib/i18n/metadata'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'
import type { Metadata } from 'next'
import type { Article } from '@akavish/types'
import { fetchArticles } from '@/lib/payload'
import { categoryBySlug } from '@/lib/categories'
import { breadcrumbList } from '@/lib/structured-data'
import { JsonLd } from '@/components/JsonLd'
import { PAGE_SIZE, pagedTitle, pageHref, parsePage } from '@/lib/pagination'
import { Pagination } from '@/components/Pagination'
import { ContentUnavailable, NothingYet } from '@/components/StatusMessage'
import { autoUnit } from '@/lib/date-groups'
import { ArticlesByDate } from '@/components/ArticlesByDate'
import { EsportNav } from '@/components/EsportNav'

/**
 * Conferences by year; esport always by day (match days, Alex 2026-11-17);
 * the other sections by day while busy, else by month (autoUnit).
 */
function dateUnit(category: string, articles: Article[]): 'day' | 'month' | 'year' {
  if (category === 'conference') return 'year'
  if (category === 'esport') return 'day'
  return autoUnit(articles)
}

export async function listMetadata({
  params,
}: {
  params: Promise<{ locale: string; category: string; n?: string }>
}): Promise<Metadata> {
  const { category, locale: raw } = await params
  const locale = setRequestLocale(raw)
  const t = getMessages()
  const page = parsePage((await params).n) ?? 1
  const conf = categoryBySlug(category)
  if (!conf) return { title: t.meta.notFound }
  const { label, blurb } = t.categories[conf.value]
  const path = pageHref(`/${category}`, page)
  return {
    title: pagedTitle(label, page),
    description: blurb,
    alternates: alternates(locale, path),
    openGraph: {
      title: label,
      description: blurb,
      url: alternates(locale, path).canonical as string,
    },
  }
}

export async function ListPage({
  params,
}: {
  params: Promise<{ locale: string; category: string; n?: string }>
}) {
  const { category, locale: raw } = await params
  const locale = setRequestLocale(raw)
  const t = getMessages()
  const conf = categoryBySlug(category)
  if (!conf) notFound()
  const page = parsePage((await params).n)
  if (page === null) notFound()

  let articles: Article[] = []
  let totalPages = 1
  let cmsError = false
  try {
    const result = await fetchArticles({ category: conf.value, page, limit: PAGE_SIZE })
    articles = result.data
    totalPages = result.totalPages
  } catch {
    cmsError = true
  }

  // Past the last page (or a later page of an empty list): no such URL.
  if (page > 1 && page > totalPages) notFound()
  const { label, blurb } = t.categories[conf.value]

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <JsonLd data={breadcrumbList([{ name: label, path: `/${conf.slug}` }], locale)} />
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tight text-white">{label}</h1>
        <p className="text-zinc-400 mt-2">{blurb}</p>
      </header>
      {conf.value === 'esport' && <EsportNav active="news" />}

      {cmsError ? (
        <ContentUnavailable />
      ) : articles.length === 0 ? (
        <NothingYet what={label.toLowerCase()} />
      ) : (
        <>
          {/* Page 1 opens on the 4 newest, whatever their date, in one row,
              so a quiet section never starts on one lonely card. Under it,
              the full list by date: a heading per day while the section is
              busy, per month when it isn't (lib/date-groups.ts), always per
              day for esport, per year for conferences. */}
          <ArticlesByDate
            articles={articles}
            unit={dateUnit(conf.value, articles)}
            locale={locale}
            latest={page === 1}
          />
          <Pagination basePath={`/${conf.slug}`} page={page} totalPages={totalPages} />
        </>
      )}
    </div>
  )
}
