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
