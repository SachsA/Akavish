// ─── Already covered? ────────────────────────────────────────────────────────
// Before an automatic draft, a quick Haiku check compares the story with what
// the site already has: every article of the last 3 weeks (published,
// scheduled or still a draft) and the stories the editor rejected in the last
// 10 days. The triage groups items that arrive close together, but the same
// news reported a day later, or a story already written by hand, slipped
// through and came back as a second draft (Nov 11: five "Doublon" rejections).
// A duplicate is set aside as rejected, with the reason, and never reaches
// Discord. A genuinely new development (a new date or figure, an official
// confirmation of a rumour) is not a duplicate. Picks from the digest menu
// skip the check: the editor asked for that one.
//
// The model reasons first, then gives an explicit yes/no (`is_duplicate`),
// and only a yes counts. With ids alone, Haiku filled `duplicate_of` with the
// closest article even when its own reason said "not a duplicate": from Nov
// 14 to 16, five esport results (the BLAST Rivals final won by FURIA, BLG
// winning Worlds, semifinals) were set aside against the article that only
// announced the match.

import { callTool } from './anthropic'
import { checkBudget, recordUsage } from './budget'
import type { ScoutContext, SettingsDoc } from './context'

const ARTICLE_DAYS = 21
const REJECTED_DAYS = 10

export interface Covered {
  articles: Array<{ id: number; title: string; excerpt?: string | null }>
  rejected: Array<{ id: number; title: string; reason?: string | null }>
}

export interface DuplicateAnswer {
  reason: string
  is_duplicate: boolean
  duplicate_of: number
  rejected_like: number
}

export const DEDUPE_SYSTEM = `You check whether a video game news story is already covered by a news site, so the same news isn't written twice.

- reason: first, one short sentence in French for the editor saying whether an article or a rejected story already reports this exact news, and which one.
- is_duplicate: true only if an article or a rejected story reports the same news (the same announcement, event, figure or release), even with other words, from another outlet or a day later. A related article on the same topic is not enough.
- duplicate_of: the id of that article. 0 if none, and always 0 when is_duplicate is false.
- rejected_like: the id of that rejected story. 0 if none, and always 0 when is_duplicate is false.
- Not a duplicate: a genuinely new development of a covered topic (a new date, a new figure, a delay, an official confirmation of what was a rumour, the result of an event that was only previewed). Two different news about the same game are not duplicates. In esport, another match, another round or the final result of the same tournament is new news, not a duplicate of an article about an earlier match or a preview.
Answer with the tool.`

export const DEDUPE_TOOL = {
  name: 'check_duplicate',
  description: 'Say whether the story is already covered.',
  input_schema: {
    type: 'object',
    // Reason first: the model writes its judgement, then the verdict.
    properties: {
      reason: { type: 'string' },
      is_duplicate: { type: 'boolean' },
      duplicate_of: { type: 'integer' },
      rejected_like: { type: 'integer' },
    },
    required: ['reason', 'is_duplicate', 'duplicate_of', 'rejected_like'],
  },
} as const

/** The user turn: the story and what the site already has. Pure. */
export function dedupePrompt(
  story: { title: string; sourceTitles: string[] },
  covered: Covered,
): string {
  const arts = covered.articles.length
    ? covered.articles
        .map((a) => `[${a.id}] ${a.title}${a.excerpt ? ` | ${a.excerpt.slice(0, 160)}` : ''}`)
        .join('\n')
    : '(none)'
  const rej = covered.rejected.length
    ? covered.rejected
        .map((r) => `[${r.id}] ${r.title}${r.reason ? ` (rejected: ${r.reason})` : ''}`)
        .join('\n')
    : '(none)'
  return `Story: ${story.title}\nSource headlines:\n${story.sourceTitles.map((t) => `- ${t}`).join('\n')}\n\n--- Articles already on the site or in drafts\n${arts}\n\n--- Stories the editor rejected recently\n${rej}`
}

/**
 * Keep only ids that are really in the lists, and only when the model said
 * yes (`is_duplicate: true`): an id next to a "no" is just the closest topic.
 * Pure.
 */
export function readDuplicate(
  answer: Partial<DuplicateAnswer> | undefined,
  covered: Covered,
): {
  article?: { id: number; title: string }
  rejected?: { id: number; title: string }
  reason: string
} {
  const yes = answer?.is_duplicate === true
  const article = yes
    ? covered.articles.find((a) => a.id === Number(answer?.duplicate_of))
    : undefined
  const rejected = yes
    ? covered.rejected.find((r) => r.id === Number(answer?.rejected_like))
    : undefined
  return {
    ...(article ? { article: { id: article.id, title: article.title } } : {}),
    ...(rejected ? { rejected: { id: rejected.id, title: rejected.title } } : {}),
    reason: typeof answer?.reason === 'string' ? answer.reason.slice(0, 300) : '',
  }
}

/** Recent articles (any status) and recently rejected stories, except this one. */
export async function gatherCovered(ctx: ScoutContext, exceptStory: number): Promise<Covered> {
  const since = (days: number) => new Date(ctx.now.getTime() - days * 86_400_000).toISOString()
  const { docs: arts } = await ctx.payload.find({
    collection: 'articles',
    where: { createdAt: { greater_than: since(ARTICLE_DAYS) } },
    draft: true,
    sort: '-createdAt',
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  const { docs: rej } = await ctx.payload.find({
    collection: 'scout-stories',
    where: {
      and: [
        { status: { equals: 'rejected' } },
        { updatedAt: { greater_than: since(REJECTED_DAYS) } },
        { id: { not_equals: exceptStory } },
      ],
    },
    sort: '-updatedAt',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  return {
    articles: (arts as unknown as Array<{ id: number; title: string; excerpt?: string }>).map(
      (a) => ({ id: Number(a.id), title: a.title, excerpt: a.excerpt }),
    ),
    rejected: (
      rej as unknown as Array<{ id: number; title: string; rejectionReason?: string | null }>
    ).map((r) => ({ id: Number(r.id), title: r.title, reason: r.rejectionReason })),
  }
}

/**
 * Whether an automatic draft would repeat something: returns the French
 * rejection reason, or null to go ahead. Fails open (any error → null).
 */
export async function duplicateReason(
  ctx: ScoutContext,
  settings: SettingsDoc,
  story: { id: number; title: string },
): Promise<string | null> {
  if (ctx.config.dryRun) return null
  try {
    const covered = await gatherCovered(ctx, story.id)
    if (!covered.articles.length && !covered.rejected.length) return null
    const budget = await checkBudget(ctx, settings)
    if (!budget.ok) return null // the draft itself will stop on the budget
    const { docs: items } = await ctx.payload.find({
      collection: 'scout-items',
      where: { story: { equals: story.id } },
      limit: 8,
      depth: 0,
      overrideAccess: true,
    })
    const result = await callTool<DuplicateAnswer>({
      apiKey: ctx.config.anthropicKey!,
      model: ctx.config.triageModel,
      system: DEDUPE_SYSTEM,
      prompt: dedupePrompt(
        {
          title: story.title,
          sourceTitles: items.map((i) => (i as unknown as { title: string }).title),
        },
        covered,
      ),
      tool: DEDUPE_TOOL as unknown as Parameters<typeof callTool>[0]['tool'],
      maxTokens: 400,
      fetchImpl: ctx.fetch,
    })
    await recordUsage(ctx, {
      purpose: 'dedupe',
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    })
    const dup = readDuplicate(result.input, covered)
    if (dup.article) {
      return `auto : doublon de l'article « ${dup.article.title} » (#${dup.article.id}). ${dup.reason}`.trim()
    }
    if (dup.rejected) {
      return `auto : même sujet qu'un rejet récent « ${dup.rejected.title} ». ${dup.reason}`.trim()
    }
    return null
  } catch (err) {
    ctx.payload.logger.warn({
      msg: '[scout] duplicate check failed, drafting anyway',
      story: story.id,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}
