// ─── Open Graph images ───────────────────────────────────────────────────────
// One design for every share image on the site; each route's
// `opengraph-image.tsx` only supplies the text.
//
// `next/og` renders a subset of CSS through Satori: no Tailwind, no arbitrary
// components, and every element with more than one child needs an explicit
// `display: flex`. That's why the wordmark is repeated here instead of using
// `components/Wordmark.tsx` — keep the two visually in step.
//
// Each route file still exports its own `size` / `contentType` / `runtime`
// literals: Next reads segment config statically, so they can't be imported.

import { ImageResponse } from 'next/og'
import { SITE_URL } from '@/lib/site'

export const OG_SIZE = { width: 1200, height: 630 }

const BG = '#09090b'
const WHITE = '#ffffff'
const DIM = '#71717a' // zinc-500, same as the Wordmark's "ish"
const MUTED = '#a1a1aa'
const FOOTER = '#71717a'
const ACCENT = '#10b981'

const MAX_TITLE = 90

/** Domain shown in the footer, derived from the canonical site URL. */
const DOMAIN = SITE_URL.replace(/^https?:\/\//, '')

export function renderOgImage({
  eyebrow,
  title,
  subtitle,
}: {
  /** Small accent line above the title, e.g. a category or "Author". */
  eyebrow?: string
  title: string
  subtitle?: string
}): ImageResponse {
  const clipped = title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE)}…` : title

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: BG,
          padding: '64px',
        }}
      >
        {/* Wordmark: the two halves touch — no gap, it's one word. */}
        <div style={{ display: 'flex' }}>
          <span style={{ fontSize: 40, fontWeight: 900, color: WHITE }}>Akav</span>
          <span style={{ fontSize: 40, fontWeight: 900, color: DIM }}>ish</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {eyebrow && (
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 2,
                color: ACCENT,
              }}
            >
              {eyebrow}
            </span>
          )}
          <span style={{ display: 'flex', fontSize: 64, fontWeight: 900, color: WHITE, lineHeight: 1.1 }}>
            {clipped}
          </span>
          {subtitle && (
            <span style={{ display: 'flex', fontSize: 30, color: MUTED, lineHeight: 1.3 }}>
              {subtitle}
            </span>
          )}
        </div>

        <span style={{ fontSize: 26, color: FOOTER }}>{DOMAIN}</span>
      </div>
    ),
    { ...OG_SIZE }
  )
}
