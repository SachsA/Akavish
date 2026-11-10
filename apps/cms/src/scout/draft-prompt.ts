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
Do not add a sources list: it is appended automatically.`

/** The user turn: story, sources, and for a revision the previous version + feedback. */
export function draftPrompt(args: {
  storyTitle: string
  category?: string | null
  game?: string | null
  sources: DraftSource[]
  previous?: { title: string; body: string }
  feedback?: string
}): string {
  const sources = args.sources
    .map(
      (s, i) =>
        `--- Source ${i + 1}: ${s.name} (${s.reliability === 'official' ? 'official source' : s.reliability === 'variable' ? 'leaker / unverified' : 'established outlet'})\nTitle: ${s.title}\nURL: ${s.url}\n${s.text || '(no text available, title only)'}`,
    )
    .join('\n\n')
  let prompt = `Story: ${args.storyTitle}\nSuggested category: ${args.category ?? 'news'}${args.game ? `\nGame: ${args.game}` : ''}\n\n${sources}`
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
export function toLexical(
  blocks: Block[],
  sources: Array<{ name: string; url: string; title: string }>,
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
  if (sources.length) {
    children.push(element('heading', [text('Sources')], { tag: 'h2' }))
    children.push(
      element(
        'list',
        sources.map((s, i) =>
          element(
            'listitem',
            [
              text(`${s.name}: `),
              element('link', [text(s.title)], {
                version: 3,
                fields: { linkType: 'custom', url: s.url, newTab: true },
              }),
            ],
            { value: i + 1 },
          ),
        ),
        { listType: 'bullet', start: 1, tag: 'ul' },
      ),
    )
  }
  return { root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children } }
}
