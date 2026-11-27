'use client'

// The games and teams scope of anti-spoil (lib/spoilers.ts): marks with
// `.akv-free` the spoiler-prone elements the reader's settings leave visible
// (another game than the ones they protect, nothing they follow when only
// their teams are), on load, when the settings or the follows change, and
// for whatever the page draws later (Show more, filters). Hidden first,
// shown after: never a result flashing before it's hidden. Renders nothing.

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { loadEsportFollows, useEsportFollows } from '@/lib/esport-follows-store'
import { PREFS_EVENT, isFree, storedPrefs, type FollowedScope, type SpoilerPrefs } from '@/lib/spoilers'

const SELECTOR = '.akv-match, .akv-zone, .akv-spoiler'

function subjectOf(el: Element) {
  const d = (el as HTMLElement).dataset
  const heading = el.querySelector('h2, h3')
  return {
    game: d.eg ?? null,
    teams: (d.teams ?? '').split(' ').filter(Boolean).map(Number),
    match: d.match ? Number(d.match) : null,
    text: el.classList.contains('akv-spoiler') ? (heading ?? el).textContent ?? '' : '',
  }
}

export function SpoilerScope() {
  const { isSignedIn } = useUser()
  const [prefs, setPrefs] = useState<SpoilerPrefs | null>(null)
  useEffect(() => {
    const read = () => setPrefs(storedPrefs())
    const changed = (e: Event) => setPrefs((e as CustomEvent<SpoilerPrefs>).detail ?? storedPrefs())
    read()
    window.addEventListener(PREFS_EVENT, changed)
    window.addEventListener('storage', read)
    return () => {
      window.removeEventListener(PREFS_EVENT, changed)
      window.removeEventListener('storage', read)
    }
  }, [])

  const scoped = !!prefs && (prefs.games.length > 0 || prefs.teams === 'followed')
  const wantsFollows = !!prefs && prefs.teams === 'followed' && !!isSignedIn
  useEffect(() => {
    if (wantsFollows) loadEsportFollows()
  }, [wantsFollows])
  const follows = useEsportFollows()

  useEffect(() => {
    if (!prefs) return
    const followed: FollowedScope = {
      teams: (follows ?? [])
        .filter((f) => f.kind === 'team')
        .map((f) => ({ id: f.pandaId, label: f.label, acronym: f.acronym })),
      matches: (follows ?? []).filter((f) => f.kind === 'match').map((f) => f.pandaId),
    }
    // Only my teams: signed out, every team (follows need an account); Clerk
    // or the follows still loading, everything hidden for now.
    const effective: SpoilerPrefs = prefs.teams === 'followed' && isSignedIn === false ? { ...prefs, teams: 'all' } : prefs
    const waiting = effective.teams === 'followed' && (isSignedIn === undefined || follows === null)
    const mark = (root: ParentNode) => {
      const els = [
        ...(root instanceof Element && root.matches(SELECTOR) ? [root] : []),
        ...root.querySelectorAll(SELECTOR),
      ]
      for (const el of els) {
        const free = scoped && !waiting && isFree(subjectOf(el), effective, followed)
        el.classList.toggle('akv-free', free)
      }
    }
    mark(document)
    if (!scoped) return
    const observer = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => n instanceof Element && mark(n))
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [prefs, follows, scoped, isSignedIn])

  return null
}
