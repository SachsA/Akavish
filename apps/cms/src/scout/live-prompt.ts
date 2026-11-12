// ─── Event mode: prompt and page (pure) ──────────────────────────────────────
// What Sonnet reads at each live update, how its answer is checked and merged
// into the event's entries, and how the entries become the live article's
// rich text. No I/O here: unit-tested.

import {
  cleanNewGame,
  element,
  GAME_GENRES,
  GAME_PLATFORMS,
  paragraph,
  text,
  type DraftAnswer,
} from './draft-prompt'
import { CATEGORIES, type Category } from './triage-prompt'

export interface LiveLink {
  label: string
  url: string
}

export interface LiveEntry {
  id: string
  /** ISO time the entry was added. */
  at: string
  headline: string
  text: string
  links: LiveLink[]
  from: 'editor' | 'scout'
  /** The game's page on Akavish, when the entry is about one game. */
  game?: { id: number; name: string; slug?: string | null } | null
  /** Set when an entry was completed or corrected after it was added. */
  updatedAt?: string
}

/** What the model says about the game of a new or updated entry. */
export interface LiveGame {
  game?: string
  game_is_new?: boolean
  new_game?: DraftAnswer['new_game']
}

export interface LiveNote {
  id: string
  at: string
  text: string
  done: boolean
}

/** A scout item that arrived since the last update. */
export interface LiveItem {
  index: number
  source: string
  official: boolean
  title: string
  url: string
  summary: string
}

export interface LiveAnswer {
  title?: string
  category?: Category
  intro: string
  new_entries: Array<{ headline: string; text: string; links: LiveLink[] } & LiveGame>
  /** Existing entries completed or corrected: new headline/text replace, links are added. */
  update_entries: Array<
    { entry: string; headline?: string; text?: string; links: LiveLink[] } & LiveGame
  >
}

export const LIVE_SYSTEM = `You run the live page of Akavish, an English-language video game news site, during a showcase or event. The page is a list of short entries, newest first: one entry per announcement, with links. Readers skim it during the show.

Rules:
- One entry per announcement (a game revealed, a trailer, a release date, a winner, a price). Headline: "<Game>: <what>" in under 80 characters, sentence case. Text: one or two short sentences, under 220 characters, facts only: what was shown, the platforms and the date or window when the inputs give them. No hype words, no emoji.
- Use only facts in the editor's notes and the items given. Never guess a date, a platform or a price.
- The editor's notes are what they just saw in the stream: each one becomes an entry, unless it is the same announcement as an existing entry or as another input; then it completes that entry (update_entries) or is merged into one new entry. Never two entries for the same announcement.
- Keep entries complete: when a new note or item brings a missing fact about an existing entry (a release date, platforms, a price, the official post, the trailer), update that entry (update_entries) with a full new headline and text that keep every fact already there, plus the new links. A note naming an entry ("#3 …") is about that entry; a note correcting an entry wins over everything else.
- Items from the feeds: keep only announcements made at this event (official posts published during the show, outlets reporting what was just shown). Leave out unrelated news.
- Links: only URLs given in the input. Label them briefly: "Trailer", "PlayStation Blog", "Steam page", "Xbox Wire". YouTube trailers first.
- Game: for an entry about one game, give its full official title (copy it from the existing games list when it's there). When it isn't listed, set game_is_new and new_game with only what the inputs say (developer, publisher, platforms, genres). Hardware, a service, an award without a game: no game.
- intro: two or three sentences summing up the show so far (biggest announcements first). Refresh it each time.
- title (first update only): "<Event>: every announcement, live" or similar, under 80 characters.
- category: "conference" for a showcase, "esport" for a tournament.
- Nothing new worth adding: return no new_entries and no update_entries, and the intro unchanged.
Answer with the tool.`

export const LIVE_TOOL = {
  name: 'update_live',
  description: 'Record the live page update.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      category: { type: 'string', enum: [...CATEGORIES] },
      intro: { type: 'string' },
      new_entries: {
        type: 'array',
        description: 'New announcements, oldest first.',
        items: {
          type: 'object',
          properties: {
            headline: { type: 'string' },
            text: { type: 'string' },
            links: {
              type: 'array',
              items: {
                type: 'object',
                properties: { label: { type: 'string' }, url: { type: 'string' } },
                required: ['label', 'url'],
              },
            },

            game: { type: 'string', description: 'Full official title, or empty.' },
            game_is_new: { type: 'boolean' },
            new_game: {
              type: 'object',
              properties: {
                developer: { type: 'string' },
                publisher: { type: 'string' },
                platforms: { type: 'array', items: { type: 'string', enum: [...GAME_PLATFORMS] } },
                genres: { type: 'array', items: { type: 'string', enum: [...GAME_GENRES] } },
              },
            },
          },
          required: ['headline', 'text', 'links'],
        },
      },
      update_entries: {
        type: 'array',
        description: 'Existing entries completed or corrected (by id).',
        items: {
          type: 'object',
          properties: {
            entry: { type: 'string' },
            headline: { type: 'string' },
            text: { type: 'string' },
            links: {
              type: 'array',
              items: {
                type: 'object',
                properties: { label: { type: 'string' }, url: { type: 'string' } },
                required: ['label', 'url'],
              },
            },
            game: { type: 'string', description: 'Full official title, or empty.' },
            game_is_new: { type: 'boolean' },
            new_game: {
              type: 'object',
              properties: {
                developer: { type: 'string' },
                publisher: { type: 'string' },
                platforms: { type: 'array', items: { type: 'string', enum: [...GAME_PLATFORMS] } },
                genres: { type: 'array', items: { type: 'string', enum: [...GAME_GENRES] } },
              },
            },
          },
          required: ['entry', 'links'],
        },
      },
    },
    required: ['intro', 'new_entries', 'update_entries'],
  },
} as const

/** URLs found in a note (the editor's pasted links). Pure. */
export function urlsIn(textIn: string): string[] {
  return [...new Set(textIn.match(/https?:\/\/[^\s<>"')\]]+/g) ?? [])]
}

/** The user turn. `videoTitles` maps a YouTube URL found in a note to its title. Pure. */
export function livePrompt(args: {
  event: string
  intro?: string | null
  entries: LiveEntry[]
  notes: LiveNote[]
  items: LiveItem[]
  videoTitles?: Record<string, string>
  games?: string[]
  first: boolean
}): string {
  const entries = args.entries.length
    ? args.entries
        .map(
          (e) =>
            `${e.id} (#${e.id.slice(1)}): ${e.headline} | ${e.text}${e.game ? ` | game: ${e.game.name}` : ''} [${e.links.map((l) => l.url).join(' ')}]`,
        )
        .join('\n')
    : '(none yet)'
  const notes = args.notes.length
    ? args.notes
        .map((n) => {
          const vids = urlsIn(n.text)
            .filter((u) => args.videoTitles?.[u])
            .map((u) => `\n    (${u} is the YouTube video "${args.videoTitles![u]}")`)
            .join('')
          return `- ${n.text}${vids}`
        })
        .join('\n')
    : '(none)'
  const items = args.items.length
    ? args.items
        .map(
          (i) =>
            `[${i.index}] (${i.source}${i.official ? ', official' : ''}) ${i.title}\n    ${i.url}${i.summary ? `\n    ${i.summary.slice(0, 280)}` : ''}`,
        )
        .join('\n')
    : '(none)'
  return `Event: ${args.event}${args.first ? '\n(First update: also give title and category.)' : ''}

Current intro: ${args.intro || '(none yet)'}

Entries so far:
${entries}

The editor's new notes (what they just saw):
${notes}

New items from the feeds:
${items}

Existing games on Akavish: ${args.games?.length ? args.games.join(', ') : '(none)'}

Update the live page.`
}

const clip = (s: unknown, n: number) =>
  typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : ''

/**
 * Check the model's answer against the inputs: links only to URLs that were
 * given (a note's links, an item's URL), at most 4 per entry; add_links only
 * to existing entries and only new URLs; headlines and texts clipped. Pure.
 */
export function cleanLive(
  answer: Partial<LiveAnswer> | undefined,
  entries: LiveEntry[],
  allowedUrls: Set<string>,
): LiveAnswer {
  const links = (raw: unknown, already: Set<string> = new Set()): LiveLink[] => {
    const out: LiveLink[] = []
    for (const l of Array.isArray(raw) ? raw : []) {
      const url = typeof l?.url === 'string' ? l.url.trim() : ''
      if (!allowedUrls.has(url) || already.has(url) || out.some((o) => o.url === url)) continue
      out.push({ label: clip(l.label, 40) || 'Link', url })
      if (out.length + already.size >= 6 || out.length >= 4) break
    }
    return out
  }
  const ids = new Map(entries.map((e) => [e.id, new Set(e.links.map((l) => l.url))]))
  const game = (g: Partial<LiveGame> | undefined): LiveGame => {
    const name = clip(g?.game, 120)
    return name
      ? { game: name, game_is_new: g?.game_is_new === true, new_game: cleanNewGame(g?.new_game) }
      : {}
  }
  return {
    title: clip(answer?.title, 100) || undefined,
    category: (CATEGORIES as readonly string[]).includes(answer?.category ?? '')
      ? answer!.category
      : undefined,
    intro: clip(answer?.intro, 600),
    new_entries: (Array.isArray(answer?.new_entries) ? answer.new_entries : [])
      .map((e) => ({
        headline: clip(e?.headline, 100),
        text: clip(e?.text, 300),
        links: links(e?.links),
        ...game(e),
      }))
      .filter((e) => e.headline),
    update_entries: (Array.isArray(answer?.update_entries) ? answer.update_entries : [])
      .filter((u) => ids.has(String(u?.entry)))
      .map((u) => ({
        entry: String(u.entry),
        headline: clip(u.headline, 100) || undefined,
        text: clip(u.text, 300) || undefined,
        links: links(u.links, ids.get(String(u.entry))),
        ...game(u),
      }))
      .filter((u) => u.headline || u.text || u.links.length || u.game),
  }
}

/**
 * Apply a cleaned answer: updates rewrite an entry's headline and text and
 * add its links; new entries get ids e<n>. `games` maps a game named in the
 * answer to its page (already resolved or created by the caller). Pure.
 */
export function applyLive(
  entries: LiveEntry[],
  answer: LiveAnswer,
  at: string,
  fromEditor: boolean,
  games: Map<string, NonNullable<LiveEntry['game']>> = new Map(),
): { entries: LiveEntry[]; added: LiveEntry[]; updated: LiveEntry[]; changed: boolean } {
  let next = Math.max(0, ...entries.map((e) => Number(e.id.slice(1)) || 0))
  const updated: LiveEntry[] = []
  const out = entries.map((e) => {
    const ups = answer.update_entries.filter((u) => u.entry === e.id)
    if (!ups.length) return e
    let n: LiveEntry = { ...e }
    for (const u of ups) {
      n = {
        ...n,
        headline: u.headline || n.headline,
        text: u.text || n.text,
        links: [...n.links, ...u.links],
        game: (u.game && games.get(u.game.toLowerCase())) || n.game || null,
        updatedAt: at,
      }
    }
    updated.push(n)
    return n
  })
  const added: LiveEntry[] = answer.new_entries.map((e) => ({
    id: `e${++next}`,
    at,
    headline: e.headline,
    text: e.text,
    links: e.links,
    from: fromEditor ? 'editor' : 'scout',
    game: (e.game && games.get(e.game.toLowerCase())) || null,
  }))
  return {
    entries: [...out, ...added],
    added,
    updated,
    changed: added.length > 0 || updated.length > 0,
  }
}

/** "21:35" in Paris time. Pure. */
export function parisTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

const link = (label: string, url: string) =>
  element('link', [text(label)], { version: 3, fields: { linkType: 'custom', url, newTab: true } })

/**
 * The live article: intro, a status line, then the entries newest first
 * (time and headline as a heading, the short text, the links). Pure.
 */
export function liveLexical(args: {
  intro: string
  entries: LiveEntry[]
  updatedAt: string
  ended?: boolean
  recap?: { title: string; url: string } | null
  /** The site's origin, for links to game pages. */
  webUrl?: string
}) {
  const children: unknown[] = []
  if (args.intro) children.push(paragraph([text(args.intro)]))
  children.push(
    paragraph(
      args.ended
        ? args.recap
          ? [text('The show is over. Full recap: '), link(args.recap.title, args.recap.url)]
          : [text('The show is over. A full recap follows.')]
        : [
            text(
              `Live: updated every few minutes. Last update ${parisTime(args.updatedAt)} (Paris time).`,
            ),
          ],
    ),
  )
  for (const e of [...args.entries].reverse()) {
    children.push(element('heading', [text(`${parisTime(e.at)} · ${e.headline}`)], { tag: 'h3' }))
    if (e.text) children.push(paragraph([text(e.text)]))
    const all = [...e.links]
    if (e.game?.slug && args.webUrl) {
      all.push({ label: `${e.game.name} on Akavish`, url: `${args.webUrl}/game/${e.game.slug}` })
    }
    if (all.length) {
      const parts: unknown[] = []
      all.forEach((l, i) => {
        if (i) parts.push(text(' · '))
        parts.push(link(l.label, l.url))
      })
      children.push(paragraph(parts))
    }
  }
  return { root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children } }
}

export const RECAP_SYSTEM = `You write the recap article of an event for Akavish, an English-language video game news site, from the live page's entries. Tone: direct, factual, no hype words, no emoji.

- Use ONLY the facts in the entries. Never add a date, platform or price that isn't there.
- Open with one paragraph: what the event was and its biggest announcements.
- Then group the announcements under a few headings (for example "World premieres", "Release dates", "Trailers and updates", "Winners" for an awards show), as lists: "<Game>: <one line>".
- 300 to 600 words. Headline under 90 characters ("<Event>: every announcement" or the biggest news first). Excerpt under 200 characters. SEO description under 155.
- Do not add links or a sources list: the trailers are appended automatically.
Answer with the tool.`

/** The user turn for the recap: the entries, oldest first. Pure. */
export function recapPrompt(event: string, entries: LiveEntry[]): string {
  return `Event: ${event}\n\nEntries (oldest first):\n${entries
    .map((e) => `- ${e.headline}: ${e.text}`)
    .join('\n')}\n\nWrite the recap article.`
}

/** The YouTube links of the entries, for the recap's "Watch" list. Pure. */
export function recapVideos(
  entries: LiveEntry[],
): Array<{ title: string; channel: string; url: string }> {
  const out: Array<{ title: string; channel: string; url: string }> = []
  for (const e of entries)
    for (const l of e.links)
      if (/youtube\.com|youtu\.be/.test(l.url) && !out.some((o) => o.url === l.url))
        out.push({ title: `${e.headline.split(':')[0]}: ${l.label}`, channel: '', url: l.url })
  return out
}
