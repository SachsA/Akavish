import React from 'react'
import type { Article } from '@akavish/types'
import { Badge } from './badge'

interface ArticleCardProps {
  article: Article
  onClick?: () => void
}

export function ArticleCard({ article, onClick }: ArticleCardProps) {
  return (
    <article
      onClick={onClick}
      className="group relative bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden cursor-pointer hover:border-zinc-600 transition-colors"
    >
      {article.coverImage && (
        <div className="aspect-video overflow-hidden">
          <img
            src={article.coverImage}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant={article.category} />
          {article.game && (
            <span className="text-xs text-zinc-500">{article.game.name}</span>
          )}
        </div>
        <h2 className="font-bold text-white text-sm leading-snug group-hover:text-zinc-300 transition-colors line-clamp-2">
          {article.title}
        </h2>
        <p className="text-xs text-zinc-500 line-clamp-2">{article.excerpt}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-zinc-600">{article.author.name}</span>
          {article.publishedAt && (
            <span className="text-xs text-zinc-600">
              {new Date(article.publishedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
