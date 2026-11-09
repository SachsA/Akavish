import { Text, type TextStyle } from 'react-native'
import { colors } from '../theme'

/**
 * "Akav" in white, "ish" dimmed: the same mark as the web's Wordmark
 * (apps/web/src/components/Wordmark.tsx). Keep the two in sync by hand.
 */
export function Wordmark({ size = 20 }: { size?: number }) {
  const base: TextStyle = { fontSize: size, fontWeight: '900', letterSpacing: -0.5 }
  return (
    <Text style={base} accessibilityRole="header" accessibilityLabel="Akavish">
      <Text style={{ color: colors.text }}>Akav</Text>
      <Text style={{ color: '#71717a' }}>ish</Text>
    </Text>
  )
}
