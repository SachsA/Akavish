// A section's article list: the 4 newest in one row ("Latest", page 1 only),
// then the full list by date (those 4 included), a heading per day, month or
// year. Used by the category pages and /esport/transfers. Cards use <h3>:
// h1 → h2 → h3.
import type { Article } from '@akavish/types'
import type { Locale } from '@/lib/i18n/config'
import { getMessages } from '@/lib/i18n/server'
import { groupByDate } from '@/lib/date-groups'
import { ArticleCard } from './ArticleCard'
import { DateText } from './DateText'

const heading =
  'mb-4 pb-2 border-b border-zinc-800 text-sm font-semibold uppercase tracking-wider text-zinc-400'

export function ArticlesByDate({
  articles,
  unit,
  locale,
  latest = true,
}: {
  articles: Article[]
  unit: 'day' | 'month' | 'year'
  locale: Locale
  /** Show the "Latest" row (page 1 only). */
  latest?: boolean
}) {
  const t = getMessages()
  const now = new Date()
  const top = latest ? articles.slice(0, 4) : []
  return (
    <>
      {top.length > 0 && (
        <section aria-labelledby="latest" className="mb-12">
          <h2 id="latest" className={heading}>
            {t.section.latest}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {top.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      )}
      <div className="space-y-10">
        {groupByDate(articles, unit, now, locale).map((group) => (
          <section key={group.key} aria-labelledby={`day-${group.key}`}>
            <h2 id={`day-${group.key}`} className={heading}>
              {group.date ? (
                <DateText iso={group.date} style="day" now={now.toISOString()} />
              ) : (
                group.label
              )}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.items.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}
