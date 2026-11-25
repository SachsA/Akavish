'use client'

// Keeps <html data-spoilers> right (lib/spoilers.ts): puts it back if a
// hydration re-render wiped it (see ThemeToggle), and copies a signed-in
// reader's default from their account (Clerk unsafeMetadata.hideScores) so it
// follows them on every device. Renders nothing.

import { useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { applySpoilers, setDefaultSpoilers } from '@/lib/spoilers'

export function SpoilerSync() {
  const { isLoaded, user } = useUser()

  useEffect(() => {
    if (!document.documentElement.dataset.spoilers) applySpoilers()
  }, [])

  const saved = user?.unsafeMetadata?.hideScores
  useEffect(() => {
    if (!isLoaded || typeof saved !== 'boolean') return
    setDefaultSpoilers(saved ? 'hide' : 'show', { endVisit: false })
  }, [isLoaded, saved])

  return null
}
