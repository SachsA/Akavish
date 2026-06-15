'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { SearchHit } from '@/lib/search'

const CATEGORY_LABELS: Record<string, string> = {
  news: 'News',
  leak: 'Leak',
  review: 'Review',
  preview: 'Preview',
  conference: 'Conference',
  esport: 'Esport',
}

export function SearchResults() {
  const params = useSearchParams()
  const q = params.get('q') ?? ''

  const [hits, setHits] = useState<SearchHit[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle')

  useEffect(() => {
    if (!q.trim()) {
      setHits([])
      setStatus('idle')
      return
    }

    let cancelled = false
    setStatus('loading')

    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => {
        if (cancelled) return
        setHits(data.hits ?? [])
        setStatus('done')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [q])

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-black tracking-tight text-white mb-2">Search</h1>
      {q ? (
        <p className="text-zinc-500 mb-8">
          Results for <span className="text-zinc-300">“{q}”</span>
        </p>
      ) : (
        <p className="text-zinc-500 mb-8">Type a query in the search box above.</p>
      )}

      {status === 'loading' && <p className="text-zinc-500">Searching…</p>}

      {status === 'error' && (
        <p className="text-zinc-500">
          Search is unavailable right now. Make sure Meilisearch is running.
        </p>
      )}

      {status === 'done' && hits.length === 0 && (
        <p className="text-zinc-500">No results found for “{q}”.</p>
      )}

      {hits.length > 0 && (
        <ul className="divide-y divide-zinc-800 border-y border-zinc-800">
          {hits.map((hit) => (
            <li key={hit.id}>
              <a
                href={`/article/${hit.slug}`}
                className="group flex gap-4 py-4 hover:bg-zinc-900/50 -mx-2 px-2 rounded transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs mb-1">
                    <span className="text-emerald-500 font-bold uppercase tracking-wide">
                      {CATEGORY_LABELS[hit.category] ?? hit.category}
                    </span>
                    {hit.game && <span className="text-zinc-600">· {hit.game}</span>}
                  </div>
                  <h2 className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                    {hit.title}
                  </h2>
                  <p className="text-sm text-zinc-400 line-clamp-2">{hit.excerpt}</p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
