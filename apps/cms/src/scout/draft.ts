// ─── Drafts (step 2) ─────────────────────────────────────────────────────────
// Writes an article for a story with Sonnet, stores it as a DRAFT in the CMS
// (never published here) and sends it to Discord with Publish / Edit / Reject.
// A revision rewrites the same article with the editor's feedback and posts
// the new version as a reply to the previous one.

import { callTool } from './anthropic'
import { thresholdFor } from './score'
import { checkBudget, recordUsage } from './budget'
import type { ItemDoc, ScoutContext, SettingsDoc, SourceDoc, StoryDoc } from './context'
import { draftMessage, sendBotMessage } from './discord-bot'
import {
  blocksToText,
  cleanDraft,
  DRAFT_SYSTEM,
  DRAFT_TOOL,
  draftPrompt,
  cleanNewTags,
  matchGame,
  matchTags,
  toLexical,
  type CleanGameFactsEntry,
  type ConsoleFact,
  type DraftAnswer,
  type DraftSource,
} from './draft-prompt'
import { duplicateReason } from './dedupe'
import { fetchPage, type PageRead } from './extract'
import { altKey } from './game-images'
import { pickCover, uploadImage, videoCandidates, type Cover, type Video } from './media'
import {
  applyConsoleFacts,
  applyGameFacts,
  createGame,
  dropOrphanCompanies,
  dropOrphanPlatforms,
  previewGameFacts,
} from './game-facts'
import { periodStarts } from './schedule'

const MAX_SOURCES = 6
const PAGES_TO_READ = 4
const AUTO_PER_RUN = 3

type StoryWithDraft = StoryDoc & {
  article?: number | { id: number } | null
  version?: number | null
  discordMessageId?: string | null
  feedback?: Array<{ text: string; version?: number }> | null
  lastDraftText?: string | null
  draftedAt?: string | null
  /** The draft's game facts, applied to the games library on Publish. */
  gameFacts?: CleanGameFactsEntry[] | null
  /** Consoles it announces or dates, created or dated on Publish. */
  consoleFacts?: ConsoleFact[] | null
}

const RANK = { official: 0, high: 1, variable: 2 } as const

/** The Mercato tag (slug `transfers`, French "Mercato"), created on first use. */
export async function transfersTagId(ctx: ScoutContext): Promise<number> {
  const { docs } = await ctx.payload.find({
    collection: 'tags',
    where: { slug: { equals: 'transfers' } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (docs[0]) return Number(docs[0].id)
  const created = await ctx.payload.create({
    collection: 'tags',
    data: { name: 'Transfers', nameFr: 'Mercato', slug: 'transfers' } as never,
    overrideAccess: true,
  })
  return Number(created.id)
}

/** The story's best sources: one item per outlet, official first, oldest first. */
async function sourcesFor(ctx: ScoutContext, storyId: number, read = true): Promise<DraftSource[]> {
  const { docs } = await ctx.payload.find({
    collection: 'scout-items',
    where: { story: { equals: storyId } },
    sort: 'publishedAt',
    limit: 50,
    depth: 1,
    overrideAccess: true,
  })
  const seen = new Set<number>()
  const picked: Array<{ item: ItemDoc; source: SourceDoc }> = []
  for (const item of docs as unknown as ItemDoc[]) {
    const source = item.source as SourceDoc
    if (typeof source !== 'object' || seen.has(source.id)) continue
    seen.add(source.id)
    picked.push({ item, source })
  }
  picked.sort((a, b) => RANK[a.source.reliability] - RANK[b.source.reliability])
  const chosen = picked.slice(0, MAX_SOURCES)

  const empty: PageRead = { text: '', image: null, imageAlt: null, videos: [] }
  const pages = await Promise.all(
    chosen.map(({ item }, i) =>
      // Our own pages (the esport recap's results page) aren't read: the
      // item's text is the source (src/esport/recap.ts).
      read && i < PAGES_TO_READ && !ctx.config.dryRun && !/^https:\/\/akavish\.gg\//.test(item.url)
        ? fetchPage(item.url, ctx.fetch)
        : Promise.resolve(empty),
    ),
  )
  return chosen.map(({ item, source }, i) => ({
    name: source.name,
    url: item.url,
    title: item.title,
    text: pages[i].text || item.summary || '',
    reliability: source.reliability,
    image: pages[i].image,
    imageAlt: pages[i].imageAlt,
    videos: pages[i].videos,
  }))
}

/** Author of scout drafts: the one chosen in Scout settings, else the first, else a new "Akavish Newsroom". */
export async function authorId(ctx: ScoutContext, settings: SettingsDoc): Promise<number> {
  const chosen = (settings as { defaultAuthor?: number | { id: number } | null }).defaultAuthor
  if (chosen) return typeof chosen === 'object' ? Number(chosen.id) : Number(chosen)
  const { docs } = await ctx.payload.find({
    collection: 'authors',
    limit: 1,
    sort: 'createdAt',
    depth: 0,
    overrideAccess: true,
  })
  if (docs[0]) return Number(docs[0].id)
  const created = await ctx.payload.create({
    collection: 'authors',
    // The slug hook fills `slug` from the name.
    data: { name: 'Akavish Newsroom' } as never,
    overrideAccess: true,
  })
  return Number(created.id)
}

export interface DraftResult {
  articleId: number
  version: number
  messageId?: string
}

/** The site's games, for the model to pick the story's one. */
export async function existingGames(
  ctx: ScoutContext,
): Promise<Array<{ id: number; name: string }>> {
  const { docs } = await ctx.payload.find({
    collection: 'games',
    pagination: false,
    sort: 'name',
    depth: 0,
    overrideAccess: true,
  })
  return (docs as unknown as Array<{ id: number; name: string }>).map((g) => ({
    id: Number(g.id),
    name: g.name,
  }))
}

/** The site's tags, for the model to pick from or add to. */
async function existingTags(ctx: ScoutContext): Promise<Array<{ id: number; name: string }>> {
  const { docs } = await ctx.payload.find({
    collection: 'tags',
    limit: 200,
    sort: 'name',
    depth: 0,
    overrideAccess: true,
  })
  return (docs as unknown as Array<{ id: number; name: string }>).map((t) => ({
    id: Number(t.id),
    name: t.name,
  }))
}

/** The article's current cover, as stored (id and URL). */
async function currentCover(ctx: ScoutContext, articleId: number): Promise<Cover | null> {
  const art = (await ctx.payload.findByID({
    collection: 'articles',
    id: articleId,
    depth: 1,
    draft: true,
    overrideAccess: true,
  })) as unknown as { coverImage?: { id: number; url?: string | null } | number | null }
  const c = art.coverImage
  if (!c) return null
  return typeof c === 'object'
    ? { id: Number(c.id), url: c.url, origin: 'image actuelle' }
    : { id: Number(c), origin: 'image actuelle' }
}

/**
 * Change only the cover of a story's draft, from an image URL the editor
 * pasted in Discord. No model call; the card is posted again with the image.
 */
export async function setStoryImage(
  ctx: ScoutContext,
  settings: SettingsDoc,
  storyId: number,
  imageUrl: string,
  imageCredit?: string,
): Promise<DraftResult> {
  return draftStory(ctx, settings, storyId, undefined, { imageUrl, imageCredit, imageOnly: true })
}

/**
 * "Autre image" on Discord: the next cover in pickCover's order, without the
 * current one (nor the game's recent covers). No model call for the text.
 */
export async function nextStoryImage(
  ctx: ScoutContext,
  settings: SettingsDoc,
  storyId: number,
): Promise<DraftResult> {
  return draftStory(ctx, settings, storyId, undefined, { nextImage: true })
}

/** The next cover for a draft: its sources and game again, minus the current cover. */
async function nextCover(
  ctx: ScoutContext,
  settings: SettingsDoc,
  storyId: number,
  art: ArticleForImage,
): Promise<Cover> {
  const sources = await sourcesFor(ctx, storyId)
  const videos = ctx.config.dryRun ? [] : await videoCandidates(sources, ctx.fetch)
  const current = art.coverImage
  const exclude = { ids: new Set<number>(), alts: new Set<string>() }
  if (current && typeof current === 'object') {
    exclude.ids.add(Number(current.id))
    if (current.alt) exclude.alts.add(altKey(current.alt))
  } else if (current != null) exclude.ids.add(Number(current))
  const game = art.game && typeof art.game === 'object' ? art.game.name : undefined
  const cover = await pickCover(ctx, { title: art.title, game }, sources, videos, {
    settings,
    exclude,
  })
  if (!cover) throw new Error('Pas d’autre image trouvée : l’image reste la même.')
  return cover
}

/**
 * Draft (or, with feedback, revise) the article for a story. Throws when the
 * budget is spent or the model's answer is unusable; the caller reports it.
 */
export async function draftStory(
  ctx: ScoutContext,
  settings: SettingsDoc,
  storyId: number,
  feedback?: string,
  opts: { imageUrl?: string; imageCredit?: string; imageOnly?: boolean; nextImage?: boolean } = {},
): Promise<DraftResult> {
  const story = (await ctx.payload.findByID({
    collection: 'scout-stories',
    id: storyId,
    depth: 0,
    overrideAccess: true,
  })) as unknown as StoryWithDraft
  const articleRef = story.article
    ? typeof story.article === 'object'
      ? story.article.id
      : story.article
    : null
  if (opts.nextImage) {
    if (!articleRef) throw new Error('no draft for this story')
    return imageOnly(ctx, story, storyId, Number(articleRef), (art) =>
      nextCover(ctx, settings, storyId, art),
    )
  }
  if (opts.imageOnly) {
    if (!articleRef) throw new Error('no draft for this story')
    const url = opts.imageUrl
    if (!url) throw new Error('image: no URL')
    return imageOnly(ctx, story, storyId, Number(articleRef), async (art) => {
      try {
        const up = await uploadImage(ctx, url, art.title, opts.imageCredit)
        return { ...up, origin: 'URL donnée sur Discord' }
      } catch (err) {
        throw new Error(
          `L’URL donnée n’a pas marché (${err instanceof Error ? err.message : String(err)}).`,
        )
      }
    })
  }
  const sources = await sourcesFor(ctx, storyId)
  if (sources.length === 0) throw new Error(`story ${storyId} has no items`)
  const videos: Video[] = ctx.config.dryRun ? [] : await videoCandidates(sources, ctx.fetch)
  const tagList = await existingTags(ctx)
  const gameList = await existingGames(ctx)

  // The previous version, for a revision: as stored by the last draft (any
  // edit made in /admin since then isn't seen, the feedback is about V(n)).
  let previous: { title: string; body: string } | undefined
  if (feedback && articleRef) {
    const art = (await ctx.payload.findByID({
      collection: 'articles',
      id: articleRef,
      depth: 0,
      draft: true,
      overrideAccess: true,
    })) as unknown as { title: string }
    previous = { title: art.title, body: story.lastDraftText ?? '' }
  }

  let draft: DraftAnswer
  if (ctx.config.dryRun) {
    // No API key: a placeholder built from the sources, so the whole flow
    // (CMS draft, Discord message, buttons) can be tried for free.
    draft = {
      title: story.title,
      excerpt: sources[0].title,
      category: (story.category as DraftAnswer['category']) ?? 'news',
      blocks: [
        {
          type: 'paragraph',
          text: `[Dry run: no AI call] ${sources.map((s) => s.title).join(' / ')}`,
        },
        ...(feedback
          ? [{ type: 'paragraph' as const, text: `Feedback received: ${feedback}` }]
          : []),
      ],
      seo_description: sources[0].title,
    }
  } else {
    const budget = await checkBudget(ctx, settings)
    if (!budget.ok) throw new Error(`budget: ${budget.reason}`)
    const result = await callTool<DraftAnswer>({
      apiKey: ctx.config.anthropicKey!,
      model: ctx.config.draftModel,
      system: DRAFT_SYSTEM,
      prompt: draftPrompt({
        storyTitle: story.title,
        category: story.category,
        game: story.game,
        sources,
        previous,
        feedback,
        videos,
        tags: tagList.map((t) => t.name),
        games: gameList.map((g) => g.name),
      }),
      tool: DRAFT_TOOL as unknown as Parameters<typeof callTool>[0]['tool'],
      maxTokens: 4000,
      fetchImpl: ctx.fetch,
    })
    await recordUsage(ctx, {
      purpose: feedback ? 'revision' : 'draft',
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    })
    draft = result.input
  }

  const clean = cleanDraft(draft, story.category)
  const watch = (clean.videos ?? []).map((n) => videos[n - 1]).filter(Boolean)
  const content = toLexical(clean.blocks, sources, watch)
  // Game: the model's pick from Games, or a new one it named (created here,
  // with only what the sources say). Tags: its picks from the existing ones,
  // plus at most 2 it asked to create. Nothing is invented in a dry run.
  let gameId = matchGame(ctx.config.dryRun ? undefined : clean.game, story.game, gameList)
  let gameName = gameList.find((g) => g.id === gameId)?.name
  let newGameId: number | null = null
  const sameGame = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '') ===
    clean.game?.toLowerCase().replace(/[^a-z0-9]+/g, '')
  let gameFacts = clean.game_facts
  if (!gameId && clean.game && clean.game_is_new && !ctx.config.dryRun) {
    // The article links its game: a new one is created now, with what the
    // sources say about it (deleted again if the draft is rejected).
    newGameId = gameId = await createGame(
      ctx,
      clean.game,
      gameFacts.find((f) => sameGame(f.game)),
    )
    gameName = clean.game
    gameFacts = gameFacts.filter((f) => !sameGame(f.game))
  }
  const tagIds = matchTags(clean.tags, tagList, [story.game, gameName, clean.category])
  // A transfer goes to the Esport > Transfers page (Mercato) through its tag.
  if ((story as { esportKind?: string | null }).esportKind === 'transfer' && !ctx.config.dryRun) {
    const id = await transfersTagId(ctx)
    if (!tagIds.includes(id)) tagIds.push(id)
  }
  const tagNames = tagList.filter((t) => tagIds.includes(t.id)).map((t) => t.name)
  if (tagIds.length > tagNames.length && !tagNames.includes('Transfers')) tagNames.push('Transfers')
  if (!ctx.config.dryRun) {
    for (const name of cleanNewTags(
      clean.new_tags,
      tagList,
      [gameName, story.game],
      5 - tagIds.length,
    )) {
      const created = await ctx.payload.create({
        collection: 'tags',
        data: { name } as never,
        overrideAccess: true,
      })
      tagIds.push(Number(created.id))
      tagNames.push(name)
    }
  }

  // Cover: the editor's URL, else the one already set (a revision keeps it),
  // else an official source's image or the game's cover.
  let cover: Cover | null = null
  let imageError: string | undefined
  if (opts.imageUrl) {
    try {
      const up = await uploadImage(ctx, opts.imageUrl, clean.title, opts.imageCredit)
      cover = { ...up, origin: 'URL donnée sur Discord' }
    } catch (err) {
      imageError = `L’URL donnée n’a pas marché (${err instanceof Error ? err.message : String(err)}).`
    }
  }
  if (!cover && articleRef) cover = await currentCover(ctx, Number(articleRef))
  if (!cover && !ctx.config.dryRun) {
    cover = await pickCover(
      ctx,
      { title: clean.title, game: gameName ?? story.game },
      sources,
      watch,
      { settings },
    )
  }
  // A game created just now takes the official image as its own cover.
  if (newGameId && cover && cover.origin.startsWith('visuel officiel')) {
    await ctx.payload.update({
      collection: 'games',
      id: newGameId,
      data: { cover: cover.id } as never,
      overrideAccess: true,
    })
  }

  const data = {
    title: clean.title,
    excerpt: clean.excerpt,
    content,
    category: clean.category,
    seo: { title: clean.title, description: clean.seo_description },
    aiAssisted: true,
    ...(cover ? { coverImage: cover.id } : {}),
    // Set every time, so a revision can also correct them.
    tags: tagIds,
    game: gameId ?? null,
    // Anti-spoil: a result, a final or a qualification (and the morning recap,
    // kind "result") is blurred in lists for readers hiding scores. Only ever
    // ticked here.
    ...(['result', 'final', 'qualification'].includes(
      String((story as { esportKind?: string | null }).esportKind),
    )
      ? { spoiler: true }
      : {}),
  }

  let articleId: number
  if (articleRef) {
    await ctx.payload.update({
      collection: 'articles',
      id: articleRef,
      data: data as never,
      draft: true,
      overrideAccess: true,
    })
    articleId = Number(articleRef)
  } else {
    const created = await ctx.payload.create({
      collection: 'articles',
      data: {
        ...data,
        status: 'draft',
        _status: 'draft',
        author: await authorId(ctx, settings),
      } as never,
      draft: true,
      overrideAccess: true,
    })
    articleId = Number(created.id)
  }

  const bodyText = blocksToText(clean.blocks)
  return postCard(ctx, story, storyId, articleId, {
    title: clean.title,
    excerpt: clean.excerpt,
    body: bodyText,
    category: clean.category,
    sources: sources.map((s) => ({ name: s.name, url: s.url })),
    videos: watch,
    tags: tagNames,
    game: gameName ? `${gameName}${newGameId ? ' (fiche créée)' : ''}` : undefined,
    photoHint: clean.photo_hint || undefined,
    gameFacts: ctx.config.dryRun
      ? []
      : [
          ...(await applyConsoleFacts(ctx, clean.consoles, false)),
          ...(await previewGameFacts(ctx, gameFacts)),
        ],
    cover,
    imageError,
    feedback,
    storyUpdate: {
      lastDraftText: bodyText,
      gameFacts,
      consoleFacts: clean.consoles,
      ...(feedback
        ? {
            feedback: [
              ...(story.feedback ?? []),
              { text: feedback, version: (story.version ?? 0) + 1 },
            ],
          }
        : {}),
    },
  })
}

/** New cover only: upload, set it on the draft, post the card again. */
type ArticleForImage = {
  title: string
  excerpt?: string | null
  category?: string | null
  coverImage?: { id: number; alt?: string | null } | number | null
  game?: { name: string } | number | null
}

/** Change only the draft's cover (an URL from Discord, or "Autre image"), then post the card again. */
async function imageOnly(
  ctx: ScoutContext,
  story: StoryWithDraft,
  storyId: number,
  articleId: number,
  getCover: (art: ArticleForImage) => Promise<Cover>,
): Promise<DraftResult> {
  const art = (await ctx.payload.findByID({
    collection: 'articles',
    id: articleId,
    depth: 1,
    draft: true,
    overrideAccess: true,
  })) as unknown as ArticleForImage
  let cover: Cover | null = null
  let imageError: string | undefined
  try {
    cover = await getCover(art)
    await ctx.payload.update({
      collection: 'articles',
      id: articleId,
      data: { coverImage: cover.id } as never,
      draft: true,
      overrideAccess: true,
    })
  } catch (err) {
    imageError = err instanceof Error ? err.message : String(err)
    cover = await currentCover(ctx, articleId)
  }
  return postCard(ctx, story, storyId, articleId, {
    title: art.title,
    excerpt: art.excerpt ?? '',
    body: story.lastDraftText ?? '',
    category: art.category ?? story.category ?? 'news',
    sources: (await sourcesFor(ctx, storyId, false)).map((s) => ({ name: s.name, url: s.url })),
    videos: [],
    gameFacts: [
      ...(await applyConsoleFacts(ctx, story.consoleFacts ?? [], false)),
      ...(await previewGameFacts(ctx, story.gameFacts ?? [])),
    ],
    cover,
    imageError,
    imageChange: !imageError,
    storyUpdate: {},
  })
}

/** Post the draft's card on Discord (as a reply to the last one) and update the story. */
async function postCard(
  ctx: ScoutContext,
  story: StoryWithDraft,
  storyId: number,
  articleId: number,
  c: {
    title: string
    excerpt: string
    body: string
    category: string
    sources: Array<{ name: string; url: string }>
    videos: Video[]
    tags?: string[]
    game?: string
    photoHint?: string
    gameFacts?: string[]
    cover: Cover | null
    imageError?: string
    imageChange?: boolean
    feedback?: string
    storyUpdate: Record<string, unknown>
  },
): Promise<DraftResult> {
  const version = (story.version ?? 0) + 1
  const storyUpdate: Record<string, unknown> = {
    article: articleId,
    status: 'drafted',
    version,
    ...(story.draftedAt ? {} : { draftedAt: ctx.now.toISOString() }),
    ...c.storyUpdate,
  }

  const adminUrl = `${ctx.config.serverUrl}/admin/collections/articles/${articleId}`
  const absolute = (u?: string | null) =>
    !u ? undefined : u.startsWith('http') ? u : `${ctx.config.serverUrl}${u}`
  let messageId: string | undefined
  const card = {
    storyId,
    articleId,
    version,
    score: story.score,
    title: c.title,
    excerpt: c.excerpt,
    body: c.body,
    category: c.category,
    sources: c.sources,
    adminUrl,
    feedback: c.feedback,
    image: c.cover ? { url: absolute(c.cover.url), origin: c.cover.origin } : null,
    imageError: c.imageError,
    imageChange: c.imageChange,
    videos: c.videos.map((v) => ({ title: v.title, channel: v.channel, url: v.url })),
    tags: c.tags,
    game: c.game,
    photoHint: c.photoHint,
    gameFacts: c.gameFacts,
  }
  if (ctx.config.bot && !ctx.config.dryRun) {
    messageId = await sendBotMessage(
      ctx.config.bot,
      { ...draftMessage(card), replyTo: story.discordMessageId ?? undefined },
      ctx.fetch,
    )
    storyUpdate.discordMessageId = messageId
  } else {
    // No bot yet: the webhook still says a draft is waiting, with the admin link.
    const msg = draftMessage(card)
    await ctx.notify({ content: msg.content, embeds: msg.embeds as never })
  }

  await ctx.payload.update({
    collection: 'scout-stories',
    id: storyId,
    data: storyUpdate,
    overrideAccess: true,
  })
  return { articleId, version, messageId }
}

/** Step 2's automatic part: draft the best new stories at or above the threshold. */
export async function autoDraft(ctx: ScoutContext, settings: SettingsDoc): Promise<number> {
  const s = settings as SettingsDoc & {
    draftsEnabled?: boolean | null
    maxDraftsPerDay?: number | null
  }
  if (!s.draftsEnabled) return 0

  const { day } = periodStarts(ctx.now)
  const { totalDocs: today } = await ctx.payload.count({
    collection: 'scout-stories',
    where: { draftedAt: { greater_than_equal: day.toISOString() } },
    overrideAccess: true,
  })
  const room = Math.min(AUTO_PER_RUN, Math.max(0, (s.maxDraftsPerDay ?? 20) - today))
  if (room === 0) return 0

  const { docs } = await ctx.payload.find({
    collection: 'scout-stories',
    where: {
      and: [
        // Esport from 10 points lower (score.ts, thresholdFor).
        {
          or: [
            { score: { greater_than_equal: s.threshold ?? 60 } },
            {
              and: [
                { category: { equals: 'esport' } },
                { score: { greater_than_equal: thresholdFor('esport', s.threshold ?? 60) } },
              ],
            },
          ],
        },
        { status: { in: ['new', 'listed'] } },
        { article: { exists: false } },
        // A plain match result is the morning recap's job (src/esport/recap.ts).
        // (Null for every non-esport story: `not_equals` alone would drop them.)
        { or: [{ esportKind: { exists: false } }, { esportKind: { not_equals: 'result' } }] },
        // Stale stories don't get a draft just because the switch was turned on.
        {
          lastItemAt: { greater_than: new Date(ctx.now.getTime() - 24 * 3_600_000).toISOString() },
        },
      ],
    },
    sort: '-score',
    limit: room,
    depth: 0,
    overrideAccess: true,
  })

  let drafted = 0
  for (const story of docs as unknown as StoryDoc[]) {
    try {
      // Already covered (an article, or a story the editor rejected)? Set it
      // aside with the reason instead of drafting it again (dedupe.ts).
      const dup = await duplicateReason(ctx, settings, { id: Number(story.id), title: story.title })
      if (dup) {
        await ctx.payload.update({
          collection: 'scout-stories',
          id: story.id,
          data: { status: 'rejected', rejectionReason: dup.slice(0, 500) },
          overrideAccess: true,
        })
        ctx.payload.logger.info({ msg: '[scout] duplicate skipped', story: story.id, reason: dup })
        continue
      }
      await draftStory(ctx, settings, Number(story.id))
      drafted++
    } catch (err) {
      ctx.payload.logger.error({
        msg: '[scout] draft failed',
        story: story.id,
        error: err instanceof Error ? err.message : String(err),
      })
      if (err instanceof Error && err.message.startsWith('budget:')) break
    }
  }
  return drafted
}

export const NO_COVER = 'no cover image'

/** Publish a story's draft now (never without a cover). Returns the public URL. */
export async function publishStory(ctx: ScoutContext, storyId: number): Promise<string> {
  const story = (await ctx.payload.findByID({
    collection: 'scout-stories',
    id: storyId,
    depth: 0,
    overrideAccess: true,
  })) as unknown as StoryWithDraft
  const articleRef = story.article
    ? typeof story.article === 'object'
      ? story.article.id
      : story.article
    : null
  if (!articleRef) throw new Error('no draft for this story')
  if (!(await currentCover(ctx, Number(articleRef)))) throw new Error(NO_COVER)
  // What the story says about games goes into the library now that the
  // editor validated it; the games it dates are listed as "Also covers".
  // Consoles first, so a game dated on a new console links to it.
  await applyConsoleFacts(ctx, story.consoleFacts ?? [], true)
  const facts = await applyGameFacts(ctx, story.gameFacts ?? [])
  const before = (await ctx.payload.findByID({
    collection: 'articles',
    id: articleRef,
    depth: 0,
    draft: true,
    overrideAccess: true,
  })) as unknown as { game?: unknown; relatedGames?: unknown[] | null }
  const idOf = (v: unknown) => Number(v && typeof v === 'object' ? (v as { id: unknown }).id : v)
  const main = before.game ? idOf(before.game) : null
  const related = [...new Set([...(before.relatedGames ?? []).map(idOf), ...facts.ids])].filter(
    (id) => id !== main,
  )
  const article = await ctx.payload.update({
    collection: 'articles',
    id: articleRef,
    data: {
      _status: 'published',
      status: 'published',
      relatedGames: related.slice(0, 12),
    } as never,
    overrideAccess: true,
  })
  await ctx.payload.update({
    collection: 'scout-stories',
    id: storyId,
    data: { status: 'published' },
    overrideAccess: true,
  })
  return `${ctx.config.webUrl}/article/${(article as unknown as { slug: string }).slug}`
}

/** Reject: delete the draft article, keep the story (and the reason) for learning. */
export async function rejectStory(
  ctx: ScoutContext,
  storyId: number,
  reason: string,
): Promise<void> {
  const story = (await ctx.payload.findByID({
    collection: 'scout-stories',
    id: storyId,
    depth: 0,
    overrideAccess: true,
  })) as unknown as StoryWithDraft
  const articleRef = story.article
    ? typeof story.article === 'object'
      ? story.article.id
      : story.article
    : null
  await ctx.payload.update({
    collection: 'scout-stories',
    id: storyId,
    data: { status: 'rejected', rejectionReason: reason.slice(0, 500) || null, article: null },
    overrideAccess: true,
  })
  if (articleRef) {
    const art = await ctx.payload.findByID({
      collection: 'articles',
      id: articleRef,
      depth: 0,
      draft: true,
      overrideAccess: true,
    })
    // Only ever delete what is still a draft: a published article stays.
    const a = art as unknown as {
      status?: string
      tags?: Array<number | { id: number }> | null
      game?: number | { id: number } | null
    }
    if (a.status !== 'published') {
      await ctx.payload.delete({ collection: 'articles', id: articleRef, overrideAccess: true })
      const id = (v: number | { id: number }) => (typeof v === 'object' ? v.id : v)
      await dropOrphans(ctx, 'tags', (a.tags ?? []).map(id), 'tags', story.draftedAt)
      if (a.game && story.draftedAt) {
        // The game's companies, created with it, go with it.
        const g = (await ctx.payload
          .findByID({ collection: 'games', id: id(a.game), depth: 0, overrideAccess: true })
          .catch(() => null)) as {
          developers?: unknown[]
          publishers?: unknown[]
          platforms?: unknown[]
        } | null
        const companies = [...(g?.developers ?? []), ...(g?.publishers ?? [])].map((c) =>
          id(c as number | { id: number }),
        )
        const consoles = (g?.platforms ?? []).map((c) => id(c as number | { id: number }))
        await dropOrphans(ctx, 'games', [id(a.game)], 'game', story.draftedAt)
        await dropOrphanCompanies(ctx, companies, story.draftedAt)
        // And the consoles created with it (a PS6 named by a rejected draft).
        await dropOrphanPlatforms(ctx, consoles, story.draftedAt)
      }
    }
  }
}

/**
 * After a rejected draft is deleted: remove the tags or game the scout
 * created for it (created since the story's first draft) that no other
 * article uses, so a rejection leaves nothing behind.
 */
async function dropOrphans(
  ctx: ScoutContext,
  collection: 'tags' | 'games',
  ids: number[],
  field: 'tags' | 'game',
  since?: string | null,
): Promise<void> {
  if (!since) return
  for (const docId of ids) {
    const doc = (await ctx.payload
      .findByID({ collection, id: docId, depth: 0, overrideAccess: true })
      .catch(() => null)) as { createdAt?: string } | null
    if (!doc?.createdAt || doc.createdAt < since) continue
    const { totalDocs } = await ctx.payload.count({
      collection: 'articles',
      where: { [field]: field === 'tags' ? { in: [docId] } : { equals: docId } },
      overrideAccess: true,
    })
    if (totalDocs === 0) await ctx.payload.delete({ collection, id: docId, overrideAccess: true })
  }
}
