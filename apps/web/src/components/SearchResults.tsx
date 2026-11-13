'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { SearchResponse } from '@/lib/search'
import { CATEGORIES, categoryByValue } from '@/lib/categories'
import { parseSearchQuery, searchHref, SEARCH_PAGE_SIZE } from '@/lib/search-query'
import { Highlight } from './Highlight'

// /search: results for ?q=…, narrowed with ?category= (chips with counts) and
// ?game= (set from a game suggestion or a result's game), paged with ?page=.
// Everything lives in the URL, so a filtered search can be shared or reloaded.
export function SearchResults() {
  const params = useSearchParams()
  const query = parseSearchQuery(params)
  const { q, category, game, page } = query
  const key = searchHref(query)

  const [data, setData] = useState<{ key: string; res: SearchResponse } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    if (!q) return
    let cancelled = false
    const qs = new URLSearchParams({ q, page: String(page), limit: String(SEARCH_PAGE_SIZE), facets: '1' })
    if (category) qs.set('category', category)
    if (game) qs.set('game', game)
    fetch(`/api/search?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((res: SearchResponse) => {
        if (!cancelled) setData({ key, res })
      })
      .catch(() => {
        if (!cancelled) setFailed(key)
      })
    return () => {
      cancelled = true
    }
  }, [key, q, page, category, game])

  const res = data?.key === key ? data.res : null
  const status = !q ? 'idle' : res ? 'done' : failed === key ? 'error' : 'loading'
  // Keep the last chips while the next page or filter loads, so they don't jump.
  const facets = res?.facets ?? (data?.res.query === q ? data.res.facets : undefined)
  const allCount = facets ? Object.values(facets).reduce((a, b) => a + b, 0) : undefined

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-black tracking-tight text-white mb-2">Search</h1>
      {q ? (
        <p className="text-zinc-400 mb-6">
          {res ? `${res.total} result${res.total === 1 ? '' : 's'} for ` : 'Results for '}
          <span className="text-zinc-300">“{q}”</span>
        </p>
      ) : (
        <p className="text-zinc-400 mb-8">Type a query in the search box above.</p>
      )}

      {q && (
        <nav aria-label="Filter by section" className="mb-6 flex flex-wrap items-center gap-2 text-sm">
          <Chip href={searchHref({ q, game })} active={!category} label="All" count={allCount} />
          {CATEGORIES.map((c) => {
            const count = facets?.[c.value]
            // Hide empty sections once counts are in, but never the selected one.
            if (count === 0 && category !== c.value) return null
            return (
              <Chip
                key={c.value}
                href={searchHref({ q, category: c.value, game })}
                active={category === c.value}
                label={c.label}
                count={count}
              />
            )
          })}
          {game && (
            <Link
              href={searchHref({ q, category })}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-700 text-emerald-400 hover:text-white transition-colors"
              aria-label={`Remove the game filter: ${res?.gameName ?? game}`}
            >
              Game: {res?.gameName ?? game} <span aria-hidden>×</span>
            </Link>
          )}
        </nav>
      )}

      {status === 'loading' && <p className="text-zinc-400">Searching…</p>}

      {status === 'error' && (
        <p className="text-zinc-400">Search is unavailable right now. Please try again in a moment.</p>
      )}

      {res && res.hits.length === 0 && (
        <p className="text-zinc-400">
          No results found for “{q}”
          {category || game ? (
            <>
              {' '}
              with these filters.{' '}
              <Link href={searchHref({ q })} className="underline hover:text-white">
                Search everything
              </Link>
            </>
          ) : (
            '.'
          )}
        </p>
      )}

      {res && res.hits.length > 0 && (
        <ul className="divide-y divide-zinc-800 border-y border-zinc-800">
          {res.hits.map((hit) => (
            <li key={hit.id} className="flex gap-4 py-4">
              <Link
                href={`/article/${hit.slug}`}
                tabIndex={-1}
                aria-hidden
                className="relative hidden sm:block shrink-0 w-36 aspect-video rounded-md overflow-hidden bg-zinc-800"
              >
                {hit.coverImage && (
                  <Image src={hit.coverImage} alt="" fill sizes="144px" className="object-cover" />
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 text-xs mb-1">
                  <span className="text-emerald-500 font-bold uppercase tracking-wide">
                    {categoryByValue(hit.category)?.singular ?? hit.category}
                  </span>
                  {hit.game &&
                    (hit.gameSlug && hit.gameSlug !== game ? (
                      <Link
                        href={searchHref({ q, category, game: hit.gameSlug })}
                        className="text-zinc-400 hover:text-white underline-offset-2 hover:underline"
                        title={`Only results about ${hit.game}`}
                      >
                        · {hit.game}
                      </Link>
                    ) : (
                      <span className="text-zinc-400">· {hit.game}</span>
                    ))}
                  {hit.publishedAt && (
                    <span className="text-zinc-400">· {formatDate(hit.publishedAt)}</span>
                  )}
                </div>
                <h2 className="font-bold text-white">
                  <Link href={`/article/${hit.slug}`} className="hover:text-emerald-400 transition-colors">
                    <Highlight text={hit.title} query={q} />
                  </Link>
                </h2>
                <p className="text-sm text-zinc-400 line-clamp-2">
                  <Highlight text={hit.excerpt} query={q} />
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {res && res.totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-4">
          {res.page > 1 ? (
            <Link href={searchHref({ ...query, page: res.page - 1 })} rel="prev" className={pageLink}>
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <p className="text-sm text-zinc-400">
            Page {res.page} of {res.totalPages}
          </p>
          {res.page < res.totalPages ? (
            <Link href={searchHref({ ...query, page: res.page + 1 })} rel="next" className={pageLink}>
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  )
}

const pageLink =
  'inline-block px-3 py-2 rounded-md border border-zinc-800 text-sm text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors'

function Chip({
  href,
  active,
  label,
  count,
}: {
  href: string
  active: boolean
  label: string
  count?: number
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border transition-colors ${
        active
          ? 'border-emerald-700 bg-emerald-700 text-on-accent font-semibold'
          : 'border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
      }`}
    >
      {label}
      {count !== undefined && <span className={active ? '' : 'text-zinc-400'}>{count}</span>}
    </Link>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
