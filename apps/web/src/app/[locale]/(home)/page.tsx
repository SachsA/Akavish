import type { Article } from '@akavish/types'
import Link from '@/components/LocaleLink'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'
import { fetchArticles } from '@/lib/payload'
import { NAV_CATEGORIES } from '@/lib/nav'
import { pickLead, sectionArticles } from '@/lib/home'
import { ArticleCard } from '@/components/ArticleCard'
import { ArticleListItem, FeaturedArticle } from '@/components/FeaturedArticle'
import { Wordmark } from '@/components/Wordmark'
import { ContentUnavailable, NothingYet } from '@/components/StatusMessage'

// Revalidate the home page periodically so freshly published articles appear.
export const revalidate = 30

/** How many stories sit in the column next to the lead. */
const TOP_STORIES = 4
/** How many cards each category section shows before "See all", in one row. */
const PER_SECTION = 4

/**
 * Layout, top to bottom:
 *
 *   1. Masthead — wordmark and tagline (the sections are in the header).
 *   2. Lead story (the editor's "featured" pick, else the newest article) +
 *      a "Top stories" column (the next 4).
 *   3. One section per category: its 4 latest articles whatever their date
 *      (fetched per category, so a quiet one like Reviews still fills its
 *      row), the lead and top stories included (a big story at the top still
 *      shows in its own category).
 *
 * Each block disappears when it has nothing to show, so the page degrades
 * cleanly from "busy" all the way down to a single article, or to an
 * empty-state message.
 *
 * CMS requests in parallel: the latest articles, the newest featured one, and
 * the 4 latest of each category; all cached like the rest (30 s).
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale)
  const t = getMessages()
  let articles: Article[] = []
  let featured: Article | null = null
  let byCategory: Article[] = []
  let cmsError = false

  try {
    const [latest, picks, ...perCategory] = await Promise.all([
      fetchArticles({ limit: 24 }),
      // The editor's pick is a nice-to-have: if this query fails, fall back to
      // "newest is the lead" rather than an error page.
      fetchArticles({ featured: true, limit: 1 }).catch(() => null),
      // Each section's own latest; one failing only leaves that section to
      // what the main list has.
      ...NAV_CATEGORIES.map((c) => fetchArticles({ category: c.value, limit: PER_SECTION }).catch(() => null)),
    ])
    articles = latest.data
    featured = picks?.data[0] ?? null
    byCategory = perCategory.flatMap((r) => r?.data ?? [])
  } catch {
    cmsError = true
  }

  const { lead, others } = pickLead(articles, featured)
  const topStories = others.slice(0, TOP_STORIES)
  const onPage = lead ? [lead, ...others] : others

  const sections = NAV_CATEGORIES.map((category) => ({
    category,
    articles: sectionArticles([...onPage, ...byCategory], category.value, PER_SECTION),
  })).filter((s) => s.articles.length > 0)

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {/* 1. Masthead */}
      {/* No section links here any more: the header (and the strip on phones)
          already lists them all (2026-11-16). */}
      <section className="mb-10 space-y-2 border-b border-zinc-800 pb-8">
        <h1>
          <Wordmark className="text-5xl" />
        </h1>
        <p className="text-zinc-400 max-w-xl">{t.home.tagline}</p>
      </section>

      {cmsError ? (
        <ContentUnavailable />
      ) : !lead ? (
        <NothingYet />
      ) : (
        <>
          {/* 2. Lead story + top stories */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-14">
            <div className={topStories.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <FeaturedArticle article={lead} />
            </div>

            {topStories.length > 0 && (
              <aside aria-labelledby="top-stories">
                <h2
                  id="top-stories"
                  className="text-xs uppercase tracking-widest text-zinc-400 font-bold"
                >
                  {t.home.topStories}
                </h2>
                <div className="divide-y divide-zinc-800">
                  {topStories.map((a) => (
                    <ArticleListItem key={a.id} article={a} />
                  ))}
                </div>
              </aside>
            )}
          </section>

          {/* 3. Category sections */}
          {sections.map(({ category, articles: items }) => (
            <section key={category.slug} className="mb-14" aria-labelledby={`s-${category.slug}`}>
              <div className="flex items-baseline justify-between mb-5">
                <h2
                  id={`s-${category.slug}`}
                  className="text-xl font-black tracking-tight text-white"
                >
                  {t.categories[category.value].label}
                </h2>
                <Link
                  href={`/${category.slug}`}
                  className="inline-block py-1 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  {t.home.seeAll}
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {items.map((a) => (
                  <ArticleCard key={a.id} article={a} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
