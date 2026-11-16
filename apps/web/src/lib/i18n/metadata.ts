// ─── hreflang and canonical URLs ─────────────────────────────────────────────
// Every page tells search engines about its two versions: the English one at
// the bare path (also `x-default`, for everyone else) and the French one
// under /fr. The canonical is the page's own language.

import type { Metadata } from 'next'
import { localizePath, type Locale } from './config'

export function alternates(locale: Locale, path: string): NonNullable<Metadata['alternates']> {
  return {
    canonical: localizePath(locale, path),
    languages: {
      en: localizePath('en', path),
      fr: localizePath('fr', path),
      'x-default': localizePath('en', path),
    },
  }
}
