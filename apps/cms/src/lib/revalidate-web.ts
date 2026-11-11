// ─── Tell the website something changed ──────────────────────────────────────
// The site caches its CMS reads (ISR, 30 s) and serves the stale copy while it
// refreshes in the background, so a new article could take a few reloads to
// show on a category page. After a change that the public can see, the CMS
// pings the site's /api/revalidate, which drops its cache at once.
//
// Off unless REVALIDATE_SECRET is set (same value on the CMS and the site).
// Fire-and-forget: a failure is logged and the 30 s cache still catches up.

import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload } from 'payload'

const webUrl = () => (process.env.WEB_URL || 'http://localhost:3000').replace(/\/+$/, '')

/** Whether a saved document changes what the public sees (drafts don't). */
export function isPublicChange(
  doc: { _status?: string | null; status?: string | null } | null | undefined,
  previousDoc?: { _status?: string | null; status?: string | null } | null,
): boolean {
  const live = (d?: typeof doc) =>
    !!d && (d._status === undefined ? true : d._status === 'published') && d.status !== 'draft'
  return live(doc) || live(previousDoc)
}

export function revalidateWeb(payload: Payload, reason: string): void {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret) return
  void fetch(`${webUrl()}/api/revalidate`, {
    method: 'POST',
    headers: { 'x-revalidate-secret': secret, 'content-type': 'application/json' },
    body: JSON.stringify({ reason }),
    signal: AbortSignal.timeout(8_000),
  })
    .then((res) => {
      if (!res.ok) payload.logger.warn({ msg: '[revalidate] web refused', status: res.status })
    })
    .catch((err) =>
      payload.logger.warn({
        msg: '[revalidate] web unreachable',
        error: err instanceof Error ? err.message : String(err),
      }),
    )
}

/** afterChange: refresh the site when a public document changes. */
export const revalidateAfterChange: CollectionAfterChangeHook = ({
  doc,
  previousDoc,
  req,
  collection,
}) => {
  if (isPublicChange(doc, previousDoc)) revalidateWeb(req.payload, `${collection.slug} ${doc.id}`)
  return doc
}

/** afterDelete: refresh the site when a public document goes away. */
export const revalidateAfterDelete: CollectionAfterDeleteHook = ({ doc, req, collection }) => {
  if (isPublicChange(doc)) revalidateWeb(req.payload, `${collection.slug} ${doc.id} deleted`)
  return doc
}
