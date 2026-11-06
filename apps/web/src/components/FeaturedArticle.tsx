import Image from 'next/image'
import Link from 'next/link'
import type { Article } from '@akavish/types'
import { categoryByValue } from '@/lib/categories'
import { Wordmark } from '@/components/Wordmark'

function formatDate(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** The lead story on the home page: big image, big headline, excerpt. */
export function FeaturedArticle({ article }: { article: Article }) {
  const category = categoryByValue(article.category)

  return (
    <Link
      href={`/article/${article.slug}`}
      className="group block bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition-colors"
    >
      <div className="relative aspect-video bg-zinc-800 overflow-hidden">
        {article.coverImage ? (
          <Image
            src={article.coverImage}
            // Decorative: the title sits right next to it inside the same
            // link, so a real alt would make screen readers read it twice.
            alt=""
            fill
            // Spans two of three columns on desktop.
            sizes="(max-width: 1024px) 100vw, 66vw"
            // Above the fold on the home page — load it first.
            priority
            className="object-cover group-hover:scale-105 transition-transform duration-500"
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
            <span className="text-zinc-400">· {formatDate(article.publishedAt)}</span>
          )}
        </div>
        <h2 className="text-3xl font-black tracking-tight text-white leading-tight group-hover:text-emerald-400 transition-colors">
          {article.title}
        </h2>
        <p className="text-zinc-400 line-clamp-3">{article.excerpt}</p>
        <p className="text-sm text-zinc-400">By {article.author.name}</p>
      </div>
    </Link>
  )
}

/** A text-only entry for the "Top stories" column next to the lead story. */
export function ArticleListItem({ article }: { article: Article }) {
  const category = categoryByValue(article.category)

  return (
    <Link href={`/article/${article.slug}`} className="group block py-4">
      <span className="text-xs text-emerald-500 font-bold uppercase tracking-wide">
        {category?.singular ?? article.category}
      </span>
      <h3 className="mt-1 font-bold text-white leading-snug group-hover:text-emerald-400 transition-colors line-clamp-3">
        {article.title}
      </h3>
      {article.publishedAt && (
        <p className="mt-1 text-xs text-zinc-400">{formatDate(article.publishedAt)}</p>
      )}
    </Link>
  )
}
