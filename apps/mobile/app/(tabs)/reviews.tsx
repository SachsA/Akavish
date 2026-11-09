import { categoryBySlug } from '@akavish/api-client/categories'
import { CategoryFeed } from '../../src/components/CategoryFeed'

const category = categoryBySlug('reviews')!

export default function ReviewsScreen() {
  return <CategoryFeed category={category} />
}
