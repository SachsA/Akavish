import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { categoryBySlug } from '@akavish/api-client/categories'
import { CategoryFeed } from '../../src/components/CategoryFeed'
import { StateMessage } from '../../src/components/StateMessage'

/** Any section, opened from the Sections tab (or a deep link: akavish://category/esport). */
export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const category = categoryBySlug(String(slug))

  if (!category) {
    return (
      <StateMessage
        title="Section not found"
        actionLabel="Back to home"
        onAction={() => router.replace('/')}
      />
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: category.label }} />
      <CategoryFeed category={category} />
    </>
  )
}
