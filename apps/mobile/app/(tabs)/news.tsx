import { categoryBySlug } from '@akavish/api-client/categories'
import { CategoryFeed } from '../../src/components/CategoryFeed'

const category = categoryBySlug('news')!

export default function NewsScreen() {
  return <CategoryFeed category={category} />
}
