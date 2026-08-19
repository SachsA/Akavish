import Image from 'next/image'
import type { Article } from '@akavish/types'
import { Wordmark } from '@/components/Wordmark'

const CATEGORY_LABELS: Record<Article['category'], string> = {
  news: 'News',
  leak: 'Leak',
  review: 'Review',
  preview: 'Preview',
  conference: 'Conference',
  esport: 'Esport',
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ArticleCard({ article }: { article: Article }) {
  return (
    <a
      href={`/article/${article.slug}`}
      className="group bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition-colors"
    >
      <div className="relative aspect-video bg-zinc-800 overflow-hidden">
        {article.coverImage ? (
          <Image
            src={article.coverImage}
            alt={article.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {/* Faint watermark when an article has no cover image. Both halves
                are dimmed so it stays background, not a headline. */}
            <Wordmark className="text-2xl" primary="text-zinc-700" muted="text-zinc-800" />
          </div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-emerald-500 font-bold uppercase tracking-wide">
            {CATEGORY_LABELS[article.category] ?? article.category}
          </span>
          {article.publishedAt && (
            <span className="text-zinc-600">· {formatDate(article.publishedAt)}</span>
          )}
        </div>
        <h3 className="font-bold text-white leading-snug group-hover:text-emerald-400 transition-colors">
          {article.title}
        </h3>
        <p className="text-sm text-zinc-400 line-clamp-2">{article.excerpt}</p>
        <p className="text-xs text-zinc-600">By {article.author.name}</p>
      </div>
    </a>
  )
}
