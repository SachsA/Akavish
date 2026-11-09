import { categoryBySlug } from '@akavish/api-client/categories'
import { CategoryFeed } from '../../src/components/CategoryFeed'

const category = categoryBySlug('leaks')!

export default function LeaksScreen() {
  return <CategoryFeed category={category} />
}
