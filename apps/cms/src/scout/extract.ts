// ─── Article text and media ──────────────────────────────────────────────────
// Feed summaries are often one line. Before drafting, the scout reads the
// source pages themselves (same honest User-Agent as the feeds) and keeps the
// paragraphs, so the draft is built on facts rather than on a teaser. Read to
// synthesise and cite, never republished: the drafting prompt forbids copying.
// The same read notes the page's share image (og:image) and the YouTube videos
// embedded or linked in the article body (media.ts decides what to use).

import type { FetchLike } from './anthropic'
import { stripHtml } from './feeds'

export const USER_AGENT = 'AkavishScout/1.0 (+https://akavish.gg)'
const MAX_CHARS = 5000

/**
 * The readable text of an article page: the <p> paragraphs of its <article>
 * (or <main>, or the whole body), boilerplate-length lines dropped. Pure.
 */
export function extractArticleText(html: string): string {
  const scope =
    html.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ??
    html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ??
    html.match(/<body\b[\s\S]*?<\/body>/i)?.[0] ??
    html
  const cleaned = scope.replace(
    /<(script|style|nav|footer|aside|form|figure)\b[\s\S]*?<\/\1>/gi,
    ' ',
  )
  const paragraphs = [...cleaned.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripHtml(m[1]))
    // Bylines, captions, "Read more", cookie notes: too short to carry facts.
    .filter((p) => p.length >= 60)
  const text = paragraphs.join('\n\n')
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}…` : text
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .trim()

/** The page's share image (og:image, else twitter:image), as an absolute https URL. Pure. */
export function extractShareImage(html: string, pageUrl: string): string | null {
  const head = html.slice(0, 200_000)
  for (const prop of ['og:image:secure_url', 'og:image', 'twitter:image']) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`,
      'i',
    )
    const m = head.match(re)
    const raw = m?.[1] ?? m?.[2]
    if (!raw) continue
    try {
      const url = new URL(decode(raw), pageUrl)
      if (url.protocol === 'https:') return url.toString()
    } catch {
      // not a URL
    }
  }
  return null
}

/** YouTube video ids embedded or linked in the article body (not the sidebar). Pure. */
export function extractYouTubeIds(html: string): string[] {
  const scope =
    html.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ??
    html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ??
    html
  const ids: string[] = []
  const re =
    /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?(?:[^"'\s<>]*?&(?:amp;)?)?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/g
  for (const m of scope.matchAll(re)) if (!ids.includes(m[1])) ids.push(m[1])
  return ids.slice(0, 6)
}

export interface PageRead {
  text: string
  image: string | null
  videos: string[]
}

/** Fetch a page: its text, share image and YouTube videos; empty on any failure. */
export async function fetchPage(url: string, fetchImpl: FetchLike): Promise<PageRead> {
  const empty = { text: '', image: null, videos: [] }
  try {
    const res = await fetchImpl(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return empty
    const html = await res.text()
    if (html.length > 3_000_000) return empty
    return {
      text: extractArticleText(html),
      image: extractShareImage(html, url),
      videos: extractYouTubeIds(html),
    }
  } catch {
    return empty
  }
}

/** Fetch a page and extract its text only; '' on any failure. */
export async function fetchArticleText(url: string, fetchImpl: FetchLike): Promise<string> {
  return (await fetchPage(url, fetchImpl)).text
}
