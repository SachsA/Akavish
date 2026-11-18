import { pageHref } from '@/lib/pagination'
import { getMessages, localHref } from '@/lib/i18n/server'

/**
 * "← Newer · Page 2 of 5 · Older →" under an article list. Nothing when there's one page.
 *
 * Plain links (a full page load), not next/link: the list pages read their
 * page from the path the proxy rewrites `?page=N` to, so the client router
 * sees `/fr/news` and `/fr/news?page=2` as the same cached page and changed
 * the address without changing the list (French pages, 2026-11-18). The
 * pages are cached, so the load is quick.
 */
export function Pagination({
  basePath,
  page,
  totalPages,
}: {
  basePath: string
  page: number
  totalPages: number
}) {
  if (totalPages <= 1) return null
  const t = getMessages().pagination
  const link =
    'inline-block px-3 py-2 rounded-md border border-zinc-800 text-sm text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors'
  return (
    <nav aria-label={t.label} className="mt-10 flex items-center justify-between gap-4">
      {page > 1 ? (
        <a href={localHref(pageHref(basePath, page - 1))} rel="prev" className={link}>
          {t.newer}
        </a>
      ) : (
        <span />
      )}
      <p className="text-sm text-zinc-400">
        {t.pageOf(page, totalPages)}
      </p>
      {page < totalPages ? (
        <a href={localHref(pageHref(basePath, page + 1))} rel="next" className={link}>
          {t.older}
        </a>
      ) : (
        <span />
      )}
    </nav>
  )
}
