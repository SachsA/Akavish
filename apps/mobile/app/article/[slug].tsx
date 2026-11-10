import Ionicons from '@expo/vector-icons/Ionicons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { articlesApi, type Article } from '@akavish/api-client'
import { categoryByValue } from '@akavish/api-client/categories'
import { readingTimeLabel } from '@akavish/api-client/reading-time'
import { LexicalContent } from '../../src/components/LexicalContent'
import { Loading, StateMessage } from '../../src/components/StateMessage'
import { articleUrl, byline, formatDate } from '../../src/lib/format'
import { colors, spacing } from '../../src/theme'

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ready'; article: Article }

/** One article, read natively. Deep link: akavish://article/<slug>. */
export default function ArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const [state, setState] = useState<State>({ status: 'loading' })

  // State is only set in the promise callbacks, so the mount effect below
  // doesn't set state synchronously.
  const load = useCallback(
    () =>
      articlesApi.get(String(slug)).then(
        (article) => setState(article ? { status: 'ready', article } : { status: 'not-found' }),
        () => setState({ status: 'error' }),
      ),
    [slug],
  )

  useEffect(() => {
    void load()
  }, [load])

  if (state.status === 'loading') return <Loading />

  if (state.status === 'error') {
    return (
      <StateMessage
        title="Couldn't load this article"
        body="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => {
          setState({ status: 'loading' })
          void load()
        }}
      />
    )
  }

  if (state.status === 'not-found') {
    return (
      <StateMessage
        title="Article not found"
        body="It may have been unpublished or moved."
        actionLabel="Back to home"
        onAction={() => router.replace('/')}
      />
    )
  }

  const { article } = state
  const url = articleUrl(article.slug)
  const category = categoryByValue(article.category)

  const share = () =>
    void Share.share(
      // iOS shows the link as a rich preview when passed as `url`; Android
      // only reads `message`, so the link goes in the text there.
      Platform.OS === 'ios'
        ? { message: article.title, url }
        : { message: `${article.title}\n${url}`, title: article.title },
    )

  return (
    <>
      <Stack.Screen
        options={{
          title: category?.label ?? '',
          headerRight: () => (
            <Pressable
              onPress={share}
              accessibilityRole="button"
              accessibilityLabel="Share"
              hitSlop={12}
            >
              <Ionicons name="share-outline" size={22} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {article.coverImage ? (
          <Image
            source={{ uri: article.coverImage }}
            style={styles.cover}
            accessibilityLabel={article.coverImageAlt}
            accessibilityIgnoresInvertColors
          />
        ) : null}

        <View style={styles.inner}>
          {category ? <Text style={styles.badge}>{category.singular.toUpperCase()}</Text> : null}
          <Text style={styles.title} accessibilityRole="header">
            {article.title}
          </Text>
          {article.excerpt ? <Text style={styles.excerpt}>{article.excerpt}</Text> : null}
          <Text style={styles.meta}>
            {byline(
              article.author.name,
              formatDate(article.publishedAt ?? article.createdAt),
              readingTimeLabel(article.content),
            )}
          </Text>
          {article.game?.name ? <Text style={styles.meta}>Game: {article.game.name}</Text> : null}

          <View style={styles.separator} />

          <LexicalContent content={article.content} />

          {article.aiAssisted ? (
            <Text style={styles.aiNote}>
              Drafted with the help of an AI tool from the sources cited above, then reviewed and
              approved by the Akavish editors.
            </Text>
          ) : null}

          <Pressable
            onPress={() => void Linking.openURL(url)}
            accessibilityRole="link"
            style={({ pressed }) => [styles.webLink, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.webLinkText}>Read on akavish.gg</Text>
            <Ionicons name="open-outline" size={16} color={colors.accent} />
          </Pressable>
        </View>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl * 2 },
  cover: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.surface },
  inner: { padding: spacing.lg, gap: spacing.sm },
  badge: { fontSize: 12, fontWeight: '700', color: colors.accent, letterSpacing: 1 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '900', color: colors.text },
  excerpt: { fontSize: 18, lineHeight: 26, color: colors.muted },
  meta: { fontSize: 13, color: colors.muted },
  aiNote: { marginTop: spacing.xl, fontSize: 13, fontStyle: 'italic', color: colors.muted },
  separator: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  webLink: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    minHeight: 44,
  },
  webLinkText: { color: colors.accent, fontWeight: '600', fontSize: 15 },
})
