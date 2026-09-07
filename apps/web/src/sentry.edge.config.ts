// Sentry — Edge runtime (middleware). Clerk's middleware runs here, so this is
// what catches auth-layer failures.
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
})
