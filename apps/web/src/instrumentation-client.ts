// Sentry — browser. Loaded by Next.js on the client (App Router).
import * as Sentry from '@sentry/nextjs'
import {
  IGNORED_ERRORS,
  SENTRY_DSN,
  SENTRY_ENVIRONMENT,
  TRACES_SAMPLE_RATE,
} from '@/lib/sentry-shared'

Sentry.init({
  dsn: SENTRY_DSN,
  environment: SENTRY_ENVIRONMENT,
  tracesSampleRate: TRACES_SAMPLE_RATE,
  ignoreErrors: IGNORED_ERRORS,

  // Session Replay is deliberately off. It records what the reader sees, which
  // is a privacy question we haven't answered in /privacy, and it's the single
  // heaviest thing the browser SDK can load on a site where speed is SEO.
})

// Instruments client-side route changes so navigations show up as traces.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
