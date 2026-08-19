// Next.js instrumentation hook — runs once per server runtime at boot.
//
// **Server-side only, deliberately.** There's no `instrumentation-client.ts`
// here: the admin panel has exactly one user (you), Payload's admin bundle is
// already heavy, and a browser SDK would mostly report Payload's own UI bugs —
// which you'd see happen in front of you anyway. The errors worth catching in
// the CMS are server-side: database, R2 uploads, Resend, migrations.
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
