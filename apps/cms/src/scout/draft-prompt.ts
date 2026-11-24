// ─── Drafting prompt ─────────────────────────────────────────────────────────
// What Sonnet reads to write an article, and how its answer becomes a CMS
// article (Lexical rich text + a Sources block). Pure, unit-tested.

import { CATEGORIES, type Category } from './triage-prompt'
import { parseReleaseDate, type PlatformRef, type Release } from '../lib/game-releases'
import { INITIAL_PLATFORMS } from '../lib/platforms'

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
  /** The game the story is about: an existing name, or a new official title. */
  game?: string
  /** `game` isn't in the list: create it with what the sources say (its game_facts entry). */
  game_is_new?: boolean
  /**
   * What the sources state about each game they date or place (release
   * dates and consoles, studios): the story's game, and every game of a
   * lineup or a showcase. Applied to the games library on Publish.
   */
  game_facts?: GameFactsEntry[]
  /** Consoles announced or dated (a PS6 reveal): created or dated on Publish. */
  consoles?: Array<{ name: string; release?: string }>
  /** Tags the site doesn't have yet (at most 2 kept). */
  new_tags?: string[]
  /** Esport: the photo the cover should be (a player for a transfer, a team with the trophy for a win). */
  photo_hint?: string
}

/** A draft answer once checked (cleanDraft): game facts parsed. */
export type CleanDraft = Omit<DraftAnswer, 'game_facts' | 'consoles'> & {
  game_facts: CleanGameFactsEntry[]
  consoles: ConsoleFact[]
}

/** A console the sources announce or date ("PlayStation 6", Q4 2027), checked. */
export interface ConsoleFact {
  name: string
  date: string | null
  precision: Release['precision']
}

/** Consoles in a draft or a live update: announced or dated hardware. */
export const CONSOLES_PROPERTY = {
  type: 'array',
  description:
    'Consoles (hardware: a new PlayStation, Xbox or Nintendo console, a handheld, a headset) the sources officially announce or date: each gets its own page on the site. "name": the full official name ("PlayStation 6"); "release": "YYYY-MM-DD", "YYYY-MM", "YYYY-Qn" ("holiday 2027" is 2027-Q4), "YYYY" or "TBA". Never from a rumour or a leak, never a family alone ("Xbox"). Empty when there is none.',
  items: {
    type: 'object',
    properties: { name: { type: 'string' }, release: { type: 'string' } },
    required: ['name'],
  },
} as const

/** consoles as the model gave them → checked (at most 5, unreadable dates as TBA). Pure. */
export function cleanConsoleFacts(raw: unknown): ConsoleFact[] {
  const out: ConsoleFact[] = []
  for (const e of Array.isArray(raw) ? raw : []) {
    const c = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>
    const name = typeof c.name === 'string' ? c.name.replace(/\s+/g, ' ').trim() : ''
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '')
    if (name.length < 2 || name.length > 40 || !key) continue
    if (out.some((x) => x.name.toLowerCase().replace(/[^a-z0-9]+/g, '') === key)) continue
    const when = parseReleaseDate(typeof c.release === 'string' ? c.release : '') ?? {
      date: null,
      precision: 'tba' as const,
    }
    out.push({ name, ...when })
    if (out.length >= 5) break
  }
  return out
}

/** What a story says about a game, in the model's words (dates as text). */
export interface GameFacts {
  developers?: string[]
  publishers?: string[]
  genres?: string[]
  releases?: Array<{ platforms?: string[]; date: string }>
}
export interface GameFactsEntry extends GameFacts {
  game: string
  is_new?: boolean
}
/**
 * The same, checked: dates parsed (lib/game-releases.ts), consoles as the
 * model named them (a slug or an official name), matched to the Platforms
 * collection when applied (game-facts.ts).
 */
export interface CleanGameFacts {
  developers: string[]
  publishers: string[]
  genres: string[]
  releases: Release[]
}
export interface CleanGameFactsEntry extends CleanGameFacts {
  game: string
  is_new: boolean
}

/** The `genre` options of the Games collection. */
export const GAME_GENRES = [
  'FPS',
  'RPG',
  'Action',
  'Strategy',
  'Sports',
  'MOBA',
  'Battle Royale',
  'MMO',
  'Simulation',
  'Other',
] as const

/** The tool schema of a game's facts (draft and live tools). */
export const GAME_FACTS_PROPERTIES = {
  releases: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description: `Consoles: the slug of a known one (${INITIAL_PLATFORMS.map((p) => `${p.slug} = ${p.name}`).join(', ')}); a console that isn't in this list (a new generation: "PlayStation 6"), its full official name, as the sources give it: it gets its own page. Never a family alone ("xbox" is the 2001 Xbox only). Empty when the sources don't say.`,
        },
        date: {
          type: 'string',
          description: '"YYYY-MM-DD", "YYYY-MM", "YYYY-Qn", "YYYY" or "TBA".',
        },
      },
      required: ['date'],
    },
  },
  developers: { type: 'array', items: { type: 'string' } },
  publishers: { type: 'array', items: { type: 'string' } },
  genres: { type: 'array', items: { type: 'string', enum: [...GAME_GENRES] } },
} as const

export const DRAFT_SYSTEM = `You write news articles for Akavish, an English-language video game news site. Tone: direct, factual, no fluff, no hype words ("insane", "epic"), no clickbait, no emoji. Readers are gamers who want the facts fast.

Hard rules:
- Use ONLY facts stated in the sources given. No number, date, name, platform, price or quote that isn't in them. If a detail matters but is missing, leave it out; never guess.
- Synthesise across the sources in your own words. Never follow one source's structure, never copy its sentences. Short direct quotes are allowed only for an official statement or a leaker's own words, in quotation marks and attributed ("…", Rockstar said).
- Leaks and rumours: say so in the headline or the first sentence ("Rumour:", "reportedly", "according to <leaker>"), name who claims it, and say what is unconfirmed. Never present a leak as fact.
- Attribute: "according to IGN", "Insider Gaming reports". When an official source confirms, say it is official.
- Category: "review" and "preview" are Akavish's own reviews and hands-on previews, written by its editor, never by you. A story about other outlets' reviews or previews (scores, Metacritic, a review embargo lifting, critics' verdicts) is "news".
- Length: 150 to 300 words for news and leaks; up to 450 for a recap of several announcements or esport results.
- Structure: first paragraph = the news itself (who, what, when). Then context and details. A heading only if the article is long enough to need one. No conclusion paragraph that repeats the intro, no "stay tuned".
- Lists of games with dates (release dates, a lineup, a schedule): each item starts with the game's name in bold, then " · ", then the short date, then the rest: "**Metro 2039** · Feb 4 (PS5, Xbox Series X|S, PC). 4A Games' new Metro…". Short dates: "Feb 4", "February" for a month alone, "Late 2027", "TBA". Never start an item with the date, never "February 4: Metro 2039".
- Headline: under 90 characters, says the news, sentence case.
- Excerpt: one or two sentences, under 200 characters, not a copy of the first paragraph.
- SEO description: under 155 characters.
- Write in English even when sources are in French or another language.
- Game: the ONE game the story is about, meaning the news concerns that game itself (its release, update, DLC, sales, trailer, review, cancellation). A game only cited as context is not the subject: a PS5 sales story that mentions GTA VI has no game. Hardware, a service, a company, a studio, an event or several games: leave it empty. When the game is in the existing games list, copy its exact name ("GTA 6" is "Grand Theft Auto VI"). When it isn't, give its full official title as the publisher writes it ("The Legend of Zelda: Ocarina of Time", not "Ocarina of Time remake") and set game_is_new.
- Game facts: Akavish keeps a library of game pages (consoles, release dates, studios). In game_facts, add one entry for every game whose release date or window, consoles, developer or publisher the sources state as official: the story's game, and each game of a lineup, a release schedule or a showcase. Only what the sources say, never what you remember. A rumour or a leak is not official: no game_facts from it. For each entry: "game" (exact name from the existing games list, or the full official title with is_new), "releases": one per group of consoles sharing a date, with the consoles as named ("Xbox" in a 2021+ story means xbox-series, "Switch 2" is switch-2, "PlayStation" alone for a new game means ps5; a console that isn't in the list, such as a new generation, by its full official name: it gets its own page, so never drop it) and the date as "YYYY-MM-DD", "YYYY-MM", "YYYY-Qn" ("holiday 2026" or "late 2026" is 2026-Q4), "YYYY" ("2027", "early 2027") or "TBA". A delay gives the new date. A release with no console named covers all of them. "developers" and "publishers": company names as written officially. "genres": from the list.
- Consoles: when the sources officially announce or date a console (a new PlayStation, Xbox or Nintendo hardware, a handheld, a headset), list it in consoles with its full official name and its release: it gets its own page on the site, and the games announced for it link to it.
- Tags: 2 to 5, in this order: (1) the company behind the news (publisher, studio or platform holder: Nintendo, Sony, Bandai Namco, Obsidian Entertainment…); (2) the platforms concerned (PS5, Xbox, PC, Switch 2), only when the story is about them; (3) the theme or event (Sales, Release dates, DLC, Studio closures, Earnings, Trailers, Worlds 2026…). Copy existing tags exactly when one fits. When a needed company or theme tag doesn't exist, put it in new_tags (at most 2, short, English, Title Case, the style of the existing ones). Never the game's name, never the category, never a person, never a vague word ("Gaming", "News").
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
        description:
          'The one game the story is about: exact name from the list, or its full official title if not listed; empty if none.',
      },
      game_is_new: { type: 'boolean', description: 'True when game is not in the list.' },
      game_facts: {
        type: 'array',
        description:
          'Official facts the sources state about each game they date or place (the story game and any other). Empty for a rumour or when nothing is stated.',
        items: {
          type: 'object',
          properties: {
            game: { type: 'string', description: 'Exact existing name, or full official title.' },
            is_new: { type: 'boolean', description: 'True when not in the existing games list.' },
            ...GAME_FACTS_PROPERTIES,
          },
          required: ['game'],
        },
      },
      consoles: CONSOLES_PROPERTY,
      new_tags: {
        type: 'array',
        items: { type: 'string' },
        description:
          'At most 2 tags the site lacks (company or theme); empty if the existing ones suffice.',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Existing tags that fit, exact names (with new_tags: 2 to 5 in all).',
      },
      photo_hint: {
        type: 'string',
        description:
          'Esport only, else empty. The photo the editor should find for the cover: a player or coach joining, leaving or benched → their name and team ("Darker (LOUD)"); a tournament won → "<team> lifting the <trophy or tournament> trophy"; anything else → empty.',
      },
    },
    required: ['title', 'excerpt', 'category', 'blocks', 'seo_description'],
  },
} as const

const clip = (s: unknown, n: number) => {
  const t = typeof s === 'string' ? s.trim() : ''
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t
}

/** Categories the scout never files under: the editor's own reviews and previews. */
const SCOUT_NEVER: readonly Category[] = ['review', 'preview']

/** Keep only well-formed blocks; throws if nothing usable is left. */
export function cleanDraft(
  answer: DraftAnswer,
  fallbackCategory: string | null | undefined,
): CleanDraft {
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
  const picked = (CATEGORIES as readonly string[]).includes(answer.category)
    ? answer.category
    : (CATEGORIES as readonly string[]).includes(fallbackCategory ?? '')
      ? (fallbackCategory as Category)
      : 'news'
  // Reviews and previews are the editor's own (with a score): the scout only
  // reports on other outlets' ones, which is news (GTA VI reviews, 2026-11-18).
  const category: Category = SCOUT_NEVER.includes(picked) ? 'news' : picked
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
    game: typeof answer?.game === 'string' ? answer.game.trim().slice(0, 120) : '',
    photo_hint:
      category === 'esport' && typeof answer?.photo_hint === 'string'
        ? answer.photo_hint.trim().slice(0, 120)
        : '',
    game_is_new: answer?.game_is_new === true,
    game_facts: cleanGameFactsList(answer?.game_facts),
    consoles: cleanConsoleFacts(answer?.consoles),
    new_tags: (Array.isArray(answer?.new_tags) ? answer.new_tags : [])
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter(Boolean),
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

export const text = (t: string) => ({
  type: 'text',
  text: t,
  format: 0,
  style: '',
  mode: 'normal',
  detail: 0,
  version: 1,
})
/**
 * A list item's text: a leading "**Name**" becomes bold (the game in a list
 * of release dates, "**Metro 2039** · Feb 4 …"), the rest stays plain.
 */
export function listItemChildren(item: string) {
  const m = item.match(/^\*\*(.+?)\*\*(.*)$/s)
  if (!m || !m[1].trim()) return [text(item)]
  return [{ ...text(m[1].trim()), format: 1 }, ...(m[2] ? [text(m[2])] : [])]
}

export const element = (
  type: string,
  children: unknown[],
  extra: Record<string, unknown> = {},
) => ({
  type,
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  ...extra,
})
export const paragraph = (children: unknown[]) => element('paragraph', children, { textFormat: 0 })

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
          b.items.map((item, i) => element('listitem', listItemChildren(item), { value: i + 1 })),
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
 * The id of the game the model named, matched on letters and digits only
 * ("The Outer Worlds 2" = "the outer worlds 2"), else null. `fallback` (the
 * triage's game) is only used when the model gave no answer at all (dry
 * run): an empty answer means "no game", and is respected. Pure.
 */
export function matchGame(
  picked: string | undefined,
  fallback: string | null | undefined,
  existing: Array<{ id: number; name: string }>,
): number | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
  for (const name of picked === undefined ? [fallback] : [picked]) {
    if (!name?.trim()) continue
    const hit = existing.find((g) => norm(g.name) === norm(name))
    if (hit) return hit.id
  }
  return null
}

/**
 * A game's facts, kept only when they fit the Games collection: known
 * consoles and genres, dates in one of the accepted forms (a release with an
 * unreadable date is dropped), company names trimmed. Pure.
 */
export function cleanGameFacts(raw: unknown): CleanGameFacts {
  const g = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const names = (v: unknown) => [
    ...new Set(
      (Array.isArray(v) ? v : [])
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.replace(/\s+/g, ' ').trim())
        .filter((x) => x.length >= 2 && x.length <= 80),
    ),
  ].slice(0, 4)
  const releases: Release[] = []
  for (const r of Array.isArray(g.releases) ? g.releases.slice(0, 8) : []) {
    const row = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>
    const when = parseReleaseDate(typeof row.date === 'string' ? row.date : '')
    if (!when) continue
    // Consoles as named: a slug ("ps5") or an official name ("PlayStation
    // 6"), matched or created when applied (game-facts.ts).
    const platforms: string[] = []
    for (const p of Array.isArray(row.platforms) ? row.platforms : []) {
      if (typeof p !== 'string') continue
      const name = p.replace(/\s+/g, ' ').trim()
      const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '')
      if (name.length < 2 || name.length > 40 || !key) continue
      if (platforms.some((x) => x.toLowerCase().replace(/[^a-z0-9]+/g, '') === key)) continue
      platforms.push(name)
    }
    releases.push({ platforms: platforms.slice(0, 10), ...when })
  }
  return {
    developers: names(g.developers),
    publishers: names(g.publishers),
    genres: [
      ...new Set(
        (Array.isArray(g.genres) ? g.genres : []).filter((x): x is (typeof GAME_GENRES)[number] =>
          GAME_GENRES.includes(x as (typeof GAME_GENRES)[number]),
        ),
      ),
    ],
    releases,
  }
}

/** game_facts as the model gave them → checked entries with something in them (at most 30). Pure. */
export function cleanGameFactsList(raw: unknown): CleanGameFactsEntry[] {
  const out: CleanGameFactsEntry[] = []
  const seen = new Set<string>()
  for (const e of Array.isArray(raw) ? raw : []) {
    const entry = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>
    const game = typeof entry.game === 'string' ? entry.game.replace(/\s+/g, ' ').trim().slice(0, 120) : ''
    const key = game.toLowerCase().replace(/[^a-z0-9]+/g, '')
    if (!key || seen.has(key)) continue
    const facts = cleanGameFacts(entry)
    if (!facts.releases.length && !facts.developers.length && !facts.publishers.length) continue
    seen.add(key)
    out.push({ game, is_new: entry.is_new === true, ...facts })
    if (out.length >= 30) break
  }
  return out
}


/** A console's name for Discord: a known slug's name, else what was given. */
const defaultLabel = (p: PlatformRef) =>
  INITIAL_PLATFORMS.find((x) => x.slug === p)?.name ?? String(p)

/** "PS5, Xbox Series X|S · Nov 19, 2026" for Discord. Pure. */
export function describeRelease(r: Release, label: (p: PlatformRef) => string = defaultLabel): string {
  const consoles = r.platforms.map(label).join(', ')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  let when = 'TBA'
  if (r.date) {
    const [y, m, d] = r.date.split('-').map(Number)
    when =
      r.precision === 'day'
        ? `${months[m - 1]} ${d}, ${y}`
        : r.precision === 'month'
          ? `${months[m - 1]} ${y}`
          : r.precision === 'quarter'
            ? `Q${Math.floor((m - 1) / 3) + 1} ${y}`
            : String(y)
  }
  return consoles ? `${consoles} · ${when}` : when
}


/** Names the model may not create: roster news goes under Transfers (Mercato). */
export const ROSTER_TAG_WORDS = [
  'roster',
  'rosters',
  'roster moves',
  'roster move',
  'roster changes',
  'roster change',
  'transfer',
  'transfers',
  'mercato',
  'player transfers',
]

/**
 * The tags to create for a draft: at most `room` (2 at most), each 2 to 30
 * characters, not already a tag (any case), not the game, the category or a
 * vague word. Pure.
 */
export function cleanNewTags(
  names: string[] | undefined,
  existing: Array<{ name: string }>,
  exclude: Array<string | null | undefined> = [],
  room = 2,
): string[] {
  const norm = (s: string) => s.trim().toLowerCase()
  const banned = new Set(
    [
      ...existing.map((t) => t.name),
      ...exclude.filter((e): e is string => !!e),
      ...CATEGORIES,
      'gaming',
      'news',
      'video games',
      'games',
      // Roster news has one tag, Transfers (FR Mercato), added from the story's
      // esport kind (draft.ts). "Roster Moves" was merged into it on 2026-11-24.
      ...ROSTER_TAG_WORDS,
    ].map(norm),
  )
  const out: string[] = []
  for (const raw of names ?? []) {
    const name = raw.replace(/\s+/g, ' ').trim()
    if (name.length < 2 || name.length > 30 || banned.has(norm(name))) continue
    if (out.some((o) => norm(o) === norm(name))) continue
    out.push(name)
    if (out.length >= Math.min(2, room)) break
  }
  return out
}
