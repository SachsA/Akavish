import { ListPage, listMetadata } from './list'
import { LOCALES } from '@/lib/i18n/config'
import { CATEGORIES } from '@/lib/categories'

export const revalidate = 30

// Pre-render the known category pages at build time.
export function generateStaticParams() {
  return LOCALES.flatMap((locale) => CATEGORIES.map((c) => ({ locale, category: c.slug })))
}

export const generateMetadata = listMetadata
export default ListPage
