// Next.js instrumentation hook — runs once per server runtime at boot.
// Loads the matching Sentry config and wires server-side error capture.
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Catches errors thrown in server components, route handlers and middleware —
// the ones that never reach the browser and so can't be caught client-side.
export const onRequestError = Sentry.captureRequestError
