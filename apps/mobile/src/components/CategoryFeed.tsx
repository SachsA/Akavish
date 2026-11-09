import { StyleSheet, Text } from 'react-native'
import type { CategoryConfig } from '@akavish/api-client/categories'
import { colors, spacing } from '../theme'
import { ArticleFeed } from './ArticleFeed'

/** One section's articles, under the same blurb as its page on the web. */
export function CategoryFeed({ category }: { category: CategoryConfig }) {
  return (
    <ArticleFeed
      category={category.value}
      header={<Text style={styles.blurb}>{category.blurb}</Text>}
    />
  )
}

const styles = StyleSheet.create({
  blurb: { color: colors.muted, fontSize: 14, marginBottom: spacing.xs },
})
