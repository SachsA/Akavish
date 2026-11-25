// Page n of one game's esport news (`/esport/cs2?page=n`, rewritten here by the proxy).
import { ListPage, listMetadata } from '../../../list'

// Safety net only: the CMS pings /api/revalidate on every change (lib/revalidate.ts).
export const revalidate = 300

// None built ahead: rendered on the first visit, then cached (ISR).
export function generateStaticParams() {
  return []
}

export const generateMetadata = listMetadata
export default ListPage
