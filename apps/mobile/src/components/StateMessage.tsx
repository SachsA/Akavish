import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, spacing } from '../theme'

/** Full-screen spinner while the first data loads. */
export function Loading() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" />
    </View>
  )
}

/**
 * Empty, error and not-found states. Reader-facing wording only: no developer
 * instructions (the web learned that the hard way, PROGRESS.md #10).
 */
export function StateMessage({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string
  body?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  button: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonText: { color: colors.onAccent, fontWeight: '700', fontSize: 15 },
})
