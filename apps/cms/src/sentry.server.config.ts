// Sentry — CMS Node.js runtime. This is where the errors that matter live:
// Postgres failures, R2 upload errors, Resend rejections, migration problems.
import * as Sentry from '@sentry/nextjs'
import { SENTRY_DSN, SENTRY_ENVIRONMENT, TRACES_SAMPLE_RATE } from './lib/sentry-shared'

Sentry.init({
  dsn: SENTRY_DSN,
  environment: SENTRY_ENVIRONMENT,
  tracesSampleRate: TRACES_SAMPLE_RATE,
})
