// ─── Drafts (step 2) ─────────────────────────────────────────────────────────
// Writes an article for a story with Sonnet, stores it as a DRAFT in the CMS
// (never published here) and sends it to Discord with Publish / Edit / Reject.
// A revision rewrites the same article with the editor's feedback and posts
// the new version as a reply to the previous one.

import { callTool } from './anthropic'
import { checkBudget, recordUsage } from './budget'
import type { ItemDoc, ScoutContext, SettingsDoc, SourceDoc, StoryDoc } from './context'
import { draftMessage, sendBotMessage } from './discord-bot'
import {
  blocksToText,
  cleanDraft,
  DRAFT_SYSTEM,
  DRAFT_TOOL,
  draftPrompt,
  matchTags,
  toLexical,
  type DraftAnswer,
  type DraftSource,
} from './draft-prompt'
import { fetchPage, type PageRead } from './extract'
import { pickCover, uploadImage, videoCandidates, type Cover, type Video } from './media'
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
}

const RANK = { official: 0, high: 1, variable: 2 } as const

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

  const empty: PageRead = { text: '', image: null, videos: [] }
  const pages = await Promise.all(
    chosen.map(({ item }, i) =>
      read && i < PAGES_TO_READ && !ctx.config.dryRun
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
    videos: pages[i].videos,
  }))
}

/** Author of scout drafts: the one chosen in Scout settings, else the first, else a new "Akavish Newsroom". */
async function authorId(ctx: ScoutContext, settings: SettingsDoc): Promise<number> {
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

/** The site's tags, for the model to pick from (it never creates one). */
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
): Promise<DraftResult> {
  return draftStory(ctx, settings, storyId, undefined, { imageUrl, imageOnly: true })
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
  opts: { imageUrl?: string; imageOnly?: boolean } = {},
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
  if (opts.imageOnly) {
    if (!articleRef) throw new Error('no draft for this story')
    if (!opts.imageUrl) throw new Error('image: no URL')
    return imageOnly(ctx, story, storyId, Number(articleRef), opts.imageUrl)
  }
  const sources = await sourcesFor(ctx, storyId)
  if (sources.length === 0) throw new Error(`story ${storyId} has no items`)
  const videos: Video[] = ctx.config.dryRun ? [] : await videoCandidates(sources, ctx.fetch)
  const tagList = await existingTags(ctx)

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
  const tagIds = matchTags(clean.tags, tagList, [story.game, clean.category])

  // Cover: the editor's URL, else the one already set (a revision keeps it),
  // else an official source's image or the game's cover.
  let cover: Cover | null = null
  let imageError: string | undefined
  if (opts.imageUrl) {
    try {
      const up = await uploadImage(ctx, opts.imageUrl, clean.title)
      cover = { ...up, origin: 'URL donnée sur Discord' }
    } catch (err) {
      imageError = err instanceof Error ? err.message : String(err)
    }
  }
  if (!cover && articleRef) cover = await currentCover(ctx, Number(articleRef))
  if (!cover && !ctx.config.dryRun) {
    cover = await pickCover(ctx, { title: clean.title, game: story.game }, sources)
  }

  const data = {
    title: clean.title,
    excerpt: clean.excerpt,
    content,
    category: clean.category,
    seo: { title: clean.title, description: clean.seo_description },
    aiAssisted: true,
    ...(cover ? { coverImage: cover.id } : {}),
    // The model's pick from the existing tags; a revision picks again.
    ...(tagIds.length ? { tags: tagIds } : {}),
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
    tags: tagList.filter((t) => tagIds.includes(t.id)).map((t) => t.name),
    cover,
    imageError,
    feedback,
    storyUpdate: {
      lastDraftText: bodyText,
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
async function imageOnly(
  ctx: ScoutContext,
  story: StoryWithDraft,
  storyId: number,
  articleId: number,
  imageUrl: string,
): Promise<DraftResult> {
  const art = (await ctx.payload.findByID({
    collection: 'articles',
    id: articleId,
    depth: 0,
    draft: true,
    overrideAccess: true,
  })) as unknown as { title: string; excerpt?: string | null; category?: string | null }
  let cover: Cover | null = null
  let imageError: string | undefined
  try {
    const up = await uploadImage(ctx, imageUrl, art.title)
    cover = { ...up, origin: 'URL donnée sur Discord' }
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
    cover,
    imageError,
    imageChange: true,
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
        { score: { greater_than_equal: s.threshold ?? 60 } },
        { status: { in: ['new', 'listed'] } },
        { article: { exists: false } },
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
  const article = await ctx.payload.update({
    collection: 'articles',
    id: articleRef,
    data: { _status: 'published', status: 'published' },
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
    if ((art as unknown as { status?: string }).status !== 'published') {
      await ctx.payload.delete({ collection: 'articles', id: articleRef, overrideAccess: true })
    }
  }
}
