// ─── Shared Sentry options (CMS) ─────────────────────────────────────────────
// Imported by the server / edge init files so the two can't drift.

/**
 * Off when no DSN is set — `Sentry.init({ dsn: undefined })` is a no-op, so a
 * fresh clone and CI build with no Sentry account, matching how R2, Resend and
 * Meilisearch degrade elsewhere in this repo.
 *
 * Not `NEXT_PUBLIC_` on purpose: the CMS runs **server-side monitoring only**
 * (see `instrumentation.ts`), so the DSN never needs to reach a browser.
 */
export const SENTRY_DSN = process.env.SENTRY_DSN

const isDev = process.env.NODE_ENV === 'development'

/**
 * The CMS serves one editor, not the public — its request volume is a rounding
 * error next to the web app's. Sampling higher here is affordable and makes the
 * traces that do exist genuinely useful for spotting slow admin queries.
 */
export const TRACES_SAMPLE_RATE = isDev ? 1.0 : 0.5

export const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV
