'use client'

import { SignInButton, useAuth } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { BookmarkIcon } from './BookmarkIcon'

const base =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors disabled:opacity-60'
const idle = 'border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
const on = 'border-emerald-700 text-emerald-400 hover:border-emerald-500'

/**
 * "Save" on an article page: keeps it in the reader's list on /account.
 * Signed out, it opens Clerk's sign-in instead. The page itself is cached for
 * everyone, so whether this reader already saved it is asked once loaded.
 */
export function SaveButton({ articleId }: { articleId: string }) {
  const { isLoaded, isSignedIn } = useAuth()
  const [saved, setSaved] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSignedIn) return
    let cancelled = false
    fetch(`/api/bookmarks?article=${encodeURIComponent(articleId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: { saved: boolean }) => {
        if (!cancelled) setSaved(d.saved)
      })
      .catch(() => {
        if (!cancelled) setSaved(false)
      })
    return () => {
      cancelled = true
    }
  }, [isSignedIn, articleId])

  if (!isLoaded || !isSignedIn) {
    const button = (
      <button type="button" className={`${base} ${idle}`} disabled={!isLoaded}>
        <BookmarkIcon />
        Save
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
        next ? '/api/bookmarks' : `/api/bookmarks?article=${encodeURIComponent(articleId)}`,
        next
          ? {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ articleId }),
            }
          : { method: 'DELETE' }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message ?? 'Didn’t work, try again.')
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
        className={`${base} ${saved ? on : idle}`}
      >
        <BookmarkIcon filled={saved === true} />
        {saved ? 'Saved' : 'Save'}
      </button>
      {error && (
        <span role="status" className="text-xs text-danger max-w-56">
          {error}
        </span>
      )}
    </span>
  )
}
