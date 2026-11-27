'use client'

// Keeps <html data-spoilers> right (lib/spoilers.ts): puts it back if a
// hydration re-render wiped it (see ThemeToggle), and copies a signed-in
// reader's default from their account (Clerk unsafeMetadata.hideScores) so it
// follows them on every device. Renders nothing.

import { useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { applyPrefs, applySpoilers, parsePrefs, savePrefs, setDefaultSpoilers, storedPrefs } from '@/lib/spoilers'

export function SpoilerSync() {
  const { isLoaded, user } = useUser()

  useEffect(() => {
    if (!document.documentElement.dataset.spoilers) applySpoilers()
    // What to hide (data-sp-off / data-sp-hide), in case a re-render wiped it too.
    const h = document.documentElement
    if (!h.dataset.spOff && !h.dataset.spHide) applyPrefs()
  }, [])

  // The account's "what to hide", the same on every device.
  const savedPrefs = user?.unsafeMetadata?.spoilerPrefs
  useEffect(() => {
    if (!isLoaded || !savedPrefs || typeof savedPrefs !== 'object') return
    const next = parsePrefs(savedPrefs)
    if (JSON.stringify(next) !== JSON.stringify(storedPrefs())) savePrefs(next)
  }, [isLoaded, savedPrefs])

  const saved = user?.unsafeMetadata?.hideScores
  useEffect(() => {
    if (!isLoaded || typeof saved !== 'boolean') return
    setDefaultSpoilers(saved ? 'hide' : 'show', { endVisit: false })
  }, [isLoaded, saved])

  return null
}
