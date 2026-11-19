// The list itself, shared by page.tsx (page 1) and page/[n]/page.tsx (page
// n). The public URL stays `?page=N`: the proxy rewrites it to /page/N, so
// the page reads a path param instead of searchParams and can be cached.
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Article } from '@akavish/types'
import { alternates } from '@/lib/i18n/metadata'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'
import { fetchTagBySlug, fetchArticles, fetchTagPages } from '@/lib/payload'
import { TAGS } from '@/lib/revalidate'
import Link from '@/components/LocaleLink'
import { breadcrumbList } from '@/lib/structured-data'
import { JsonLd } from '@/components/JsonLd'
import { ArticleCard } from '@/components/ArticleCard'
import { PAGE_SIZE, pagedTitle, pageHref, parsePage } from '@/lib/pagination'
import { Pagination } from '@/components/Pagination'


export async function listMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string; n?: string }>
}): Promise<Metadata> {
  const { slug, locale: raw } = await params
  const locale = setRequestLocale(raw)
  const t = getMessages()
  const page = parsePage((await params).n) ?? 1
  const tag = await fetchTagBySlug(slug).catch(() => null)
  if (!tag) return { title: t.tag.notFound }
  const description = t.tag.description(tag.name)
  const links = alternates(locale, pageHref(`/tag/${slug}`, page))
  return {
    title: pagedTitle(`#${tag.name}`, page),
    description,
    alternates: links,
    openGraph: { title: `#${tag.name}`, description, url: links.canonical as string },
  }
}

export async function ListPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; n?: string }>
}) {
  const { slug, locale: raw } = await params
  const locale = setRequestLocale(raw)
  const t = getMessages()
  const page = parsePage((await params).n)
  if (page === null) notFound()

  let tag
  try {
    tag = await fetchTagBySlug(slug)
  } catch {
    tag = null
  }
  if (!tag) notFound()

  let articles: Article[] = []
  let totalPages = 1
  try {
    const result = await fetchArticles({ tagId: tag.id, page, limit: PAGE_SIZE, cacheTags: [TAGS.tag(slug)] })
    articles = result.data
    totalPages = result.totalPages
  } catch {
    // Tag still renders even if the article list fails.
  }

  // Past the last page (or a later page of an empty list): no such URL.
  if (page > 1 && page > totalPages) notFound()
  // The tag of a console or a studio ("PS5"): its page has the games too.
  const entity = (await fetchTagPages().catch(() => null))?.get(slug)

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <JsonLd data={breadcrumbList([{ name: `#${tag.name}`, path: `/tag/${slug}` }], locale)} />
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tight text-white">#{tag.name}</h1>
        <p className="text-zinc-400 mt-2">{t.tag.everything(tag.name)}</p>
        {entity && (
          <p className="mt-3">
            <Link href={entity.path} className="text-emerald-400 hover:text-emerald-300 font-medium">
              {t.tag.entityPage(entity.name)}
            </Link>
          </p>
        )}
      </header>

      {articles.length === 0 ? (
        <p className="text-zinc-400">{t.tag.none}</p>
      ) : (
        <>
          {/* Cards use <h3>; this keeps the outline h1 → h2 → h3 for screen
              readers without adding a visible heading. */}
          <h2 className="sr-only">{t.tag.articles}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
          <Pagination basePath={`/tag/${slug}`} page={page} totalPages={totalPages} />
        </>
      )}
    </div>
  )
}
