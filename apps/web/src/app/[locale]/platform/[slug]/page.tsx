import { ListPage, listMetadata } from './list'

// Safety net only: the CMS pings /api/revalidate on every change (lib/revalidate.ts).
export const revalidate = 3600

// None built ahead: each page is rendered on its first visit, then cached
// (ISR) like the others. Without this export a dynamic segment is rendered on
// every request.
export function generateStaticParams() {
  return []
}

export const generateMetadata = listMetadata
export default ListPage
