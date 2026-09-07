// Sentry — browser. Loaded by Next.js on the client (App Router).
import * as Sentry from '@sentry/nextjs'
import {
  IGNORED_ERRORS,
  NO_PII_DATA_COLLECTION,
  SENTRY_DSN,
  SENTRY_ENVIRONMENT,
  TRACES_SAMPLE_RATE,
} from '@/lib/sentry-shared'

Sentry.init({
  dsn: SENTRY_DSN,
  environment: SENTRY_ENVIRONMENT,
  tracesSampleRate: TRACES_SAMPLE_RATE,
  ignoreErrors: IGNORED_ERRORS,
  // See the constant: opts out of IP, cookies, headers, bodies and query params.
  dataCollection: NO_PII_DATA_COLLECTION,

  // Session Replay is deliberately off, and `/privacy` now says so: it records
  // what the reader sees, which is a far bigger promise to make than "we log
  // errors", and it's the heaviest thing the browser SDK can load on a site
  // where speed is SEO. Turning it on means rewriting the privacy policy first.
})

// Instruments client-side route changes so navigations show up as traces.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
