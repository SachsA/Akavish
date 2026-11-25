'use client'

// Lights up the match a link points at (`#match-<id>`) on a tournament page,
// and brings it to the middle of the screen (the bracket also scrolls
// sideways). CSS `:target` alone isn't enough: Next's links change the URL
// without a real fragment navigation, so `:target` and `hashchange` stay
// silent, and on the same page (a notification about this tournament,
// clicked here) nothing at all happens. So: on arrival, and on any click on a
// link to a match, look at the URL a moment later and light the match up.
// Twice, the second time after Next's own scroll has settled.

import { useEffect } from 'react'
import { matchOfHash } from '../../lib/esport-tournaments'

const CLASS = 'akv-hl'

function apply() {
  const id = matchOfHash(window.location.hash)
  if (id && window.location.hash !== `#${id}`) {
    const { pathname, search } = window.location
    window.history.replaceState(window.history.state, '', `${pathname}${search}#${id}`)
  }
  const el = id ? document.getElementById(id) : null
  document.querySelectorAll(`.${CLASS}`).forEach((x) => {
    if (x !== el) x.classList.remove(CLASS)
  })
  if (!el) return
  if (!el.classList.contains(CLASS)) {
    // Restart the animation for a new arrival.
    void el.offsetWidth
    el.classList.add(CLASS)
  }
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ block: 'center', inline: 'center', behavior: smooth ? 'smooth' : 'auto' })
}

export function MatchHighlighter() {
  useEffect(() => {
    const timers: number[] = []
    const soon = () => {
      timers.push(window.setTimeout(apply, 80), window.setTimeout(apply, 700))
    }
    // A fresh arrival on the page.
    soon()
    // A click on a link to a match (the bell, a Results row), even to this page.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href*="#match-"]')
      if (a) {
        document.querySelectorAll(`.${CLASS}`).forEach((x) => x.classList.remove(CLASS))
        soon()
      }
    }
    document.addEventListener('click', onClick, true)
    window.addEventListener('hashchange', soon)
    window.addEventListener('popstate', soon)
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('hashchange', soon)
      window.removeEventListener('popstate', soon)
    }
  }, [])
  return null
}
