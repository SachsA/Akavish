// Sentry — CMS Edge runtime. Payload runs almost everything on Node, so this is
// mostly a placeholder, but leaving it out means edge errors vanish silently.
import * as Sentry from '@sentry/nextjs'
import { SENTRY_DSN, SENTRY_ENVIRONMENT, TRACES_SAMPLE_RATE } from './lib/sentry-shared'

Sentry.init({
  dsn: SENTRY_DSN,
  environment: SENTRY_ENVIRONMENT,
  tracesSampleRate: TRACES_SAMPLE_RATE,
})
