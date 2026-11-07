// Pagination for the article lists (category, tag, author, game pages).

/** Articles per list page. */
export const PAGE_SIZE = 24

/**
 * The `?page=` query value as a page number. Missing → 1. Anything that isn't a
 * whole number ≥ 1 (`0`, `-2`, `abc`, `2.5`, repeated) → null, which the pages
 * turn into a 404 so junk URLs don't become duplicate content.
 */
export function parsePage(raw: string | string[] | undefined): number | null {
  if (raw === undefined) return 1
  if (Array.isArray(raw) || !/^[1-9]\d{0,5}$/.test(raw)) return null
  return Number(raw)
}

/** URL of a list page. Page 1 is the bare path, so it has a single canonical URL. */
export function pageHref(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}?page=${page}`
}

/** Page title with the page number once past the first page. */
export function pagedTitle(title: string, page: number): string {
  return page <= 1 ? title : `${title} (page ${page})`
}
