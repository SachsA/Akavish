// ─── Article text ────────────────────────────────────────────────────────────
// Feed summaries are often one line. Before drafting, the scout reads the
// source pages themselves (same honest User-Agent as the feeds) and keeps the
// paragraphs, so the draft is built on facts rather than on a teaser. Read to
// synthesise and cite, never republished: the drafting prompt forbids copying.

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

/** Fetch a page and extract its text; '' on any failure (the summary is used instead). */
export async function fetchArticleText(url: string, fetchImpl: FetchLike): Promise<string> {
  try {
    const res = await fetchImpl(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return ''
    const html = await res.text()
    return html.length > 3_000_000 ? '' : extractArticleText(html)
  } catch {
    return ''
  }
}
