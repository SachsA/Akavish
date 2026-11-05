// ─── Article categories ──────────────────────────────────────────────────────
// Single source for the slug ↔ CMS value ↔ label mapping. The URL uses a plural
// slug (`/leaks`) while the CMS stores a singular value (`leak`), which is why
// this can't just be one string.
//
// Used by the category pages, the home page sections and the sitemap. Must stay
// in step with the `category` select options in apps/cms/src/collections/Articles.ts.

import type { ArticleCategory } from '@akavish/types'

export type CategoryConfig = {
  /** URL segment, e.g. `leaks` → `/leaks`. */
  slug: string
  /** Value stored on the article in the CMS. */
  value: ArticleCategory
  /** Section heading, plural: "Leaks". */
  label: string
  /** Badge on a single article, singular: "Leak". */
  singular: string
  blurb: string
}

export const CATEGORIES: CategoryConfig[] = [
  { slug: 'news', value: 'news', label: 'News', singular: 'News', blurb: 'Breaking gaming news, as it drops.' },
  { slug: 'leaks', value: 'leak', label: 'Leaks', singular: 'Leak', blurb: 'Exclusive leaks and rumors from the industry.' },
  { slug: 'reviews', value: 'review', label: 'Reviews', singular: 'Review', blurb: 'In-depth, no-fluff reviews.' },
  { slug: 'previews', value: 'preview', label: 'Previews', singular: 'Preview', blurb: 'Hands-on first impressions.' },
  { slug: 'conferences', value: 'conference', label: 'Conferences', singular: 'Conference', blurb: 'Recaps from the big showcases.' },
  { slug: 'esport', value: 'esport', label: 'Esport', singular: 'Esport', blurb: 'Competitive scene coverage.' },
]

export function categoryBySlug(slug: string): CategoryConfig | undefined {
  return CATEGORIES.find((c) => c.slug === slug)
}

export function categoryByValue(value: string): CategoryConfig | undefined {
  return CATEGORIES.find((c) => c.value === value)
}
