// ─── Triage prompt ───────────────────────────────────────────────────────────
// What the model reads to group new items into stories. Pure: builds the
// text and validates the answer, so both are unit-tested without an API call.

export const CATEGORIES = ['news', 'leak', 'review', 'preview', 'conference', 'esport'] as const
export type Category = (typeof CATEGORIES)[number]

export interface TriageItem {
  /** Position in the batch, used as the item's id in the prompt. */
  index: number
  title: string
  summary: string
  source: string
}

export interface OpenStory {
  id: number
  title: string
  game?: string | null
}

/** An article already on Akavish (published, scheduled or in draft). */
export interface CoveredArticle {
  id: number
  title: string
}

export interface NewStory {
  key: string
  title: string
  game: string | null
  category: Category
  significance: number
}

export interface TriageAnswer {
  new_stories: NewStory[]
  assignments: Array<{ item: number; story: string }>
}

export const TRIAGE_SYSTEM = `You triage incoming items for Akavish, an English-language video game news site covering news, leaks, reviews, previews, showcases and esport (Counter-Strike 2, League of Legends, Valorant, Rocket League, Rainbow Six Siege).

For each item, decide:
1. Is it games news a reader of Akavish would care about? Skip deals and sales, buying guides, "best of" lists, opinion columns, quizzes, sponsored posts, and anything not about games or the games industry.
2. If it is, which story does it belong to? A story is ONE piece of news (an announcement, a leak, a release date, a layoff, a tournament result). Several outlets reporting the same news = one story. Prefer an existing open story when the news matches; create a new story otherwise. Items in this batch can share a new story.

3. Is it already on Akavish? The prompt lists the site's recent articles (A<id>). An item reporting the same news as one of them (the same announcement, figure, record or release, even from another outlet or a day later) goes to "A<id>": it is already covered. Only a genuinely new development (a new figure, a new date, an official confirmation of a rumour, a result) makes a new story.

Before creating a new story, check the open stories carefully, including their game: the same news reported by another outlet, with other words, belongs to the existing story (S<id>). Creating a second story for the same news is the worst mistake here.

For each new story give: a short neutral English headline (no clickbait), the main game (or null), a category (news, leak, review, preview, conference, esport), and its significance from 0 to 100: how big this news is for gamers on its own, regardless of how many outlets carry it.
Significance guide: 90+ reveal or release date of a huge game (GTA, a new Zelda, a new console), major studio acquisition or closure; 70-89 notable announcement or credible leak about a big franchise, any news about a hugely anticipated game (GTA VI, The Elder Scrolls VI, Intergalactic, a new Zelda), the fate of a known game (cancelled or not, delayed), sales records and market data on big games (Sensor Tower, Circana), a star player's transfer or a major esport final; 60-75 an official update, patch or event from the publisher of a game Akavish follows closely (Counter-Strike 2, League of Legends, Valorant, Rocket League, Rainbow Six Siege, GTA VI); 60-75 the playoffs or final days of a big esport event (CS2 Major, BLAST, IEM, ESL Pro League, Worlds, MSI, VCT Masters or Champions, RLCS Major or Worlds, Six Invitational) when a top team is involved (an upset, an elimination, a title), a star player's or coach's statement or controversy, a roster change at a top team; 40-69 regular news about a known game (update, trailer, DLC, a review of a mid-size game); below 40 small patches of other games, small indie news, routine esport matches (group stages, minor leagues and regional cups, live match coverage).
Leaks and rumours are category "leak". Esport results, transfers and tournaments are "esport".`

/** The user turn: Akavish's articles, open stories, then the new items. */
export function triagePrompt(
  items: TriageItem[],
  open: OpenStory[],
  covered: CoveredArticle[] = [],
): string {
  const stories = open.length
    ? open.map((s) => `S${s.id}: ${s.title}${s.game ? ` [${s.game}]` : ''}`).join('\n')
    : '(none)'
  const articles = covered.length ? covered.map((a) => `A${a.id}: ${a.title}`).join('\n') : '(none)'
  const list = items
    .map(
      (i) =>
        `[${i.index}] (${i.source}) ${i.title}${i.summary ? `\n    ${i.summary.slice(0, 280)}` : ''}`,
    )
    .join('\n')
  return `Already on Akavish (last 3 weeks):\n${articles}\n\nOpen stories (last 3 days):\n${stories}\n\nNew items:\n${list}\n\nAssign every item: to an article it repeats ("A<id>"), to an open story ("S<id>"), to a new story you define ("N1", "N2"…), or "skip".`
}

export const TRIAGE_TOOL = {
  name: 'record_triage',
  description: 'Record the stories and where each new item goes.',
  input_schema: {
    type: 'object',
    properties: {
      new_stories: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'N1, N2…' },
            title: { type: 'string' },
            game: { type: ['string', 'null'] },
            category: { type: 'string', enum: [...CATEGORIES] },
            significance: { type: 'integer', minimum: 0, maximum: 100 },
          },
          required: ['key', 'title', 'game', 'category', 'significance'],
        },
      },
      assignments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            item: { type: 'integer' },
            story: { type: 'string', description: 'A<id>, S<id>, N<k> or skip' },
          },
          required: ['item', 'story'],
        },
      },
    },
    required: ['new_stories', 'assignments'],
  },
} as const

export type Decision =
  | { kind: 'existing'; storyId: number }
  | { kind: 'new'; story: NewStory }
  | { kind: 'covered'; articleId: number }
  | { kind: 'skip' }

/**
 * Turn the model's answer into one decision per item. Defensive: an item the
 * model forgot, a story id that isn't open, or a new-story key it never
 * defined all fall back to "skip" rather than crashing the run, so one odd
 * answer costs a few items, not the batch.
 */
export function decide(
  answer: TriageAnswer,
  items: TriageItem[],
  open: OpenStory[],
  covered: CoveredArticle[] = [],
): Map<number, Decision> {
  const openIds = new Set(open.map((s) => s.id))
  const articleIds = new Set(covered.map((a) => a.id))
  const newStories = new Map<string, NewStory>()
  for (const s of Array.isArray(answer?.new_stories) ? answer.new_stories : []) {
    if (!s || typeof s.key !== 'string' || typeof s.title !== 'string' || !s.title.trim()) continue
    newStories.set(s.key.trim().toUpperCase(), {
      key: s.key.trim().toUpperCase(),
      title: s.title.trim().slice(0, 200),
      game: typeof s.game === 'string' && s.game.trim() ? s.game.trim().slice(0, 100) : null,
      category: (CATEGORIES as readonly string[]).includes(s.category) ? s.category : 'news',
      significance: Math.max(0, Math.min(100, Math.round(Number(s.significance) || 0))),
    })
  }

  const byItem = new Map<number, string>()
  for (const a of Array.isArray(answer?.assignments) ? answer.assignments : []) {
    if (a && Number.isInteger(a.item) && typeof a.story === 'string')
      byItem.set(a.item, a.story.trim().toUpperCase())
  }

  const out = new Map<number, Decision>()
  for (const item of items) {
    const ref = byItem.get(item.index)
    const existing = ref?.match(/^S(\d+)$/)
    const article = ref?.match(/^A(\d+)$/)
    if (article && articleIds.has(Number(article[1]))) {
      out.set(item.index, { kind: 'covered', articleId: Number(article[1]) })
    } else if (existing && openIds.has(Number(existing[1]))) {
      out.set(item.index, { kind: 'existing', storyId: Number(existing[1]) })
    } else if (ref && newStories.has(ref)) {
      out.set(item.index, { kind: 'new', story: newStories.get(ref)! })
    } else {
      out.set(item.index, { kind: 'skip' })
    }
  }
  return out
}

/** Dry run (no API key, or SCOUT_DRY_RUN): every item its own story, middling significance. */
export function dryRunAnswer(items: TriageItem[]): TriageAnswer {
  return {
    new_stories: items.map((i) => ({
      key: `N${i.index}`,
      title: i.title,
      game: null,
      category: 'news',
      significance: 50,
    })),
    assignments: items.map((i) => ({ item: i.index, story: `N${i.index}` })),
  }
}
