// ─── French translations of articles ─────────────────────────────────────────
// English is the source. Each article carries its French version in the `fr`
// group (title, excerpt, content, SEO), filled by Claude:
//
// - Publishing an article, or changing the English text of a published one,
//   marks `fr.status` "pending" and queues the `translateArticle` job
//   (beforeChange / afterChange hooks in collections/Articles.ts). The job
//   waits a minute, so a burst of edits (a live article, a fix after
//   publishing) makes one translation of the latest text.
// - An editor can correct the French by hand in /admin: it becomes "edited"
//   and stays until the English changes again (English wins).
// - `fr.sourceHash` is the English text the French was made from.
//
// The Lexical body is translated block by block (paragraph, heading, quote,
// list item) as small markup ("<b>Metro 2039</b> · Feb 4 <a n="0">HLTV</a>"),
// so bold, italics and links survive, then rebuilt into Lexical nodes.
//
// Costs go to `scout-usage` (purpose "translate"), outside the scout's own
// budget, under their own monthly cap (TRANSLATE_MONTHLY_BUDGET_USD, 30 $).

import { createHash } from 'node:crypto'
import type { Payload, PayloadHandler } from 'payload'
import { isEditorUser } from '../access/roles'
import { callTool, type FetchLike } from '../scout/anthropic'
import { costUsd } from '../scout/pricing'
import { scoutConfig } from '../scout/config'

// ─── What gets translated ────────────────────────────────────────────────────

export interface EnglishSource {
  title?: string | null
  excerpt?: string | null
  content?: unknown
  seo?: { title?: string | null; description?: string | null } | null
}

/**
 * JSON with object keys sorted. Postgres `jsonb` doesn't keep key order, so
 * the same Lexical document read back from the database and sent by the
 * admin form would otherwise compare as different.
 */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, (v as Record<string, unknown>)[k]]),
        )
      : v,
  )
}

/** Fingerprint of the English text: a new one means the French is stale. */
export function sourceHash(doc: EnglishSource): string {
  const payload = stableJson([
    doc.title ?? '',
    doc.excerpt ?? '',
    doc.content ?? null,
    doc.seo?.title ?? '',
    doc.seo?.description ?? '',
  ])
  return createHash('sha256').update(payload).digest('hex').slice(0, 32)
}

// ─── Lexical ⇄ markup ────────────────────────────────────────────────────────

type LexNode = {
  type: string
  text?: string
  format?: number | string
  children?: LexNode[]
  [key: string]: unknown
}

const FORMATS: Array<[number, string]> = [
  [1, 'b'],
  [2, 'i'],
  [4, 's'],
  [8, 'u'],
  [16, 'code'],
]
const TAGS = new Map(FORMATS.map(([bit, tag]) => [tag, bit]))
const BLOCKS = new Set(['paragraph', 'heading', 'quote', 'listitem'])
const INLINE = new Set(['text', 'link', 'autolink', 'linebreak', 'tab'])

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

/** A block's inline children as markup, plus the link nodes it refers to by number. */
export function toMarkup(children: LexNode[]): { markup: string; links: LexNode[] } {
  const links: LexNode[] = []
  const inline = (nodes: LexNode[]): string =>
    nodes
      .map((n) => {
        if (n.type === 'text') {
          const bits = typeof n.format === 'number' ? n.format : 0
          const tags = FORMATS.filter(([bit]) => bits & bit).map(([, tag]) => tag)
          return (
            tags.map((t) => `<${t}>`).join('') +
            escape(n.text ?? '') +
            [...tags]
              .reverse()
              .map((t) => `</${t}>`)
              .join('')
          )
        }
        if (n.type === 'linebreak') return '<br/>'
        if (n.type === 'tab') return '\t'
        if (n.type === 'link' || n.type === 'autolink') {
          links.push(n)
          return `<a n="${links.length - 1}">${inline(n.children ?? [])}</a>`
        }
        return escape(n.text ?? '')
      })
      .join('')
  return { markup: inline(children), links }
}

const textNode = (text: string, format = 0): LexNode => ({
  type: 'text',
  text,
  format,
  style: '',
  mode: 'normal',
  detail: 0,
  version: 1,
})

/**
 * Markup back to Lexical inline nodes. Null when it doesn't parse (an
 * unknown tag, unbalanced tags, a link number that doesn't exist): the
 * caller then keeps the text without formatting.
 */
export function fromMarkup(markup: string, links: LexNode[]): LexNode[] | null {
  const root: LexNode[] = []
  const stack: Array<{ tag: string; nodes: LexNode[]; link?: LexNode }> = [{ tag: '', nodes: root }]
  let format = 0
  const re = /<(\/?)([a-z]+)(?:\s+n="(\d+)")?\s*(\/?)>/g
  let last = 0
  let m: RegExpExecArray | null
  const pushText = (raw: string) => {
    if (!raw) return
    stack[stack.length - 1].nodes.push(textNode(unescape(raw), format))
  }
  while ((m = re.exec(markup))) {
    pushText(markup.slice(last, m.index))
    last = re.lastIndex
    const [, closing, tag, n, selfClosing] = m
    if (tag === 'br' && (selfClosing || !closing)) {
      stack[stack.length - 1].nodes.push({ type: 'linebreak', version: 1 })
      continue
    }
    if (tag === 'a') {
      if (closing) {
        const top = stack.pop()
        if (!top || top.tag !== 'a' || !top.link) return null
        stack[stack.length - 1].nodes.push({ ...top.link, children: top.nodes })
      } else {
        const link = links[Number(n)]
        if (!link) return null
        stack.push({ tag: 'a', nodes: [], link })
      }
      continue
    }
    const bit = TAGS.get(tag)
    if (bit === undefined) return null
    if (closing) {
      if (!(format & bit)) return null
      format &= ~bit
    } else {
      format |= bit
    }
  }
  pushText(markup.slice(last))
  if (stack.length !== 1 || format !== 0) return null
  return root
}

/** Strip the markup: the fallback when the model's markup doesn't parse. */
export function plainText(markup: string): string {
  return unescape(markup.replace(/<[^>]+>/g, ''))
}

/**
 * The blocks whose text gets translated, in order: paragraphs, headings,
 * quotes and list items (their own text; a nested list is walked too).
 */
export function collectBlocks(root: LexNode): LexNode[] {
  const out: LexNode[] = []
  const walk = (node: LexNode) => {
    if (BLOCKS.has(node.type) && (node.children ?? []).some((c) => INLINE.has(c.type)))
      out.push(node)
    for (const child of node.children ?? []) if (!INLINE.has(child.type)) walk(child)
  }
  walk(root)
  return out
}

/** The French Lexical document: a deep copy of the English one with each block's text replaced. */
export function applyTranslation(content: unknown, translated: string[]): unknown {
  const copy = JSON.parse(JSON.stringify(content)) as { root: LexNode }
  const blocks = collectBlocks(copy.root)
  blocks.forEach((block, i) => {
    const children = block.children ?? []
    const { links } = toMarkup(children.filter((c) => INLINE.has(c.type)))
    const rebuilt = fromMarkup(translated[i] ?? '', links) ?? [
      textNode(plainText(translated[i] ?? '')),
    ]
    // Inline children are replaced; nested blocks (a sub-list) stay after them.
    block.children = [...rebuilt, ...children.filter((c) => !INLINE.has(c.type))]
  })
  return copy
}

// ─── The model ───────────────────────────────────────────────────────────────

export const TRANSLATE_SYSTEM = `You translate articles from Akavish, an English-language video game news site, into French for its French edition.

- Write natural French, as a French video game journalist would: not word for word. Keep the tone (a first-person review stays first person: "J'ai adoré…").
- Keep as is: game titles (unless a well-known official French title exists), company, studio, team, player and product names, platform names (PS5, Xbox Series X|S, Switch 2, PC), esports terms players use in French too (map, round, MVP, roster).
- French typography: « guillemets » with spaces for quotes, decimal comma (8,5/10), French date formats ("4 févr.", "4 février 2027", "fin 2027"), a space before : ; ! ? and %.
- Each segment is one paragraph, heading or list item, with inline markup: <b>, <i>, <s>, <u>, <code>, <br/>, and links <a n="0">…</a>. Return exactly one translated segment per input segment, in the same order, keeping every tag and every link number (move them to wherever the matching words land).
- In a list item that starts "<b>Game</b> · date", keep that shape with the date in French.
- Translate everything else, headings included ("Sources" stays "Sources", "Verdict" stays "Verdict").
Answer with the tool.`

export const TRANSLATE_TOOL = {
  name: 'french_version',
  description: 'The French version of the article.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      excerpt: { type: 'string' },
      seo_title: { type: 'string', description: 'Empty when the English one is empty.' },
      seo_description: { type: 'string', description: 'Empty when the English one is empty.' },
      cover_alt: { type: 'string', description: 'Empty when no cover alt text was given.' },
      segments: { type: 'array', items: { type: 'string' } },
    },
    required: ['title', 'excerpt', 'seo_title', 'seo_description', 'cover_alt', 'segments'],
  },
} as const

export interface TranslateAnswer {
  title: string
  excerpt: string
  seo_title: string
  seo_description: string
  cover_alt: string
  segments: string[]
}

/** The user turn: the English fields and the numbered segments. Pure. */
export function translatePrompt(
  doc: EnglishSource,
  segments: string[],
  coverAlt?: string | null,
): string {
  return JSON.stringify(
    {
      title: doc.title ?? '',
      excerpt: doc.excerpt ?? '',
      seo_title: doc.seo?.title ?? '',
      seo_description: doc.seo?.description ?? '',
      cover_alt: coverAlt ?? '',
      segments,
    },
    null,
    1,
  )
}

// ─── Live articles ───────────────────────────────────────────────────────────

/**
 * The article of a showcase being covered live (scout event "live" or
 * "ending", src/scout/live.ts). It changes every 5 minutes: it stays in
 * English while live (the French page says so) and is translated once, when
 * the live ends (runLive queues it).
 */
export async function isLiveArticle(
  payload: Payload,
  articleId: number | string,
  req?: Parameters<Payload['find']>[0]['req'],
): Promise<boolean> {
  const { totalDocs } = await payload.count({
    collection: 'scout-events',
    where: { and: [{ article: { equals: articleId } }, { status: { in: ['live', 'ending'] } }] },
    overrideAccess: true,
    req,
  })
  return totalDocs > 0
}

/** Ids of the articles live right now (GET /api/live-articles, public). */
export const liveArticlesHandler: PayloadHandler = async (req) => {
  const { docs } = await req.payload.find({
    collection: 'scout-events',
    where: { status: { in: ['live', 'ending'] } },
    depth: 0,
    limit: 10,
    select: { article: true },
    overrideAccess: true,
  })
  const ids = (docs as unknown as Array<{ article?: number | null }>)
    .map((d) => d.article)
    .filter((id): id is number => typeof id === 'number')
  return Response.json({ ids }, { headers: { 'Cache-Control': 'public, max-age=30' } })
}

// ─── The job ─────────────────────────────────────────────────────────────────

const BUDGET_USD = () => {
  const n = Number(process.env.TRANSLATE_MONTHLY_BUDGET_USD)
  return Number.isFinite(n) && n > 0 ? n : 30
}

async function spentThisMonth(payload: Payload, now = new Date()): Promise<number> {
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const { docs } = await payload.find({
    collection: 'scout-usage',
    where: {
      and: [{ purpose: { equals: 'translate' } }, { createdAt: { greater_than_equal: month } }],
    },
    pagination: false,
    limit: 0,
    depth: 0,
    select: { costUsd: true },
    overrideAccess: true,
  })
  return (docs as unknown as Array<{ costUsd?: number }>).reduce((s, d) => s + (d.costUsd ?? 0), 0)
}

type ArticleDoc = EnglishSource & {
  id: number | string
  status?: string
  _status?: string
  coverImage?:
    { id: number | string; alt?: string | null; altFr?: string | null } | number | string | null
  fr?: { status?: string | null; sourceHash?: string | null } | null
}

/**
 * Translate one article into French and save it. Skips when the French is
 * already up to date, the article isn't published, or there's no API key.
 * Returns what happened, for the job log.
 */
export async function translateArticle(
  payload: Payload,
  articleId: number | string,
  {
    fetchImpl,
    force = false,
    apiKey,
  }: { fetchImpl?: FetchLike; force?: boolean; apiKey?: string } = {},
): Promise<'translated' | 'up-to-date' | 'not-published' | 'no-key' | 'over-budget'> {
  const config = scoutConfig()
  const key = apiKey ?? config.anthropicKey
  const doc = (await payload.findByID({
    collection: 'articles',
    id: articleId,
    depth: 1,
    overrideAccess: true,
  })) as unknown as ArticleDoc
  if (doc.status !== 'published') return 'not-published'
  const hash = sourceHash(doc)
  if (!force && doc.fr?.sourceHash === hash && doc.fr?.status !== 'pending') return 'up-to-date'
  if (!key) return 'no-key'
  if ((await spentThisMonth(payload)) >= BUDGET_USD()) {
    payload.logger.warn({ msg: '[translate] monthly budget reached, skipping', article: articleId })
    return 'over-budget'
  }

  const content = doc.content as { root?: LexNode } | undefined
  const blocks = content?.root ? collectBlocks(content.root) : []
  const segments = blocks.map(
    (b) => toMarkup((b.children ?? []).filter((c) => INLINE.has(c.type))).markup,
  )
  const cover = doc.coverImage && typeof doc.coverImage === 'object' ? doc.coverImage : null

  let answer: TranslateAnswer | null = null
  for (let attempt = 0; attempt < 2 && !answer; attempt++) {
    const result = await callTool<TranslateAnswer>({
      apiKey: key,
      model: config.draftModel,
      system: TRANSLATE_SYSTEM,
      prompt: translatePrompt(doc, segments, cover && !cover.altFr ? cover.alt : null),
      tool: TRANSLATE_TOOL as unknown as Parameters<typeof callTool>[0]['tool'],
      maxTokens: 32_000,
      timeoutMs: 300_000,
      fetchImpl,
    })
    await payload.create({
      collection: 'scout-usage',
      data: {
        kind: 'llm',
        purpose: 'translate',
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: costUsd(result.model, result.inputTokens, result.outputTokens),
      },
      overrideAccess: true,
    })
    const a = result.input
    if (
      a &&
      typeof a.title === 'string' &&
      Array.isArray(a.segments) &&
      a.segments.length === segments.length
    ) {
      answer = a
    } else {
      payload.logger.warn({
        msg: '[translate] segment count mismatch, retrying',
        article: articleId,
        expected: segments.length,
        got: Array.isArray(a?.segments) ? a.segments.length : null,
      })
    }
  }
  if (!answer)
    throw new Error(`Translation of article ${articleId} failed: wrong number of segments`)

  await payload.update({
    collection: 'articles',
    id: articleId,
    data: {
      fr: {
        title: answer.title.trim(),
        excerpt: answer.excerpt.trim(),
        content: content ? applyTranslation(content, answer.segments) : null,
        seoTitle: answer.seo_title.trim() || null,
        seoDescription: answer.seo_description.trim() || null,
        status: 'auto',
        sourceHash: hash,
        translatedAt: new Date().toISOString(),
      },
    } as never,
    overrideAccess: true,
    context: { translating: true },
  })
  if (cover && !cover.altFr && answer.cover_alt.trim()) {
    await payload.update({
      collection: 'media',
      id: cover.id,
      data: { altFr: answer.cover_alt.trim() } as never,
      overrideAccess: true,
    })
  }
  return 'translated'
}

// ─── Short texts: tag names, author bios ─────────────────────────────────────

export const SHORT_TOOL = {
  name: 'french_texts',
  description: 'The French version of each text, same order.',
  input_schema: {
    type: 'object',
    properties: { texts: { type: 'array', items: { type: 'string' } } },
    required: ['texts'],
  },
} as const

/**
 * French versions of short texts (tag names, a bio), in one call. Names stay
 * as they are; themes are translated ("Release dates" → "Dates de sortie").
 */
export async function translateShort(
  payload: Payload,
  texts: string[],
  kind: 'tag names' | 'author bios',
  { fetchImpl, apiKey }: { fetchImpl?: FetchLike; apiKey?: string } = {},
): Promise<string[] | null> {
  const config = scoutConfig()
  const key = apiKey ?? config.anthropicKey
  if (!key || texts.length === 0) return null
  const result = await callTool<{ texts: string[] }>({
    apiKey: key,
    model: config.draftModel,
    system: `You translate ${kind} from Akavish, an English video game news site, into French. Proper names (companies, games, platforms, events, people) stay exactly as they are; only common words are translated, in the style of a French gaming site ("Release dates" → "Dates de sortie", "Studio closures" → "Fermetures de studios", "PS5" → "PS5"). Same order, same count. Answer with the tool.`,
    prompt: JSON.stringify(texts),
    tool: SHORT_TOOL as unknown as Parameters<typeof callTool>[0]['tool'],
    maxTokens: 8000,
    fetchImpl,
  })
  await payload.create({
    collection: 'scout-usage',
    data: {
      kind: 'llm',
      purpose: 'translate',
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: costUsd(result.model, result.inputTokens, result.outputTokens),
    },
    overrideAccess: true,
  })
  const out = result.input?.texts
  return Array.isArray(out) && out.length === texts.length ? out.map((t) => String(t).trim()) : null
}

/** Tags without a French name and authors without a French bio get one. */
export async function translateTaxonomy(
  payload: Payload,
  opts: { fetchImpl?: FetchLike; apiKey?: string } = {},
): Promise<{ tags: number; authors: number }> {
  const { docs: tags } = await payload.find({
    collection: 'tags',
    where: { or: [{ nameFr: { exists: false } }, { nameFr: { equals: '' } }] },
    pagination: false,
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  let tagCount = 0
  for (let i = 0; i < tags.length; i += 100) {
    const batch = tags.slice(i, i + 100) as unknown as Array<{ id: number; name: string }>
    const fr = await translateShort(
      payload,
      batch.map((t) => t.name),
      'tag names',
      opts,
    )
    if (!fr) continue
    for (const [j, tag] of batch.entries()) {
      await payload.update({
        collection: 'tags',
        id: tag.id,
        data: { nameFr: fr[j] } as never,
        overrideAccess: true,
      })
      tagCount++
    }
  }
  const { docs: authors } = await payload.find({
    collection: 'authors',
    where: {
      and: [
        { bio: { exists: true } },
        { or: [{ bioFr: { exists: false } }, { bioFr: { equals: '' } }] },
      ],
    },
    pagination: false,
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  const withBio = (authors as unknown as Array<{ id: number; bio?: string | null }>).filter((a) =>
    a.bio?.trim(),
  )
  let authorCount = 0
  const bios = await translateShort(
    payload,
    withBio.map((a) => a.bio!.trim()),
    'author bios',
    opts,
  )
  if (bios) {
    for (const [j, a] of withBio.entries()) {
      await payload.update({
        collection: 'authors',
        id: a.id,
        data: { bioFr: bios[j] } as never,
        overrideAccess: true,
      })
      authorCount++
    }
  }
  return { tags: tagCount, authors: authorCount }
}

/**
 * Queue a translation for every published article whose French is missing
 * or stale (the one-off backfill, and a safety net). Returns how many.
 */
export async function queueMissingTranslations(payload: Payload): Promise<number> {
  const { docs } = await payload.find({
    collection: 'articles',
    where: { status: { equals: 'published' } },
    pagination: false,
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  let queued = 0
  for (const doc of docs as unknown as ArticleDoc[]) {
    if (doc.fr?.sourceHash === sourceHash(doc) && doc.fr?.status !== 'pending') continue
    await payload.jobs.queue({
      task: 'translateArticle',
      input: { articleId: Number(doc.id) },
      queue: 'translate',
    })
    queued++
  }
  return queued
}

// ─── POST /api/translate/backfill (editors) ──────────────────────────────────

/**
 * The one-off backfill: French names for tags and bios for authors now, and
 * a translation job queued for every published article without an up-to-date
 * French version (they run on the "translate" queue, a few a minute).
 */
export const translateBackfillHandler: PayloadHandler = async (req) => {
  if (!req.user || req.user.collection !== 'users')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (!isEditorUser(req.user)) return Response.json({ error: 'editors only' }, { status: 403 })
  const taxonomy = await translateTaxonomy(req.payload)
  const queued = await queueMissingTranslations(req.payload)
  return Response.json({ queued, ...taxonomy })
}
