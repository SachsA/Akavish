'use client'

// Lights up the match a link points at (`#match-<id>`) on a tournament page,
// and brings it to the middle of the screen (the bracket also scrolls
// sideways). CSS `:target` alone isn't enough: Next's links change the URL
// with history.pushState, which neither updates `:target` nor fires
// `hashchange`, so a click from the bell or a Results row showed nothing.

import { useEffect } from 'react'

const CLASS = 'akv-hl'

function apply() {
  document.querySelectorAll(`.${CLASS}`).forEach((el) => el.classList.remove(CLASS))
  const id = decodeURIComponent(window.location.hash.slice(1))
  if (!id.startsWith('match-')) return
  const el = document.getElementById(id)
  if (!el) return
  // Restart the animation even when it's the same match again.
  void el.offsetWidth
  el.classList.add(CLASS)
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ block: 'center', inline: 'center', behavior: smooth ? 'smooth' : 'auto' })
}

export function MatchHighlighter() {
  useEffect(() => {
    // After the page's own scroll on arrival.
    const first = window.setTimeout(apply, 50)
    const later = () => window.setTimeout(apply, 0)
    window.addEventListener('hashchange', later)
    window.addEventListener('popstate', later)
    // Next's client navigation within this page: watch pushState / replaceState.
    const push = history.pushState.bind(history)
    const replace = history.replaceState.bind(history)
    history.pushState = (...args: Parameters<History['pushState']>) => {
      push(...args)
      later()
    }
    history.replaceState = (...args: Parameters<History['replaceState']>) => {
      replace(...args)
      later()
    }
    return () => {
      window.clearTimeout(first)
      window.removeEventListener('hashchange', later)
      window.removeEventListener('popstate', later)
      history.pushState = push
      history.replaceState = replace
    }
  }, [])
  return null
}
