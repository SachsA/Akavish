// ─── Feed paging ─────────────────────────────────────────────────────────────
// Pure helpers behind useArticleFeed (unit-tested in feed.test.ts).

/** Articles per page in the app's lists. */
export const FEED_PAGE_SIZE = 12

/**
 * Append a page to what's already shown, dropping duplicates. Pages can
 * overlap when an article is published while the reader scrolls: everything
 * shifts by one, and page 2 then starts with the last item of page 1. Without
 * this, the list would show it twice and React would warn about duplicate keys.
 */
export function appendPage<T extends { id: string }>(current: T[], next: T[]): T[] {
  const seen = new Set(current.map((a) => a.id))
  return [...current, ...next.filter((a) => !seen.has(a.id))]
}

/** Whether there's another page to load after `page`. */
export function hasMore(page: number, totalPages: number): boolean {
  return page < totalPages
}
