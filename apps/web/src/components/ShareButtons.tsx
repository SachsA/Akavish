'use client'

import { useState } from 'react'

/**
 * Share row under an article. Deliberately no third-party SDKs — those are all
 * trackers. These are plain intent URLs plus a clipboard copy, so nothing loads
 * until the reader actually clicks.
 */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false)

  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  const links = [
    { label: 'X', href: `https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}` },
    // Reddit matters more than Facebook for a gaming audience.
    { label: 'Reddit', href: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}` },
    { label: 'Bluesky', href: `https://bsky.app/intent/compose?text=${encodedTitle}%20${encodedUrl}` },
  ]

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard needs a secure context and permission; if it's refused the
      // reader can still use the share links, so fail quietly.
    }
  }

  const base =
    'px-3 py-1.5 rounded-full border border-zinc-800 text-xs text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-zinc-600 mr-1">Share</span>

      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className={base}
        >
          {link.label}
        </a>
      ))}

      <button type="button" onClick={copy} className={base} aria-live="polite">
        {copied ? 'Link copied' : 'Copy link'}
      </button>
    </div>
  )
}
