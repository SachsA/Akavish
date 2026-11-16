'use client'

// The page's language for client components: `useI18n()` gives the locale,
// its messages, and `href()` to localise a site path. Set once by the
// [locale] layout. The English date style (🇬🇧 / 🇺🇸) is a cookie read in the
// browser (`useRegion`), so cached pages stay the same for everyone.

import { createContext, useContext, useSyncExternalStore } from 'react'
import {
  DEFAULT_LOCALE,
  DEFAULT_REGION,
  isRegion,
  localizePath,
  REGION_COOKIE,
  type Locale,
  type Region,
} from '@/lib/i18n/config'
import { messagesFor, type Messages } from '@/lib/i18n/messages'

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE)

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function useI18n(): { locale: Locale; t: Messages; href: (path: string) => string } {
  const locale = useContext(LocaleContext)
  return { locale, t: messagesFor(locale), href: (path) => localizePath(locale, path) }
}

// ─── English date style, from the cookie ─────────────────────────────────────

const listeners = new Set<() => void>()

function readRegion(): Region {
  const match = document.cookie.match(new RegExp(`(?:^|; )${REGION_COOKIE}=([^;]*)`))
  const value = match ? decodeURIComponent(match[1]) : null
  return isRegion(value) ? value : DEFAULT_REGION
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/** Tell every `useRegion()` the cookie changed (the language menu calls it). */
export function regionChanged() {
  for (const l of listeners) l()
}

/**
 * 🇬🇧 or 🇺🇸 dates. The server and the first render use US (the cached page
 * is the same for everyone); a British reader's dates switch right after.
 */
export function useRegion(): Region {
  return useSyncExternalStore(subscribe, readRegion, () => DEFAULT_REGION)
}
