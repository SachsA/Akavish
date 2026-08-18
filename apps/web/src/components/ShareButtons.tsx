'use client'

import { useState, useSyncExternalStore } from 'react'

// Feature-detection for the Web Share API, read through useSyncExternalStore.
//
// The value legitimately differs between server (unknown → false) and client,
// which is exactly what this hook exists for: it renders the server snapshot
// during hydration, then swaps in the client one without a mismatch — and
// without the extra render a setState-in-effect would cost.
//
// All three callbacks live outside the component so their identity is stable
// across renders; an inline `subscribe` would make React resubscribe every time.
const subscribeToNothing = () => () => {}
const canShareOnClient = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function'
const canShareOnServer = () => false

/**
 * Share row under an article. Deliberately no third-party SDKs — those are all
 * trackers. These are plain intent URLs plus a clipboard copy, so nothing loads
 * until the reader actually clicks.
 *
 * **Why there's no Discord or Messenger button.** Discord publishes no web share
 * intent at all (the `discord://send` scheme going around is undocumented and
 * needs the desktop app installed). Messenger's Send Dialog requires a Facebook
 * App ID *and* is explicitly unsupported on mobile — i.e. broken exactly where
 * Messenger gets used. A button that silently fails is worse than no button, so
 * both are covered by the native share sheet below instead, which lists every
 * app the reader actually has.
 */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false)
  const canNativeShare = useSyncExternalStore(
    subscribeToNothing,
    canShareOnClient,
    canShareOnServer
  )

  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  const links = [
    { label: 'X', href: `https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}` },
    // Reddit matters more than Facebook for a gaming audience.
    { label: 'Reddit', href: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}` },
    { label: 'Bluesky', href: `https://bsky.app/intent/compose?text=${encodedTitle}%20${encodedUrl}` },
    // wa.me works on both web and mobile, unlike most messaging-app intents.
    { label: 'WhatsApp', href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}` },
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

  async function nativeShare() {
    try {
      await navigator.share({ title, url })
    } catch {
      // Throws on cancel too — nothing to report either way.
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

      {/* Opens the OS share sheet — Discord, Messenger, Signal, Instagram, etc.
          Hidden where the browser doesn't support it (most desktop browsers). */}
      {canNativeShare && (
        <button type="button" onClick={nativeShare} className={base}>
          More…
        </button>
      )}

      <button type="button" onClick={copy} className={base} aria-live="polite">
        {copied ? 'Link copied' : 'Copy link'}
      </button>
    </div>
  )
}
