import { ListPage, listMetadata } from './list'
import { LOCALES } from '@/lib/i18n/config'
import { CATEGORIES } from '@/lib/categories'

// Safety net only: the CMS pings /api/revalidate on every change (lib/revalidate.ts).
export const revalidate = 300

// Pre-render the known category pages at build time.
export function generateStaticParams() {
  return LOCALES.flatMap((locale) => CATEGORIES.map((c) => ({ locale, category: c.slug })))
}

export const generateMetadata = listMetadata
export default ListPage
