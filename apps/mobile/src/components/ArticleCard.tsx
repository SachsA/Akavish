import { useRouter } from 'expo-router'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { categoryByValue } from '@akavish/api-client/categories'
import type { Article } from '@akavish/api-client'
import { byline, formatDate } from '../lib/format'
import { colors, spacing } from '../theme'
import { Wordmark } from './Wordmark'

/**
 * One article in a list. `lead` is the large first card of the home feed
 * (the web's lead story); the rest are compact.
 */
export function ArticleCard({ article, lead = false }: { article: Article; lead?: boolean }) {
  const router = useRouter()
  const category = categoryByValue(article.category)
  // The 960px 'card' variant: lists would otherwise download the 1920px hero
  // for every row (the app has no image resizer in front of it, unlike the web).
  const cover = lead ? article.coverImage : (article.coverImageCard ?? article.coverImage)

  return (
    // A Pressable with router.push rather than <Link asChild>: Link drops the
    // Pressable's function style, so the card lost its background and border.
    <Pressable
      onPress={() => router.push({ pathname: '/article/[slug]', params: { slug: article.slug } })}
      accessibilityRole="link"
      accessibilityLabel={article.title}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {cover ? (
        <Image
          source={{ uri: cover }}
          style={styles.cover}
          accessibilityLabel={article.coverImageAlt}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.cover, styles.placeholder]}>
          <Wordmark size={lead ? 28 : 22} />
        </View>
      )}
      <View style={styles.body}>
        {category ? <Text style={styles.badge}>{category.singular.toUpperCase()}</Text> : null}
        <Text style={[styles.title, lead && styles.leadTitle]} numberOfLines={lead ? 4 : 3}>
          {article.title}
        </Text>
        {article.excerpt ? (
          <Text style={styles.excerpt} numberOfLines={lead ? 3 : 2}>
            {article.excerpt}
          </Text>
        ) : null}
        <Text style={styles.meta}>
          {byline(article.author.name, formatDate(article.publishedAt ?? article.createdAt))}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.85 },
  cover: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.border },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.lg, gap: 6 },
  badge: { fontSize: 11, fontWeight: '700', color: colors.accent, letterSpacing: 1 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, lineHeight: 22 },
  leadTitle: { fontSize: 22, lineHeight: 28 },
  excerpt: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
})
