import type { Article } from '@akavish/types'

/**
 * Split the homepage feed into the lead story and the rest.
 *
 * The lead is the editor's pick (the newest article ticked "featured" in the
 * CMS) when there is one, otherwise simply the newest article. The pick may be
 * older than everything in `latest`, so it's fetched separately; either way it
 * is removed from the rest so no article appears twice on the page.
 */
export function pickLead(
  latest: Article[],
  featured: Article | null
): { lead: Article | undefined; others: Article[] } {
  const lead = featured ?? latest[0]
  if (!lead) return { lead: undefined, others: [] }
  return { lead, others: latest.filter((a) => a.id !== lead.id) }
}

/**
 * The articles of one category section on the homepage, newest first.
 *
 * Built from every article on the page, lead and top stories included: a story
 * shown big at the top still shows in its own category below, so each section
 * is a true "latest in Esport" (editor's call, 2026-11-11). The lead may be an
 * older featured pick, hence the sort; ids are deduplicated.
 */
export function sectionArticles(
  all: Article[],
  category: string,
  limit: number
): Article[] {
  const seen = new Set<string>()
  return all
    .filter((a) => a.category === category && !seen.has(a.id) && seen.add(a.id))
    .sort((x, y) => (y.publishedAt ?? '').localeCompare(x.publishedAt ?? ''))
    .slice(0, limit)
}
