// ─── RSS / Atom parsing ──────────────────────────────────────────────────────
// Pure: XML in, normalised items out. Unit-tested in feeds.test.ts against the
// shapes the default sources actually serve (RSS 2.0, Atom, Feedburner).

import { XMLParser } from 'fast-xml-parser'

export interface FeedItem {
  title: string
  url: string
  summary: string
  publishedAt?: Date
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // CDATA and entities come back as plain text.
  cdataPropName: false,
  processEntities: true,
  htmlEntities: true,
  trimValues: true,
})

const asArray = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v]

/** Text of a node that may be a string, a number, or `{ '#text': … }`. */
function text(v: unknown): string {
  if (v === undefined || v === null) return ''
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (typeof v === 'object' && '#text' in (v as Record<string, unknown>)) {
    return text((v as Record<string, unknown>)['#text'])
  }
  return ''
}

// Named entities seen in the default feeds' summaries (French ones included).
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  laquo: '«',
  raquo: '»',
  euro: '€',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  agrave: 'à',
  acirc: 'â',
  ccedil: 'ç',
  ocirc: 'ô',
  icirc: 'î',
  ucirc: 'û',
  ugrave: 'ù',
  Eacute: 'É',
}

/** Plain text from an HTML snippet (feed summaries often carry markup). */
export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const code =
          e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
        return Number.isFinite(code) ? String.fromCodePoint(code) : m
      }
      return ENTITIES[e] ?? ENTITIES[e.toLowerCase()] ?? m
    })
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Canonical form of an article URL, so the same article seen twice (or with
 * tracking parameters) is stored once: no fragment, no utm_* / ref params.
 */
export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    u.hash = ''
    for (const key of [...u.searchParams.keys()]) {
      if (/^utm_|^(ref|ref_src|cmpid|ocid|fbclid|gclid)$/i.test(key)) u.searchParams.delete(key)
    }
    return u.toString()
  } catch {
    return null
  }
}

function date(v: unknown): Date | undefined {
  const s = text(v)
  if (!s) return undefined
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? undefined : d
}

const SUMMARY_MAX = 600

function item(title: unknown, link: string, summary: unknown, published: unknown): FeedItem | null {
  const url = normalizeUrl(link)
  const t = stripHtml(text(title))
  if (!url || !t) return null
  const s = stripHtml(text(summary))
  return {
    title: t.slice(0, 300),
    url,
    summary: s.length > SUMMARY_MAX ? `${s.slice(0, SUMMARY_MAX - 1)}…` : s,
    publishedAt: date(published),
  }
}

/** Items of an RSS 2.0 or Atom document, in feed order. Unparseable → []. */
export function parseFeed(xml: string): FeedItem[] {
  let doc: Record<string, any>
  try {
    doc = parser.parse(xml)
  } catch {
    return []
  }

  // RSS 2.0 (and RSS 1.0 / RDF, whose items sit beside the channel).
  const channel = doc?.rss?.channel ?? doc?.['rdf:RDF']?.channel
  if (channel) {
    const rssItems = asArray(channel.item ?? doc?.['rdf:RDF']?.item)
    return rssItems
      .map((i: Record<string, any>) =>
        item(
          i.title,
          text(i.link) ||
            (typeof i.guid === 'object' && i.guid?.['@_isPermaLink'] !== 'false'
              ? text(i.guid)
              : ''),
          i.description ?? i['content:encoded'],
          i.pubDate ?? i['dc:date'],
        ),
      )
      .filter((x): x is FeedItem => x !== null)
  }

  // Atom.
  const feed = doc?.feed
  if (feed) {
    return asArray(feed.entry)
      .map((e: Record<string, any>) => {
        const links = asArray(e.link) as Array<Record<string, string> | string>
        const alternate =
          links.find((l) => typeof l === 'object' && (!l['@_rel'] || l['@_rel'] === 'alternate')) ??
          links[0]
        const href = typeof alternate === 'string' ? alternate : (alternate?.['@_href'] ?? '')
        return item(e.title, href, e.summary ?? e.content, e.published ?? e.updated)
      })
      .filter((x): x is FeedItem => x !== null)
  }

  return []
}
