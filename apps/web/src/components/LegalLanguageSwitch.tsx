import Link from 'next/link'

/**
 * EN ⇄ FR toggle shown at the top of every legal page.
 *
 * The site itself is English-only; these pages are bilingual because Akavish is
 * published from France, and a French reader disputing something shouldn't have
 * to rely on a translation. This is deliberately *not* site-wide i18n — no
 * routing library, no locale middleware, just paired routes that link to each
 * other. See `LEGAL_PAGES` for the pairs.
 */
export const LEGAL_PAGES = {
  privacy: { en: '/privacy', fr: '/fr/confidentialite' },
  terms: { en: '/terms', fr: '/fr/conditions' },
  legal: { en: '/legal', fr: '/fr/mentions-legales' },
} as const

export type LegalPageKey = keyof typeof LEGAL_PAGES

export function LegalLanguageSwitch({
  page,
  current,
}: {
  page: LegalPageKey
  current: 'en' | 'fr'
}) {
  const other = current === 'en' ? 'fr' : 'en'
  const label = other === 'fr' ? 'Lire en français' : 'Read in English'

  return (
    <p className="text-sm">
      <Link
        href={LEGAL_PAGES[page][other]}
        hrefLang={other}
        className="text-zinc-500 hover:text-white transition-colors no-underline"
      >
        {label} →
      </Link>
    </p>
  )
}

/**
 * `alternates` for a legal page's metadata: canonical URL plus the hreflang
 * pair, so search engines serve the right language and don't read the two
 * versions as duplicate content.
 */
export function legalAlternates(page: LegalPageKey, current: 'en' | 'fr') {
  return {
    canonical: LEGAL_PAGES[page][current],
    languages: {
      en: LEGAL_PAGES[page].en,
      fr: LEGAL_PAGES[page].fr,
      // The site is English-first, so that's what an unmatched locale gets.
      'x-default': LEGAL_PAGES[page].en,
    },
  }
}
