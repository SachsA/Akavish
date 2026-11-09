import type { ReactNode } from 'react'
import { Linking, Platform, StyleSheet, Text, View, type TextStyle } from 'react-native'
import {
  IS_BOLD,
  IS_CODE,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_UNDERLINE,
  linkTarget,
  parseLexical,
  type LexicalNode,
} from '../lib/lexical'
import { colors, spacing } from '../theme'

// Renders Payload's Lexical JSON with native views. Same node coverage as the
// web's components/LexicalContent.tsx (paragraphs, headings, lists, quotes,
// links, inline formatting); an unknown node renders its children, so new
// editor features degrade to plain text instead of disappearing.

function textStyle(format: LexicalNode['format']): TextStyle[] {
  const f = typeof format === 'number' ? format : 0
  const out: TextStyle[] = []
  if (f & IS_BOLD) out.push({ fontWeight: '700', color: colors.text })
  if (f & IS_ITALIC) out.push({ fontStyle: 'italic' })
  const lines = [f & IS_UNDERLINE && 'underline', f & IS_STRIKETHROUGH && 'line-through'].filter(
    Boolean,
  )
  if (lines.length)
    out.push({ textDecorationLine: lines.join(' ') as TextStyle['textDecorationLine'] })
  if (f & IS_CODE) out.push(styles.code)
  return out
}

/** Inline content: text, links and line breaks, nested inside one <Text>. */
function renderInline(nodes: LexicalNode[] | undefined): ReactNode[] {
  if (!nodes) return []
  return nodes.map((node, i) => {
    switch (node.type) {
      case 'text':
        return (
          <Text key={i} style={textStyle(node.format)}>
            {node.text ?? ''}
          </Text>
        )
      case 'linebreak':
        return '\n'
      case 'link':
      case 'autolink': {
        const url = linkTarget(node)
        return (
          <Text
            key={i}
            style={url ? styles.link : undefined}
            onPress={url ? () => void Linking.openURL(url) : undefined}
            accessibilityRole={url ? 'link' : undefined}
          >
            {renderInline(node.children)}
          </Text>
        )
      }
      default:
        return <Text key={i}>{renderInline(node.children)}</Text>
    }
  })
}

function renderList(node: LexicalNode, key: number | string, depth = 0): ReactNode {
  const ordered = node.listType === 'number'
  let n = 0
  return (
    <View key={key} style={[styles.list, depth > 0 && { marginLeft: spacing.lg }]}>
      {(node.children ?? []).map((item, i) => {
        // Lexical nests a sub-list as a list item whose only child is a list.
        const nested = item.children?.find((c) => c.type === 'list')
        if (nested && item.children?.length === 1) return renderList(nested, i, depth + 1)
        n += 1
        return (
          <View key={i} style={styles.listItem}>
            <Text style={[styles.paragraph, styles.bullet]}>{ordered ? `${n}.` : '•'}</Text>
            <Text style={[styles.paragraph, styles.listText]}>
              {renderInline(item.children?.filter((c) => c.type !== 'list'))}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

function renderBlock(node: LexicalNode, key: number): ReactNode {
  switch (node.type) {
    case 'heading': {
      const level = node.tag === 'h1' || node.tag === 'h2' ? styles.h2 : styles.h3
      return (
        <Text key={key} style={[styles.heading, level]} accessibilityRole="header">
          {renderInline(node.children)}
        </Text>
      )
    }
    case 'list':
      return renderList(node, key)
    case 'quote':
      return (
        <View key={key} style={styles.quote}>
          <Text style={[styles.paragraph, styles.quoteText]}>{renderInline(node.children)}</Text>
        </View>
      )
    case 'horizontalrule':
      return <View key={key} style={styles.rule} />
    case 'paragraph':
    default:
      // An empty paragraph is how editors add spacing: skip it, the block gap
      // already separates paragraphs.
      if (!node.children?.length) return null
      return (
        <Text key={key} style={styles.paragraph}>
          {renderInline(node.children)}
        </Text>
      )
  }
}

export function LexicalContent({ content }: { content: string }) {
  const blocks = parseLexical(content)
  if (blocks.length === 0) return null
  return <View style={styles.body}>{blocks.map(renderBlock)}</View>
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  paragraph: { color: colors.body, fontSize: 17, lineHeight: 27 },
  heading: { color: colors.text, fontWeight: '800', marginTop: spacing.sm },
  h2: { fontSize: 22, lineHeight: 29 },
  h3: { fontSize: 19, lineHeight: 26 },
  list: { gap: spacing.sm },
  listItem: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.sm },
  bullet: { minWidth: 18, color: colors.muted },
  listText: { flex: 1 },
  quote: { borderLeftWidth: 2, borderLeftColor: colors.accent, paddingLeft: spacing.lg },
  quoteText: { fontStyle: 'italic', color: colors.muted },
  link: { color: colors.accent, textDecorationLine: 'underline' },
  code: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    backgroundColor: colors.surface,
    color: colors.text,
  },
  rule: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
})
