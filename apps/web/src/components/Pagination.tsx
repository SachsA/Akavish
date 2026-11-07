import Link from 'next/link'
import { pageHref } from '@/lib/pagination'

/** "← Newer · Page 2 of 5 · Older →" under an article list. Nothing when there's one page. */
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
  const link =
    'inline-block px-3 py-2 rounded-md border border-zinc-800 text-sm text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors'
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={pageHref(basePath, page - 1)} rel="prev" className={link}>
          ← Newer
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-zinc-400">
        Page {page} of {totalPages}
      </p>
      {page < totalPages ? (
        <Link href={pageHref(basePath, page + 1)} rel="next" className={link}>
          Older →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}
