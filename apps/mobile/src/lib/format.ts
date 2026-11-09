// ─── Formatting helpers ──────────────────────────────────────────────────────
// Pure, so they're unit-tested (format.test.ts) without a device.

/** Public site, for "Read on akavish.gg" and the share sheet. */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://akavish.gg').replace(
  /\/+$/,
  '',
)

/** Web URL of an article (the web serves articles under /article/<slug>). */
export function articleUrl(slug: string): string {
  return `${SITE_URL}/article/${encodeURIComponent(slug)}`
}

/**
 * "Nov 9, 2026", in UTC so a late-evening article doesn't show the next day's
 * date depending on the phone's time zone. Empty string for a missing or
 * invalid date rather than "Invalid Date".
 */
export function formatDate(iso: string | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "Nov 9, 2026 · 4 min read", skipping whichever part is empty. */
export function byline(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(' · ')
}
