// Order of the sections wherever the site lists them: header, phone strip,
// footer, home page sections (Alex, 2026-11-16). The CMS order
// (lib/categories) stays as it is for everything else.

import { CATEGORIES, type CategoryConfig } from './categories'

export const NAV_SECTIONS = ['news', 'leaks', 'esport', 'reviews', 'previews', 'conferences'] as const

export const NAV_CATEGORIES: CategoryConfig[] = NAV_SECTIONS.map(
  (slug) => CATEGORIES.find((c) => c.slug === slug)!,
)
