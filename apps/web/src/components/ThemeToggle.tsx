'use client'

import { useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'

/** The theme currently on screen: the visitor's saved choice, else the OS setting. */
function currentTheme(): Theme {
  const chosen = document.documentElement.dataset.theme
  if (chosen === 'light' || chosen === 'dark') return chosen
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/** Re-render when the OS theme changes or `data-theme` on <html> is set. */
function subscribe(onChange: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: light)')
  media.addEventListener('change', onChange)
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => {
    media.removeEventListener('change', onChange)
    observer.disconnect()
  }
}

/**
 * Light/dark switch in the header. Until the visitor clicks it the site follows
 * the OS; the choice is then kept in localStorage and restored before paint by
 * the inline script in layout.tsx (no flash of the wrong theme).
 */
export function ThemeToggle() {
  // Unknown on the server (null): an empty button of the same size until hydrated.
  const theme = useSyncExternalStore<Theme | null>(subscribe, currentTheme, () => null)

  const next: Theme = theme === 'light' ? 'dark' : 'light'

  function toggle() {
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('theme', next)
    } catch {
      // Private mode or storage blocked: the choice lasts for this page only.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={theme === null}
      aria-label={theme === null ? 'Theme' : `Switch to ${next} theme`}
      title={theme === null ? undefined : `Switch to ${next} theme`}
      className="inline-flex items-center justify-center w-8 h-8 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
    >
      {theme === 'light' && <MoonIcon />}
      {theme === 'dark' && <SunIcon />}
    </button>
  )
}

function SunIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
