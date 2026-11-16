import { ListPage, listMetadata } from './list'

export const revalidate = 30

// None built ahead: each page is rendered on its first visit, then cached
// (ISR) like the others. Without this export a dynamic segment is rendered on
// every request.
export function generateStaticParams() {
  return []
}

export const generateMetadata = listMetadata
export default ListPage
