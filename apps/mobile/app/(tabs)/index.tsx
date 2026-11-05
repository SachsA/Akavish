import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native'
import { useEffect, useState } from 'react'
import { articlesApi } from '@akavish/api-client'
import type { Article } from '@akavish/types'

export default function HomeScreen() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    articlesApi
      .list({ limit: 20 })
      .then((res) => setArticles(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#0ea5e9" />
      </View>
    )
  }

  return (
    <FlatList
      data={articles}
      keyExtractor={(item) => item.id}
      style={styles.screen}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.empty}>No articles yet. Check back soon.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.badge}>{item.category.toUpperCase()}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.excerpt} numberOfLines={2}>{item.excerpt}</Text>
        </View>
      )}
    />
  )
}

const styles = StyleSheet.create({
  // The FlatList is the screen itself: without a background it fell back to
  // the light system default while the other tabs are dark.
  screen: { flex: 1, backgroundColor: '#09090b' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#09090b',
  },
  empty: { color: '#71717a', textAlign: 'center' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    gap: 6,
  },
  badge: { fontSize: 10, fontWeight: '700', color: '#0ea5e9', letterSpacing: 1 },
  title: { fontSize: 15, fontWeight: '700', color: '#fff', lineHeight: 22 },
  excerpt: { fontSize: 13, color: '#71717a', lineHeight: 18 },
})
