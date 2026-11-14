// ─── Triage ──────────────────────────────────────────────────────────────────
// Groups the new items into stories with the fast model (Haiku), then
// recomputes the score of every story that changed. One batch per run; what
// doesn't fit waits for the next run, 5 minutes later.

import { callTool } from './anthropic'
import { checkBudget, recordUsage } from './budget'
import {
  type ItemDoc,
  type ScoutContext,
  type SettingsDoc,
  type SourceDoc,
  type StoryDoc,
} from './context'
import { bestOf, storyScore, thresholdFor, type SourceRef } from './score'
import {
  decide,
  dryRunAnswer,
  TRIAGE_SYSTEM,
  TRIAGE_TOOL,
  triagePrompt,
  type CoveredArticle,
  type OpenStory,
  type TriageAnswer,
  type TriageItem,
} from './triage-prompt'

const BATCH = 40
const OPEN_WINDOW_MS = 72 * 3_600_000
// Open stories shown to the model: every story that matters over 3 days (a
// score of 35+, or drafted / published / rejected by the editor), plus the
// latest ones whatever their score. 80 by recency alone covered only the
// last few hours (300 stories a day), so the same news reported the next
// morning became a second story (Nov 11-12: PS5 100M, Marvel 1943, GTA VI
// pre-orders).
const MAX_IMPORTANT = 250
const MAX_RECENT = 80
const COVERED_DAYS = 21
const MAX_COVERED = 120

export interface TriageReport {
  items: number
  newStories: number
  joined: number
  skipped: number
  /** Items repeating an article already on Akavish. */
  covered: number
  skippedReason?: string
}

/**
 * Recompute a story's sources, best reliability and score from its items. A
 * story already listed in a digest below the threshold goes back to "new" when
 * it crosses it (a rumour others picked up), so the next digest shows it again.
 */
export async function rescore(
  ctx: ScoutContext,
  storyId: number,
  threshold: number,
): Promise<void> {
  const [{ docs }, story] = await Promise.all([
    ctx.payload.find({
      collection: 'scout-items',
      where: { story: { equals: storyId } },
      limit: 200,
      depth: 1,
      overrideAccess: true,
    }),
    ctx.payload.findByID({
      collection: 'scout-stories',
      id: storyId,
      depth: 0,
      overrideAccess: true,
    }),
  ])
  const items = docs as unknown as ItemDoc[]
  if (items.length === 0) return
  const sources = new Map<number, SourceRef>()
  for (const i of items) {
    if (typeof i.source === 'object' && i.source) {
      sources.set(Number(i.source.id), { name: i.source.name, reliability: i.source.reliability })
    }
  }
  const dates = items
    .map((i) => new Date(i.publishedAt ?? i.createdAt).getTime())
    .filter(Number.isFinite)
  const first = Math.min(...dates)
  const last = Math.max(...dates)
  const s = story as unknown as StoryDoc
  const bestReliability = bestOf([...sources.values()].map((x) => x.reliability))
  const score = storyScore({
    significance: s.significance ?? 50,
    category: s.category,
    sources: [...sources.values()],
    ageHours: (ctx.now.getTime() - first) / 3_600_000,
  })
  const needed = thresholdFor(s.category, threshold)
  await ctx.payload.update({
    collection: 'scout-stories',
    id: storyId,
    data: {
      score,
      sourceCount: sources.size,
      bestReliability,
      firstSeenAt: new Date(first).toISOString(),
      lastItemAt: new Date(last).toISOString(),
      ...(s.status === 'listed' && s.score < needed && score >= needed ? { status: 'new' } : {}),
    },
    overrideAccess: true,
  })
}

/**
 * Score again the stories still in play (last item under a day old, not
 * drafted or set aside) from what's stored: freshness moves with the clock,
 * and a change of weights in score.ts applies at once instead of only to
 * stories that get a new item. Pure arithmetic, no model call. A story that
 * crosses the threshold this way goes back to "new" like in rescore().
 */
export async function rescoreRecent(ctx: ScoutContext, threshold: number): Promise<number> {
  const since = new Date(ctx.now.getTime() - 24 * 3_600_000).toISOString()
  const { docs } = await ctx.payload.find({
    collection: 'scout-stories',
    where: {
      and: [
        { lastItemAt: { greater_than: since } },
        { status: { in: ['new', 'listed'] } },
        { article: { exists: false } },
      ],
    },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const stories = docs as unknown as StoryDoc[]
  if (stories.length === 0) return 0

  // Their sources in two queries (not one per story): the items, then the feeds.
  const [{ docs: itemDocs }, { docs: sourceDocs }] = await Promise.all([
    ctx.payload.find({
      collection: 'scout-items',
      where: { story: { in: stories.map((s) => s.id) } },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    }),
    ctx.payload.find({ collection: 'scout-sources', pagination: false, depth: 0, overrideAccess: true }),
  ])
  const feeds = new Map(
    (sourceDocs as unknown as SourceDoc[]).map((f) => [String(f.id), { name: f.name, reliability: f.reliability }]),
  )
  const byStory = new Map<string, SourceRef[]>()
  for (const i of itemDocs as unknown as ItemDoc[]) {
    const feed = feeds.get(String(typeof i.source === 'object' ? i.source.id : i.source))
    const key = String(typeof i.story === 'object' && i.story ? (i.story as { id: unknown }).id : i.story)
    if (!feed) continue
    if (!byStory.has(key)) byStory.set(key, [])
    byStory.get(key)!.push(feed)
  }

  let changed = 0
  for (const s of stories) {
    const sources = byStory.get(String(s.id))
    if (!sources?.length) continue // items purged: keep the stored score
    const score = storyScore({
      significance: s.significance ?? 50,
      category: s.category,
      sources,
      ageHours: (ctx.now.getTime() - new Date(s.firstSeenAt).getTime()) / 3_600_000,
    })
    if (score === s.score) continue
    const needed = thresholdFor(s.category, threshold)
    await ctx.payload.update({
      collection: 'scout-stories',
      id: s.id,
      data: {
        score,
        ...(s.status === 'listed' && s.score < needed && score >= needed ? { status: 'new' } : {}),
      },
      overrideAccess: true,
    })
    changed++
  }
  return changed
}

/** The stories the model can join items to (see MAX_IMPORTANT). */
async function openStories(ctx: ScoutContext): Promise<OpenStory[]> {
  const since = new Date(ctx.now.getTime() - OPEN_WINDOW_MS).toISOString()
  const pick = { title: true, game: true } as const
  const [important, recent] = await Promise.all([
    ctx.payload.find({
      collection: 'scout-stories',
      where: {
        and: [
          { updatedAt: { greater_than: since } },
          {
            or: [
              { score: { greater_than_equal: 35 } },
              { status: { in: ['drafted', 'published', 'rejected'] } },
            ],
          },
        ],
      },
      sort: '-score',
      limit: MAX_IMPORTANT,
      depth: 0,
      select: pick,
      overrideAccess: true,
    }),
    ctx.payload.find({
      collection: 'scout-stories',
      where: { updatedAt: { greater_than: since } },
      sort: '-updatedAt',
      limit: MAX_RECENT,
      depth: 0,
      select: pick,
      overrideAccess: true,
    }),
  ])
  const byId = new Map<number, OpenStory>()
  for (const s of [...important.docs, ...recent.docs] as unknown as StoryDoc[]) {
    byId.set(Number(s.id), { id: Number(s.id), title: s.title, game: s.game ?? null })
  }
  return [...byId.values()]
}

/** Akavish's recent articles (any status), so items repeating one are set aside. */
async function coveredArticles(ctx: ScoutContext): Promise<CoveredArticle[]> {
  const { docs } = await ctx.payload.find({
    collection: 'articles',
    where: {
      createdAt: {
        greater_than: new Date(ctx.now.getTime() - COVERED_DAYS * 86_400_000).toISOString(),
      },
    },
    draft: true,
    sort: '-createdAt',
    limit: MAX_COVERED,
    depth: 0,
    select: { title: true },
    overrideAccess: true,
  })
  return (docs as unknown as Array<{ id: number; title: string }>).map((a) => ({
    id: Number(a.id),
    title: a.title,
  }))
}

export async function triage(ctx: ScoutContext, settings: SettingsDoc): Promise<TriageReport> {
  const { docs } = await ctx.payload.find({
    collection: 'scout-items',
    where: { status: { equals: 'new' } },
    sort: 'createdAt',
    limit: BATCH,
    depth: 1,
    overrideAccess: true,
  })
  const items = docs as unknown as ItemDoc[]
  const report: TriageReport = {
    items: items.length,
    newStories: 0,
    joined: 0,
    skipped: 0,
    covered: 0,
  }
  if (items.length === 0) return report

  const open = await openStories(ctx)
  const covered = await coveredArticles(ctx)
  const batch: TriageItem[] = items.map((i, index) => ({
    index,
    title: i.title,
    summary: i.summary ?? '',
    source: typeof i.source === 'object' ? (i.source as SourceDoc).name : 'unknown',
  }))

  let answer: TriageAnswer
  if (ctx.config.dryRun) {
    answer = dryRunAnswer(batch)
  } else {
    const budget = await checkBudget(ctx, settings)
    if (!budget.ok) return { ...report, items: 0, skippedReason: budget.reason }
    const result = await callTool<TriageAnswer>({
      apiKey: ctx.config.anthropicKey!,
      model: ctx.config.triageModel,
      system: TRIAGE_SYSTEM,
      prompt: triagePrompt(batch, open, covered),
      tool: TRIAGE_TOOL as unknown as Parameters<typeof callTool>[0]['tool'],
      maxTokens: 6000,
      fetchImpl: ctx.fetch,
    })
    await recordUsage(ctx, {
      purpose: 'triage',
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    })
    answer = result.input
  }

  const decisions = decide(answer, batch, open, covered)
  const created = new Map<string, number>() // new-story key → id
  const touched = new Set<number>()

  for (const item of items) {
    const index = items.indexOf(item)
    const d = decisions.get(index) ?? { kind: 'skip' as const }
    let storyId: number | null = null
    if (d.kind === 'existing') {
      storyId = d.storyId
      report.joined++
    } else if (d.kind === 'new') {
      storyId = created.get(d.story.key) ?? null
      if (storyId === null) {
        const story = await ctx.payload.create({
          collection: 'scout-stories',
          data: {
            title: d.story.title,
            game: d.story.game,
            category: d.story.category,
            significance: d.story.significance,
            status: 'new',
            score: 0,
            firstSeenAt: (item.publishedAt ?? item.createdAt) as string,
          },
          overrideAccess: true,
        })
        storyId = Number(story.id)
        created.set(d.story.key, storyId)
        report.newStories++
      } else {
        report.joined++
      }
    } else if (d.kind === 'covered') {
      report.covered++
    } else {
      report.skipped++
    }

    await ctx.payload.update({
      collection: 'scout-items',
      id: item.id,
      data: storyId === null ? { status: 'ignored' } : { status: 'triaged', story: storyId },
      overrideAccess: true,
    })
    if (storyId !== null) touched.add(storyId)
  }

  const threshold = settings.threshold ?? 60
  for (const id of touched) await rescore(ctx, id, threshold)
  return report
}
