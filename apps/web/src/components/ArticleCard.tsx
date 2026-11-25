import Image from 'next/image'
import type { Article } from '@akavish/types'
import Link from '@/components/LocaleLink'
import { Wordmark } from '@/components/Wordmark'
import { DateText } from '@/components/DateText'
import { ScoreBadge } from '@/components/ScoreBadge'
import { getMessages } from '@/lib/i18n/server'
import { SpoilerVeil, spoilerClasses } from '@/components/SpoilerVeil'
import { EsportBadges } from '@/components/EsportBadges'

export function ArticleCard({ article }: { article: Article }) {
  const t = getMessages()
  const sp = spoilerClasses(article.spoiler)
  return (
    <Link
      href={`/article/${article.slug}`}
      className={`${sp.root} group bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition-colors`}
    >
      <div className="relative aspect-video bg-zinc-800 overflow-hidden">
        <SpoilerVeil spoiler={article.spoiler} />
        <EsportBadges article={article} />
        {article.coverImage ? (
          <Image
            // The 960 px size: the full one is for the article's top.
            src={article.coverImageCard ?? article.coverImage}
            // Decorative: the title sits right next to it inside the same
            // link, so a real alt would make screen readers read it twice.
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className={`${sp.blur} object-cover group-hover:scale-105 transition-transform duration-300`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" aria-hidden="true">
            {/* Faint watermark when an article has no cover image. Both halves
                are dimmed so it stays background, not a headline. */}
            <Wordmark className="text-2xl" primary="text-zinc-700" muted="text-zinc-800" />
          </div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-emerald-500 font-bold uppercase tracking-wide">
            {t.categories[article.category]?.singular ?? article.category}
          </span>
          {article.publishedAt && (
            <span className="text-zinc-400">
              · <DateText iso={article.publishedAt} />
            </span>
          )}
          {article.score !== undefined && (
            <span className="ml-auto">
              <ScoreBadge score={article.score} />
            </span>
          )}
        </div>
        <h3
          className={`${sp.blur} font-bold text-white leading-snug group-hover:text-emerald-400 transition-colors`}
        >
          {article.title}
        </h3>
        <p className={`${sp.blur} text-sm text-zinc-400 line-clamp-2`}>{article.excerpt}</p>
        <p className="text-xs text-zinc-400">{t.card.by(article.author.name)}</p>
      </div>
    </Link>
  )
}
