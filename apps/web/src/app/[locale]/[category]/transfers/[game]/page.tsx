// /esport/transfers/cs2…: the Mercato of one game (the chips under the tabs).
import { LOCALES } from '@/lib/i18n/config'
import { ESPORT_GAMES } from '@/lib/esport'
export { default, generateMetadata } from '../page'

// Safety net only: the CMS pings /api/revalidate on every change (lib/revalidate.ts).
export const revalidate = 3600

// Only /esport and the five games: anything else is a 404.
export const dynamicParams = false
export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    ESPORT_GAMES.map((game) => ({ locale, category: 'esport', game })),
  )
}
