import type { Article } from '@akavish/types'

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
      <div className="aspect-video bg-zinc-800 overflow-hidden">
        {article.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.coverImage}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-700 text-2xl font-black">
            AKV
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
