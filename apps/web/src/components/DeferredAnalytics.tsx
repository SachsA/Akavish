'use client'

import { Analytics } from '@vercel/analytics/next'
import { useEffect, useState } from 'react'

/**
 * Vercel Web Analytics, mounted once the page has finished loading.
 *
 * Rendered directly in the layout, `<Analytics />` appends its script to
 * <head> as soon as it mounts, which can be while React is still hydrating the
 * page. About 1 load in 50 then failed hydration (React error #418): React
 * threw the server HTML away and re-rendered the whole document on the client,
 * which also wiped `data-theme` from <html>, so a reader's light theme
 * flipped back to the OS theme. Found through the flaky theme e2e test
 * (Nov 2026). Waiting for `load` costs nothing: the page view is still
 * counted, a moment later.
 */
export function DeferredAnalytics() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const start = () => setReady(true)
    if (document.readyState === 'complete') {
      const id = window.setTimeout(start, 0)
      return () => window.clearTimeout(id)
    }
    window.addEventListener('load', start, { once: true })
    return () => window.removeEventListener('load', start)
  }, [])

  return ready ? <Analytics /> : null
}
