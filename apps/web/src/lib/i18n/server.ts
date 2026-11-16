// ─── The page's language, on the server ──────────────────────────────────────
// Every page and layout under app/[locale] calls `setRequestLocale(locale)`
// first thing (layouts and pages render in parallel, so both do). Server
// components below them then read it with `getLocale()` / `getMessages()`
// instead of threading a prop through every level. React's `cache()` scopes
// it to the current request.
//
// Not a cookie or a header: reading those would make every page dynamic, and
// the pages are cached (ISR, 30 s). The language is in the URL.

import { cache } from 'react'
import { DEFAULT_LOCALE, isLocale, localizePath, type Locale } from './config'
import { messagesFor, type Messages } from './messages'

const store = cache(() => ({ locale: DEFAULT_LOCALE as Locale }))

/** The `[locale]` param, validated; anything else falls back to English. */
export function setRequestLocale(value: string): Locale {
  const locale = isLocale(value) ? value : DEFAULT_LOCALE
  store().locale = locale
  return locale
}

export function getLocale(): Locale {
  return store().locale
}

export function getMessages(): Messages {
  return messagesFor(getLocale())
}

/** A site path in the page's language: `/news` → `/fr/news` on a French page. */
export function localHref(path: string): string {
  return localizePath(getLocale(), path)
}
