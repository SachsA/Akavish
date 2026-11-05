import Link from 'next/link'
import type { Article } from '@akavish/types'
import { fetchArticles } from '@/lib/payload'
import { CATEGORIES } from '@/lib/categories'
import { ArticleCard } from '@/components/ArticleCard'
import { ArticleListItem, FeaturedArticle } from '@/components/FeaturedArticle'
import { Wordmark } from '@/components/Wordmark'
import { ContentUnavailable, NothingYet } from '@/components/StatusMessage'

// Revalidate the home page periodically so freshly published articles appear.
export const revalidate = 30

/** How many stories sit in the column next to the lead. */
const TOP_STORIES = 3
/** How many cards each category section shows before "See all". */
const PER_SECTION = 3

/**
 * Layout, top to bottom:
 *
 *   1. Masthead — wordmark, tagline, links to every section.
 *   2. Lead story (newest article, large) + a "Top stories" column (next 3).
 *   3. One section per category, built from the remaining articles.
 *
 * Every article appears once: the category sections only use what the lead and
 * top-stories slots didn't take. Each block disappears when it has nothing to
 * show, so the page degrades cleanly from "busy" all the way down to a single
 * article — or to an empty-state message.
 *
 * Everything comes from a single CMS request, grouped in memory.
 */
export default async function HomePage() {
  let articles: Article[] = []
  let cmsError = false

  try {
    const result = await fetchArticles({ limit: 24 })
    articles = result.data
  } catch {
    cmsError = true
  }

  const [lead, ...others] = articles
  const topStories = others.slice(0, TOP_STORIES)
  const remaining = others.slice(TOP_STORIES)

  const sections = CATEGORIES.map((category) => ({
    category,
    articles: remaining.filter((a) => a.category === category.value).slice(0, PER_SECTION),
  })).filter((s) => s.articles.length > 0)

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {/* 1. Masthead */}
      <section className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-zinc-800 pb-8">
        <div className="space-y-2">
          <h1>
            <Wordmark className="text-5xl" />
          </h1>
          <p className="text-zinc-400 max-w-xl">
            Breaking gaming news, exclusive leaks, in-depth reviews. Fast. Serious. No fluff.
          </p>
        </div>
        <nav aria-label="Sections" className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/${c.slug}`}
              className="px-3 py-1 rounded-full border border-zinc-800 text-xs text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
            >
              {c.label}
            </Link>
          ))}
        </nav>
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
                  className="text-xs uppercase tracking-widest text-zinc-600 font-bold"
                >
                  Top stories
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
                  {category.label}
                </h2>
                <Link
                  href={`/${category.slug}`}
                  className="text-sm text-zinc-500 hover:text-white transition-colors"
                >
                  See all →
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
