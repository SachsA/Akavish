'use client'

// Follow a team, a tournament (event) or a match. Three looks: `star` (an
// icon next to a team), `bell` (an icon on a calendar match), `button`
// (the tournament page). Signed out, it opens Clerk's sign-in. The follows
// come from one shared request (lib/esport-follows-store.ts).

import { SignInButton, useAuth } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { StarIcon } from '../StarIcon'
import { useI18n } from '../I18nProvider'
import { readerMessage } from '@/lib/reader-messages'
import type { EsportFollow } from '@/lib/readers'
import { followKey, loadEsportFollows, toggleEsportFollow, useEsportFollows } from '@/lib/esport-follows-store'

export function BellIcon({ filled = false, className = 'w-4 h-4' }: { filled?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

export function EsportFollowButton({ follow, look }: { follow: EsportFollow; look: 'star' | 'bell' | 'button' }) {
  const { t, locale } = useI18n()
  const { isLoaded, isSignedIn } = useAuth()
  const follows = useEsportFollows()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isSignedIn) loadEsportFollows()
  }, [isSignedIn])

  const key = followKey(follow.kind, follow.pandaId)
  const on = !!follows?.some((f) => followKey(f.kind, f.pandaId) === key)
  const label =
    follow.kind === 'event'
      ? on
        ? t.esportFollow.eventFollowed
        : t.esportFollow.followEvent
      : follow.kind === 'match'
        ? (on ? t.esportFollow.unfollowMatch : t.esportFollow.followMatch)(follow.label)
        : (on ? t.esportFollow.unfollowTeam : t.esportFollow.followTeam)(follow.label)

  const icon =
    look === 'bell' ? (
      <BellIcon filled={on} />
    ) : (
      <StarIcon filled={on} className={look === 'button' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
    )
  const cls =
    look === 'button'
      ? `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors disabled:opacity-60 ${
          on ? 'border-emerald-700 text-emerald-400 hover:border-emerald-500' : 'border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
        }`
      : `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-60 ${
          on ? 'text-emerald-400 hover:text-emerald-300' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
        }`

  if (!isLoaded || !isSignedIn) {
    const button = (
      <button type="button" className={cls} disabled={!isLoaded} aria-label={look === 'button' ? undefined : label} title={label}>
        {icon}
        {look === 'button' && label}
      </button>
    )
    return isLoaded ? <SignInButton mode="modal">{button}</SignInButton> : button
  }

  async function toggle() {
    if (busy || follows === null) return
    setBusy(true)
    setError(null)
    const failed = await toggleEsportFollow(follow, !on)
    if (failed) setError(readerMessage(failed, locale) || t.esportFollow.failed)
    setBusy(false)
  }

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggle}
        disabled={busy || follows === null}
        aria-pressed={on}
        aria-label={look === 'button' ? undefined : label}
        title={label}
        className={cls}
      >
        {icon}
        {look === 'button' && label}
      </button>
      {error && (
        <span role="status" className="absolute top-full right-0 z-30 mt-1 w-56 rounded-md bg-zinc-900 p-2 text-xs text-danger shadow">
          {error}
        </span>
      )}
    </span>
  )
}
