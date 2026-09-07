// ─── Shared Sentry options ───────────────────────────────────────────────────
// Imported by the client / server / edge init files so the three can't drift.

/**
 * Sentry is **off when no DSN is set** — `Sentry.init({ dsn: undefined })` is a
 * no-op. That keeps local dev and CI builds working with no account, the same
 * way R2, Resend and Meilisearch degrade elsewhere in this repo.
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

const isDev = process.env.NODE_ENV === 'development'

/**
 * Share of requests captured as performance traces.
 *
 * Sentry's free tier allows 5 000 errors + 10 000 performance units a month,
 * and traces burn the latter fast — one page view can emit several spans. 10%
 * in production keeps the quota for errors, which are what actually matter;
 * raise it once there's a paid plan or a reason to profile.
 */
export const TRACES_SAMPLE_RATE = isDev ? 1.0 : 0.1

export const SENTRY_ENVIRONMENT =
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV

/**
 * Errors that are noise, not bugs: a reader navigating away mid-fetch, an ad
 * blocker killing a request, a browser extension throwing inside our page.
 * Left unfiltered these drown the real issues and eat the monthly quota.
 */
/**
 * Explicit opt-out of every automatic personal-data collection category.
 *
 * SDK v10's `dataCollection` defaults are permissive — `userInfo` (including
 * `ip_address`), cookies, request/response headers and bodies, and URL query
 * params are all collected unless disabled. The docs are ambiguous about what
 * applies when the option is omitted entirely (the deprecated `sendDefaultPii`
 * defaulted to `false`), and a GDPR question is not the place to rely on an
 * ambiguity.
 *
 * Setting it explicitly means `/privacy` can state exactly what leaves the site,
 * and that statement stays true if Sentry changes its defaults again. We lose
 * nothing: a stack trace and a URL path are enough to debug a public news site.
 *
 * ⚠️ Keep this in sync with the "Error monitoring" section of `/privacy` and
 * `/fr/confidentialite` — those pages promise this behaviour by name.
 */
export const NO_PII_DATA_COLLECTION = {
  userInfo: false,
  httpBodies: [],
  cookies: false,
  httpHeaders: { request: false, response: false },
  urlQueryParams: false,
  // Local variables can hold anything a reader typed. Not worth the risk.
  stackFrameVariables: false,
} as const

export const IGNORED_ERRORS = [
  'AbortError',
  'ResizeObserver loop limit exceeded',
  'ResizeObserver loop completed with undelivered notifications',
  // Chrome extensions and injected scripts
  /^chrome-extension:\/\//,
  /^moz-extension:\/\//,
  // Network blips that say nothing about our code
  'NetworkError when attempting to fetch resource',
  'Failed to fetch',
  'Load failed',
]
