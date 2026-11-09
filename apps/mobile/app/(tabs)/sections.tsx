import Ionicons from '@expo/vector-icons/Ionicons'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { CATEGORIES } from '@akavish/api-client/categories'
import { SITE_URL } from '../../src/lib/format'
import { colors, spacing } from '../../src/theme'

// Every section (the tabs only hold four), then the site's own pages. The
// privacy policy link is also what the app stores ask for.
const SITE_LINKS = [
  { label: 'About Akavish', path: '/about' },
  { label: 'Contact', path: '/contact' },
  { label: 'Privacy policy', path: '/privacy' },
  { label: 'Terms of use', path: '/terms' },
]

export default function SectionsScreen() {
  const router = useRouter()
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.group}>
        {CATEGORIES.map((c, i) => (
          <Pressable
            key={c.slug}
            onPress={() => router.push({ pathname: '/category/[slug]', params: { slug: c.slug } })}
            accessibilityRole="link"
            style={({ pressed }) => [
              styles.row,
              i > 0 && styles.divider,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.rowText}>
              <Text style={styles.label}>{c.label}</Text>
              <Text style={styles.blurb}>{c.blurb}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>

      <View style={styles.group}>
        {SITE_LINKS.map((l, i) => (
          <Pressable
            key={l.path}
            accessibilityRole="link"
            onPress={() => void Linking.openURL(`${SITE_URL}${l.path}`)}
            style={({ pressed }) => [
              styles.row,
              i > 0 && styles.divider,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, styles.rowText]}>{l.label}</Text>
            <Ionicons name="open-outline" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>

      <Text style={styles.version}>Akavish {Constants.expoConfig?.version ?? ''}</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl },
  group: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { backgroundColor: colors.border },
  rowText: { flex: 1, gap: 2 },
  label: { color: colors.text, fontSize: 16, fontWeight: '600' },
  blurb: { color: colors.muted, fontSize: 13 },
  version: { color: colors.muted, fontSize: 12, textAlign: 'center' },
})
