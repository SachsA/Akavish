// /esport/cs2, /esport/valorant…: the esport news of one game (the chips
// under the Esport tabs). Any other section or game is a 404.
import { ListPage, listMetadata } from '../list'
import { LOCALES } from '@/lib/i18n/config'
import { ESPORT_GAMES } from '@/lib/esport'

// Safety net only: the CMS pings /api/revalidate on every change (lib/revalidate.ts).
export const revalidate = 300

// Only these are pages: /news/cs2 or /esport/fifa never render.
export const dynamicParams = false
export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    ESPORT_GAMES.map((game) => ({ locale, category: 'esport', game })),
  )
}

export const generateMetadata = listMetadata
export default ListPage
