import { CoverImage } from '@/components/CoverImage'
import type { Article } from '@akavish/types'
import Link from '@/components/LocaleLink'
import { Wordmark } from '@/components/Wordmark'
import { DateText } from '@/components/DateText'
import { ScoreBadge } from '@/components/ScoreBadge'
import { getMessages } from '@/lib/i18n/server'
import { SpoilerVeil, spoilerClasses } from '@/components/SpoilerVeil'
import { EsportBadges } from '@/components/EsportBadges'

/** The lead story on the home page: big image, big headline, excerpt. */
export function FeaturedArticle({ article }: { article: Article }) {
  const t = getMessages()
  const category = t.categories[article.category]
  const sp = spoilerClasses(article.spoiler, article.game?.slug)

  return (
    <Link
      href={`/article/${article.slug}`}
      {...sp.data}
      // The lead story stays (blurred) when result articles are hidden: the home page keeps its layout.
      className={`${sp.root} akv-keep group block bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition-colors`}
    >
      <div className="relative aspect-video bg-zinc-800 overflow-hidden">
        <SpoilerVeil spoiler={article.spoiler} />
        <EsportBadges article={article} />
        {article.coverImage ? (
          <CoverImage
            src={article.coverImage}
            // Decorative: the title sits right next to it inside the same
            // link, so a real alt would make screen readers read it twice.
            alt=""
            fit={article.coverImageFit}
            focus={article.coverImageFocus}
            // Spans two of three columns on desktop.
            sizes="(max-width: 1024px) 100vw, 66vw"
            // Above the fold on the home page — load it first.
            preload
            className={`${sp.blur} group-hover:scale-105 transition-transform duration-500`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" aria-hidden="true">
            <Wordmark className="text-5xl" primary="text-zinc-700" muted="text-zinc-800" />
          </div>
        )}
      </div>

      <div className="p-6 space-y-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-emerald-500 font-bold uppercase tracking-wide">
            {category?.singular ?? article.category}
          </span>
          {article.publishedAt && (
            <span className="text-zinc-400">
              · <DateText iso={article.publishedAt} style="long" />
            </span>
          )}
          {article.score !== undefined && (
            <span className="ml-auto">
              <ScoreBadge score={article.score} size="lg" />
            </span>
          )}
        </div>
        <h2
          className={`${sp.blur} text-3xl font-black tracking-tight text-white leading-tight group-hover:text-emerald-400 transition-colors`}
        >
          {article.title}
        </h2>
        <p className={`${sp.blur} text-zinc-400 line-clamp-3`}>{article.excerpt}</p>
        <p className="text-sm text-zinc-400">{t.card.by(article.author.name)}</p>
      </div>
    </Link>
  )
}

/** A text-only entry for the "Top stories" column next to the lead story. */
export function ArticleListItem({ article }: { article: Article }) {
  const category = getMessages().categories[article.category]
  const sp = spoilerClasses(article.spoiler, article.game?.slug)

  return (
    <Link href={`/article/${article.slug}`} {...sp.data} className={`${sp.root} group block py-4`}>
      <span className="text-xs text-emerald-500 font-bold uppercase tracking-wide">
        {category?.singular ?? article.category}
      </span>
      <h3
        className={`${sp.blur} mt-1 font-bold text-white leading-snug group-hover:text-emerald-400 transition-colors line-clamp-3`}
      >
        {article.title}
      </h3>
      {article.publishedAt && (
        <p className="mt-1 text-xs text-zinc-400">
          <DateText iso={article.publishedAt} style="long" />
        </p>
      )}
    </Link>
  )
}
