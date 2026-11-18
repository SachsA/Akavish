'use client'

import { SignInButton, useAuth } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { StarIcon } from './StarIcon'
import { useI18n } from './I18nProvider'
import { readerMessage } from '@/lib/reader-messages'

const base =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors disabled:opacity-60'
const idle = 'border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
const on = 'border-emerald-700 text-emerald-400 hover:border-emerald-500'

/**
 * "Follow" on a game page: the game joins the reader's list on /account,
 * with its news. Signed out, it opens Clerk's sign-in instead. The page is
 * cached for everyone, so whether this reader follows it is asked once loaded.
 * Same pattern as SaveButton.
 */
export function FollowButton({ gameId }: { gameId: string }) {
  const { t, locale } = useI18n()
  const { isLoaded, isSignedIn } = useAuth()
  const [saved, setSaved] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSignedIn) return
    let cancelled = false
    fetch(`/api/follows?game=${encodeURIComponent(gameId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: { following: boolean }) => {
        if (!cancelled) setSaved(d.following)
      })
      .catch(() => {
        if (!cancelled) setSaved(false)
      })
    return () => {
      cancelled = true
    }
  }, [isSignedIn, gameId])

  if (!isLoaded || !isSignedIn) {
    const button = (
      <button type="button" className={`${base} ${idle}`} disabled={!isLoaded} title={t.follow.hint}>
        <StarIcon />
        {t.follow.follow}
      </button>
    )
    // Before Clerk has loaded the button is inert; signed out it asks to sign in.
    return isLoaded ? <SignInButton mode="modal">{button}</SignInButton> : button
  }

  async function toggle() {
    if (saved === null || busy) return
    const next = !saved
    setBusy(true)
    setError(null)
    setSaved(next) // optimistic
    try {
      const res = await fetch(
        next ? '/api/follows' : `/api/follows?game=${encodeURIComponent(gameId)}`,
        next
          ? {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ gameId }),
            }
          : { method: 'DELETE' }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.code ? readerMessage(data.code, locale) : t.follow.failed)
      }
    } catch (err) {
      setSaved(!next)
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={saved === null || busy}
        aria-pressed={saved === true}
        title={t.follow.hint}
        className={`${base} ${saved ? on : idle}`}
      >
        <StarIcon filled={saved === true} />
        {saved ? t.follow.following : t.follow.follow}
      </button>
      {error && (
        <span role="status" className="text-xs text-danger max-w-56">
          {error}
        </span>
      )}
    </span>
  )
}
