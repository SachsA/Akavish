// ─── Drafting prompt ─────────────────────────────────────────────────────────
// What Sonnet reads to write an article, and how its answer becomes a CMS
// article (Lexical rich text + a Sources block). Pure, unit-tested.

import { CATEGORIES, type Category } from './triage-prompt'

export interface DraftSource {
  name: string
  url: string
  title: string
  /** Page text, or the feed summary when the page couldn't be read. */
  text: string
  reliability: 'official' | 'high' | 'variable'
  /** The page's share image (og:image), when it was read. */
  image?: string | null
  /** The publisher's own description of that image (og:image:alt), if any. */
  imageAlt?: string | null
  /** YouTube ids embedded or linked in the article. */
  videos?: string[]
}

/** A YouTube video found in the sources, with its oEmbed title and channel. */
export interface VideoRef {
  title: string
  channel: string
  url: string
}

export type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; items: string[] }

export interface DraftAnswer {
  title: string
  excerpt: string
  category: Category
  blocks: Block[]
  seo_description: string
  /** Numbers (1-based) of the listed videos to show in "Watch". */
  videos?: number[]
  /** Names picked from the site's existing tags. */
  tags?: string[]
  /** The game the story is about, copied from the existing games list. */
  game?: string
}

export const DRAFT_SYSTEM = `You write news articles for Akavish, an English-language video game news site. Tone: direct, factual, no fluff, no hype words ("insane", "epic"), no clickbait, no emoji. Readers are gamers who want the facts fast.

Hard rules:
- Use ONLY facts stated in the sources given. No number, date, name, platform, price or quote that isn't in them. If a detail matters but is missing, leave it out; never guess.
- Synthesise across the sources in your own words. Never follow one source's structure, never copy its sentences. Short direct quotes are allowed only for an official statement or a leaker's own words, in quotation marks and attributed ("…", Rockstar said).
- Leaks and rumours: say so in the headline or the first sentence ("Rumour:", "reportedly", "according to <leaker>"), name who claims it, and say what is unconfirmed. Never present a leak as fact.
- Attribute: "according to IGN", "Insider Gaming reports". When an official source confirms, say it is official.
- Length: 150 to 300 words for news and leaks; up to 450 for a recap of several announcements or esport results.
- Structure: first paragraph = the news itself (who, what, when). Then context and details. A heading only if the article is long enough to need one. No conclusion paragraph that repeats the intro, no "stay tuned".
- Headline: under 90 characters, says the news, sentence case.
- Excerpt: one or two sentences, under 200 characters, not a copy of the first paragraph.
- SEO description: under 155 characters.
- Write in English even when sources are in French or another language.
- Tags: pick 2 to 5 from the existing tags listed, copied exactly: cross-cutting topics such as the publisher or studio, the platform, the event, the theme (Release dates, Trailers, Earnings…). Never the game itself, never the category, never a tag that doesn't fit the story, never one that isn't in the list. Fewer is fine when few fit; none if the list is empty.
- Game: when the story is about one game in the existing games list, put its exact name in "game" (match "GTA 6" to "Grand Theft Auto VI"). Leave it empty for a story about several games, a platform, a service or a game that isn't listed.
- Videos: when videos found in the sources are listed, put in "videos" the numbers of those that are official (the publisher's, studio's, platform holder's or tournament organiser's own channel) AND directly about this story, such as the trailer the article is about. None otherwise. Do not mention a video in the text unless you selected it.
Do not add a sources list or video links: they are appended automatically.`

/** The user turn: story, sources, and for a revision the previous version + feedback. */
export function draftPrompt(args: {
  storyTitle: string
  category?: string | null
  game?: string | null
  sources: DraftSource[]
  previous?: { title: string; body: string }
  feedback?: string
  videos?: VideoRef[]
  /** Names of the site's existing tags, to pick from. */
  tags?: string[]
  /** Names of the site's existing games, to pick from. */
  games?: string[]
}): string {
  const sources = args.sources
    .map(
      (s, i) =>
        `--- Source ${i + 1}: ${s.name} (${s.reliability === 'official' ? 'official source' : s.reliability === 'variable' ? 'leaker / unverified' : 'established outlet'})\nTitle: ${s.title}\nURL: ${s.url}\n${s.text || '(no text available, title only)'}`,
    )
    .join('\n\n')
  let prompt = `Story: ${args.storyTitle}\nSuggested category: ${args.category ?? 'news'}${args.game ? `\nGame: ${args.game}` : ''}\n\n${sources}`
  if (args.videos?.length) {
    prompt += `\n\n--- Videos found in the sources\n${args.videos
      .map((v, i) => `[${i + 1}] "${v.title}" (YouTube channel: ${v.channel || 'unknown'})`)
      .join('\n')}`
  }
  if (args.games?.length) {
    prompt += `\n\n--- Existing games (the one this story is about, exact name, or none)\n${args.games.join(', ')}`
  }
  if (args.tags?.length) {
    prompt += `\n\n--- Existing tags (pick 2 to 5, exact names)\n${args.tags.join(', ')}`
  }
  if (args.previous && args.feedback) {
    prompt += `\n\n--- Your previous version\nHeadline: ${args.previous.title}\n${args.previous.body}\n\n--- The editor's feedback (apply it, keep the hard rules)\n${args.feedback}`
  }
  return `${prompt}\n\nWrite the article.`
}

export const DRAFT_TOOL = {
  name: 'write_article',
  description: 'Record the article.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      excerpt: { type: 'string' },
      category: { type: 'string', enum: [...CATEGORIES] },
      blocks: {
        type: 'array',
        description: 'The body, in order.',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['paragraph', 'heading', 'quote', 'list'] },
            text: { type: 'string', description: 'For paragraph, heading, quote.' },
            items: { type: 'array', items: { type: 'string' }, description: 'For list.' },
          },
          required: ['type'],
        },
      },
      seo_description: { type: 'string' },
      videos: {
        type: 'array',
        items: { type: 'integer' },
        description: 'Numbers of the listed official videos about this story; empty if none.',
      },
      game: {
        type: 'string',
        description: 'Exact name from the existing games list, or empty.',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: '2 to 5 names copied from the existing tags list; empty if none fit.',
      },
    },
    required: ['title', 'excerpt', 'category', 'blocks', 'seo_description'],
  },
} as const

const clip = (s: unknown, n: number) => {
  const t = typeof s === 'string' ? s.trim() : ''
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t
}

/** Keep only well-formed blocks; throws if nothing usable is left. */
export function cleanDraft(
  answer: DraftAnswer,
  fallbackCategory: string | null | undefined,
): DraftAnswer {
  const blocks: Block[] = []
  for (const b of Array.isArray(answer?.blocks) ? answer.blocks : []) {
    if (!b || typeof b !== 'object') continue
    if (b.type === 'list') {
      const items = (Array.isArray(b.items) ? b.items : [])
        .map((i) => clip(i, 1000))
        .filter(Boolean)
      if (items.length) blocks.push({ type: 'list', items })
    } else if (b.type === 'paragraph' || b.type === 'heading' || b.type === 'quote') {
      const text = clip(b.text, b.type === 'heading' ? 120 : 4000)
      if (text) blocks.push({ type: b.type, text })
    }
  }
  const title = clip(answer?.title, 120)
  if (!title || !blocks.some((b) => b.type === 'paragraph'))
    throw new Error('draft without a title or a paragraph')
  const category = (CATEGORIES as readonly string[]).includes(answer.category)
    ? answer.category
    : (CATEGORIES as readonly string[]).includes(fallbackCategory ?? '')
      ? (fallbackCategory as Category)
      : 'news'
  const firstParagraph = blocks.find(
    (b): b is { type: 'paragraph'; text: string } => b.type === 'paragraph',
  )
  return {
    title,
    excerpt: clip(answer.excerpt, 300) || clip(firstParagraph?.text, 200),
    category,
    blocks,
    seo_description: clip(answer.seo_description, 160),
    videos: [
      ...new Set(
        (Array.isArray(answer?.videos) ? answer.videos : []).filter(
          (n) => Number.isInteger(n) && n > 0,
        ),
      ),
    ],
    game: typeof answer?.game === 'string' ? answer.game.trim() : '',
    tags: (Array.isArray(answer?.tags) ? answer.tags : [])
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter(Boolean),
  }
}

/** Plain text of the body, for Discord and for a revision prompt. */
export function blocksToText(blocks: Block[]): string {
  return blocks
    .map((b) =>
      b.type === 'list'
        ? b.items.map((i) => `• ${i}`).join('\n')
        : b.type === 'heading'
          ? `## ${b.text}`
          : b.text,
    )
    .join('\n\n')
}

// ─── Lexical (Payload's rich-text JSON) ──────────────────────────────────────

const text = (t: string) => ({
  type: 'text',
  text: t,
  format: 0,
  style: '',
  mode: 'normal',
  detail: 0,
  version: 1,
})
const element = (type: string, children: unknown[], extra: Record<string, unknown> = {}) => ({
  type,
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  ...extra,
})
const paragraph = (children: unknown[]) => element('paragraph', children, { textFormat: 0 })

/** The article body: the draft's blocks, then "Sources" with a link to each source. */
const linkItem = (label: string, linkText: string, url: string, i: number) =>
  element(
    'listitem',
    [
      text(label),
      element('link', [text(linkText)], {
        version: 3,
        fields: { linkType: 'custom', url, newTab: true },
      }),
    ],
    { value: i + 1 },
  )

export function toLexical(
  blocks: Block[],
  sources: Array<{ name: string; url: string; title: string }>,
  videos: VideoRef[] = [],
) {
  const children: unknown[] = blocks.map((b) => {
    switch (b.type) {
      case 'heading':
        return element('heading', [text(b.text)], { tag: 'h2' })
      case 'quote':
        return element('quote', [text(b.text)])
      case 'list':
        return element(
          'list',
          b.items.map((item, i) => element('listitem', [text(item)], { value: i + 1 })),
          { listType: 'bullet', start: 1, tag: 'ul' },
        )
      default:
        return paragraph([text(b.text)])
    }
  })
  if (videos.length) {
    children.push(element('heading', [text('Watch')], { tag: 'h2' }))
    children.push(
      element(
        'list',
        videos.map((v, i) => linkItem(v.channel ? `${v.channel}: ` : '', v.title, v.url, i)),
        { listType: 'bullet', start: 1, tag: 'ul' },
      ),
    )
  }
  if (sources.length) {
    children.push(element('heading', [text('Sources')], { tag: 'h2' }))
    children.push(
      element(
        'list',
        sources.map((s, i) => linkItem(`${s.name}: `, s.title, s.url, i)),
        { listType: 'bullet', start: 1, tag: 'ul' },
      ),
    )
  }
  return { root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children } }
}

/**
 * The ids of the tags the model picked, matched by name (case-insensitive)
 * against the existing ones. Unknown names are dropped (the model never
 * creates a tag), so are the game's own name and the category, and the list
 * stops at 5. Pure.
 */
export function matchTags(
  picked: string[] | undefined,
  existing: Array<{ id: number; name: string }>,
  exclude: Array<string | null | undefined> = [],
): number[] {
  const norm = (s: string) => s.trim().toLowerCase()
  const banned = new Set(exclude.filter((e): e is string => !!e).map(norm))
  const byName = new Map(existing.map((t) => [norm(t.name), t.id]))
  const ids: number[] = []
  for (const name of picked ?? []) {
    const id = byName.get(norm(name))
    if (id !== undefined && !banned.has(norm(name)) && !ids.includes(id)) ids.push(id)
    if (ids.length === 5) break
  }
  return ids
}

/**
 * The id of the game the model named (exact name, case-insensitive), else of
 * the game the triage noted on the story, else null. Pure.
 */
export function matchGame(
  picked: string | undefined,
  storyGame: string | null | undefined,
  existing: Array<{ id: number; name: string }>,
): number | null {
  const norm = (s: string) => s.trim().toLowerCase()
  for (const name of [picked, storyGame]) {
    if (!name?.trim()) continue
    const hit = existing.find((g) => norm(g.name) === norm(name))
    if (hit) return hit.id
  }
  return null
}
