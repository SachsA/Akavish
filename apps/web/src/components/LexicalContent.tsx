import React from 'react'
import { localizePath, type Locale } from '@/lib/i18n/config'

// Minimal renderer for Payload's Lexical rich-text JSON.
// Handles the common node types; unknown nodes fall back to rendering children.

interface LexicalNode {
  type: string
  tag?: string
  format?: number | string
  text?: string
  url?: string
  fields?: { url?: string; newTab?: boolean }
  listType?: 'bullet' | 'number'
  children?: LexicalNode[]
}

// Bitmask flags Lexical uses for inline text formatting.
const IS_BOLD = 1
const IS_ITALIC = 1 << 1
const IS_STRIKETHROUGH = 1 << 2
const IS_UNDERLINE = 1 << 3
const IS_CODE = 1 << 4

function renderText(node: LexicalNode, key: React.Key): React.ReactNode {
  let el: React.ReactNode = node.text ?? ''
  const format = typeof node.format === 'number' ? node.format : 0

  if (format & IS_CODE)
    el = <code className="bg-zinc-800 px-1 py-0.5 rounded text-sm">{el}</code>
  if (format & IS_BOLD) el = <strong>{el}</strong>
  if (format & IS_ITALIC) el = <em>{el}</em>
  if (format & IS_UNDERLINE) el = <u>{el}</u>
  if (format & IS_STRIKETHROUGH) el = <s>{el}</s>

  return <React.Fragment key={key}>{el}</React.Fragment>
}

function renderChildren(children: LexicalNode[] | undefined, locale: Locale): React.ReactNode {
  if (!children) return null
  return children.map((child, i) => renderNode(child, i, locale))
}

function renderNode(node: LexicalNode, key: React.Key, locale: Locale): React.ReactNode {
  switch (node.type) {
    case 'text':
      return renderText(node, key)

    case 'paragraph':
      return (
        <p key={key} className="mb-4 leading-relaxed text-zinc-300">
          {renderChildren(node.children, locale)}
        </p>
      )

    case 'heading': {
      const tag = (node.tag ?? 'h2') as keyof React.JSX.IntrinsicElements
      const sizes: Record<string, string> = {
        h1: 'text-3xl',
        h2: 'text-2xl',
        h3: 'text-xl',
        h4: 'text-lg',
      }
      return React.createElement(
        tag,
        { key, className: `${sizes[tag] ?? 'text-xl'} font-bold text-white mt-8 mb-3` },
        renderChildren(node.children, locale)
      )
    }

    case 'list': {
      const Tag = node.listType === 'number' ? 'ol' : 'ul'
      return (
        <Tag
          key={key}
          className={`mb-4 ml-6 space-y-1 text-zinc-300 ${
            node.listType === 'number' ? 'list-decimal' : 'list-disc'
          }`}
        >
          {renderChildren(node.children, locale)}
        </Tag>
      )
    }

    case 'listitem':
      return <li key={key}>{renderChildren(node.children, locale)}</li>

    case 'quote':
      return (
        <blockquote
          key={key}
          className="border-l-2 border-emerald-600 pl-4 italic text-zinc-400 my-4"
        >
          {renderChildren(node.children, locale)}
        </blockquote>
      )

    case 'link': {
      // Site links ("/game/…") stay in the page's language; others are untouched.
      const url = localizePath(locale, node.fields?.url ?? node.url ?? '#')
      // Stays a plain <a> on purpose — do NOT "upgrade" this to next/link.
      // These URLs are typed by editors in the CMS and can be anything:
      // external sites, mailto:, or an in-page anchor. <Link> assumes an
      // internal route and would try to client-navigate to all of them.
      return (
        <a
          key={key}
          href={url}
          target={node.fields?.newTab ? '_blank' : undefined}
          rel={node.fields?.newTab ? 'noopener noreferrer' : undefined}
          className="text-emerald-400 underline hover:text-emerald-300"
        >
          {renderChildren(node.children, locale)}
        </a>
      )
    }

    case 'linebreak':
      return <br key={key} />

    default:
      // Unknown node type: render its children if any.
      return node.children ? (
        <React.Fragment key={key}>{renderChildren(node.children, locale)}</React.Fragment>
      ) : null
  }
}

export function LexicalContent({ content, locale = 'en' }: { content: string; locale?: Locale }) {
  let root: LexicalNode | null = null
  try {
    const parsed = JSON.parse(content)
    root = parsed?.root ?? parsed ?? null
  } catch {
    root = null
  }

  if (!root || !root.children) {
    return <p className="text-zinc-400">{locale === 'fr' ? 'Pas de contenu.' : 'No content.'}</p>
  }

  return <div>{renderChildren(root.children, locale)}</div>
}
