// ─── On-demand revalidation ──────────────────────────────────────────────────
// Pages and CMS reads are cached for 30 s (ISR). Past that, Next serves the
// stale copy once while it refreshes in the background, so a new article could
// take a couple of reloads to show up. The CMS now pings /api/revalidate after
// every public change, which drops the cache right away. The 30 s timer stays
// as a safety net if a ping is lost.

import { timingSafeEqual } from 'node:crypto'

/** Cache tag on every CMS fetch (lib/payload.ts). */
export const CMS_TAG = 'cms'

/** Constant-time check of the shared secret. False when no secret is configured. */
export function isValidSecret(given: string | null, expected: string | undefined): boolean {
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
