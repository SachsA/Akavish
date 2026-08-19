'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

// Catches errors in the root layout itself. Must render its own <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Errors this high up escape React's normal boundaries, so nothing else
  // reports them — without this they'd be invisible in Sentry.
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          background: '#09090b',
          color: '#fafafa',
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '1rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ color: '#a1a1aa', marginTop: '0.5rem' }}>
            A critical error occurred.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              background: '#059669',
              color: '#fff',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
