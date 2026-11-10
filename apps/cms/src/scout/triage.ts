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
import type { Reliability } from './default-sources'
import { bestOf, scoreStory } from './score'
import {
  decide,
  dryRunAnswer,
  TRIAGE_SYSTEM,
  TRIAGE_TOOL,
  triagePrompt,
  type OpenStory,
  type TriageAnswer,
  type TriageItem,
} from './triage-prompt'

const BATCH = 40
const OPEN_WINDOW_MS = 72 * 3_600_000
const MAX_OPEN = 80

export interface TriageReport {
  items: number
  newStories: number
  joined: number
  skipped: number
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
  const sources = new Map<number, Reliability>()
  for (const i of items) {
    if (typeof i.source === 'object' && i.source) sources.set(i.source.id, i.source.reliability)
  }
  const dates = items
    .map((i) => new Date(i.publishedAt ?? i.createdAt).getTime())
    .filter(Number.isFinite)
  const first = Math.min(...dates)
  const last = Math.max(...dates)
  const s = story as unknown as StoryDoc
  const bestReliability = bestOf([...sources.values()])
  const score = scoreStory({
    significance: s.significance ?? 50,
    sourceCount: sources.size,
    bestReliability,
    ageHours: (ctx.now.getTime() - first) / 3_600_000,
  })
  await ctx.payload.update({
    collection: 'scout-stories',
    id: storyId,
    data: {
      score,
      sourceCount: sources.size,
      bestReliability,
      firstSeenAt: new Date(first).toISOString(),
      lastItemAt: new Date(last).toISOString(),
      ...(s.status === 'listed' && s.score < threshold && score >= threshold
        ? { status: 'new' }
        : {}),
    },
    overrideAccess: true,
  })
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
  const report: TriageReport = { items: items.length, newStories: 0, joined: 0, skipped: 0 }
  if (items.length === 0) return report

  const { docs: openDocs } = await ctx.payload.find({
    collection: 'scout-stories',
    where: {
      updatedAt: { greater_than: new Date(ctx.now.getTime() - OPEN_WINDOW_MS).toISOString() },
    },
    sort: '-updatedAt',
    limit: MAX_OPEN,
    depth: 0,
    select: { title: true },
    overrideAccess: true,
  })
  const open: OpenStory[] = (openDocs as unknown as StoryDoc[]).map((s) => ({
    id: Number(s.id),
    title: s.title,
  }))
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
      prompt: triagePrompt(batch, open),
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

  const decisions = decide(answer, batch, open)
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
