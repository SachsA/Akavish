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
  duplicate_of: number
  rejected_like: number
  reason: string
}

export const DEDUPE_SYSTEM = `You check whether a video game news story is already covered by a news site, so the same news isn't written twice.

- duplicate_of: the id of an article that already reports the same news (the same announcement, event, figure or release), even with other words, from another outlet or a day later. 0 if none.
- rejected_like: the id of a rejected story that is the same news. 0 if none.
- Not a duplicate: a genuinely new development of a covered topic (a new date, a new figure, a delay, an official confirmation of what was a rumour, the result of an event that was only previewed). Two different news about the same game are not duplicates.
- reason: one short sentence in French for the editor.
Answer with the tool.`

export const DEDUPE_TOOL = {
  name: 'check_duplicate',
  description: 'Say whether the story is already covered.',
  input_schema: {
    type: 'object',
    properties: {
      duplicate_of: { type: 'integer' },
      rejected_like: { type: 'integer' },
      reason: { type: 'string' },
    },
    required: ['duplicate_of', 'rejected_like', 'reason'],
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

/** Keep only ids that are really in the lists. Pure. */
export function readDuplicate(
  answer: Partial<DuplicateAnswer> | undefined,
  covered: Covered,
): {
  article?: { id: number; title: string }
  rejected?: { id: number; title: string }
  reason: string
} {
  const article = covered.articles.find((a) => a.id === Number(answer?.duplicate_of))
  const rejected = covered.rejected.find((r) => r.id === Number(answer?.rejected_like))
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
        { title: story.title, sourceTitles: items.map((i) => (i as { title: string }).title) },
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
