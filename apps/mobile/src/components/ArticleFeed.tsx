import type { ReactElement } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { ArticleCategory } from '@akavish/api-client'
import { useArticleFeed } from '../hooks/useArticleFeed'
import { colors, spacing } from '../theme'
import { ArticleCard } from './ArticleCard'
import { Loading, StateMessage } from './StateMessage'

/**
 * A paged list of articles: pull to refresh, more on scroll, retry on error.
 * Used by every list screen (home, category tabs, section screens).
 */
export function ArticleFeed({
  category,
  header,
  leadFirst = false,
}: {
  category?: ArticleCategory
  /** Shown above the first article (e.g. a section blurb). */
  header?: ReactElement
  /** Render the first article as a large lead card (home feed). */
  leadFirst?: boolean
}) {
  const feed = useArticleFeed(category)

  if (feed.status === 'loading') return <Loading />

  if (feed.status === 'error') {
    return (
      <StateMessage
        title="Couldn't load articles"
        body="Check your connection and try again."
        actionLabel="Try again"
        onAction={feed.retry}
      />
    )
  }

  return (
    <FlatList
      data={feed.articles}
      keyExtractor={(a) => a.id}
      style={styles.screen}
      contentContainerStyle={styles.list}
      renderItem={({ item, index }) => (
        <ArticleCard article={item} lead={leadFirst && index === 0} />
      )}
      ListHeaderComponent={
        // Undefined when there's nothing to show: an empty header still takes
        // a gap above the first card.
        header || feed.error === 'refresh' ? (
          <>
            {header}
            {feed.error === 'refresh' ? (
              <Text style={styles.banner}>
                Couldn&apos;t refresh. Showing the last articles loaded.
              </Text>
            ) : null}
          </>
        ) : undefined
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No articles here yet. Check back soon.</Text>
        </View>
      }
      ListFooterComponent={
        feed.loadingMore ? (
          <ActivityIndicator color={colors.accent} style={styles.footer} />
        ) : feed.error === 'more' ? (
          <Pressable onPress={feed.loadMore} accessibilityRole="button" style={styles.footer}>
            <Text style={styles.retry}>Couldn&apos;t load more. Tap to retry.</Text>
          </Pressable>
        ) : undefined
      }
      onEndReached={feed.error === 'more' ? undefined : feed.loadMore}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={feed.refreshing}
          onRefresh={feed.refresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
          progressBackgroundColor={colors.surface}
        />
      }
    />
  )
}

const styles = StyleSheet.create({
  // The FlatList is the screen itself: without a background it falls back to
  // the light system default.
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  banner: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { color: colors.muted, textAlign: 'center' },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
  retry: { color: colors.accent, fontWeight: '600' },
})
