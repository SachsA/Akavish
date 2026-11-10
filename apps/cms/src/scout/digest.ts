// ─── Digests (8 am and 8 pm, Paris time) ─────────────────────────────────────
// Every story found since the previous digest, best score first, so you can
// judge whether the right ones come out on top. Stories listed once are marked
// "listed". With the Discord bot set up (step 2), the digest goes through the
// bot and ends with a "Rédiger…" menu: pick a story and its draft arrives in
// the channel with the Publish / Edit / Reject buttons. Without the bot, the
// webhook sends the same digest, read-only.

import type { ItemDoc, ScoutContext, SettingsDoc, SourceDoc, StoryDoc } from './context'
import { digestMessages, type DigestStory } from './discord'
import { pickMenu, sendBotMessage } from './discord-bot'
import { gatherReport, isReportDay, reportMessages } from './report'
import { dueDigest, parisClock, type DigestSlot } from './schedule'

export async function maybeSendDigest(
  ctx: ScoutContext,
  settings: SettingsDoc,
  /** Send this digest now, whatever the time (`pnpm scout:run --digest`). */
  force?: DigestSlot,
): Promise<string | null> {
  const slot =
    force ??
    dueDigest(ctx.now, { morning: settings.lastMorningDigest, evening: settings.lastEveningDigest })
  if (!slot) return null

  const { docs } = await ctx.payload.find({
    collection: 'scout-stories',
    where: { status: { equals: 'new' } },
    sort: '-score',
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  const stories = docs as unknown as StoryDoc[]

  const digest: DigestStory[] = []
  for (const s of stories) {
    const { docs: items } = await ctx.payload.find({
      collection: 'scout-items',
      where: { story: { equals: s.id } },
      sort: 'publishedAt',
      limit: 20,
      depth: 1,
      overrideAccess: true,
    })
    const list = items as unknown as ItemDoc[]
    const names = [
      ...new Set(
        list.map((i) => (typeof i.source === 'object' ? (i.source as SourceDoc).name : '')),
      ),
    ]
    digest.push({
      title: s.title,
      score: s.score,
      category: s.category,
      game: s.game,
      sourceNames: names.filter(Boolean),
      url: list[0]?.url,
    })
  }

  const messages = digestMessages(slot, digest, settings.threshold ?? 60)
  if (ctx.config.bot && !ctx.config.dryRun) {
    // Through the bot, the last message carries a "Write one of these" menu
    // (step 2): picking a story drafts it even below the threshold.
    const menu = pickMenu(
      [...stories]
        .sort((a, b) => b.score - a.score)
        .map((s) => ({ id: Number(s.id), score: s.score, title: s.title })),
    )
    for (const [i, message] of messages.entries()) {
      await sendBotMessage(
        ctx.config.bot,
        { ...message, ...(i === messages.length - 1 ? { components: menu } : {}) },
        ctx.fetch,
      )
    }
  } else {
    for (const message of messages) await ctx.notify(message)
  }

  for (const s of stories) {
    await ctx.payload.update({
      collection: 'scout-stories',
      id: s.id,
      data: { status: 'listed' },
      overrideAccess: true,
    })
  }

  // A forced digest (CLI) doesn't count: the scheduled one still goes out.
  if (force) return slot

  // Stamp the slot (and, for the evening, the morning too: one digest after
  // 8 pm covers the whole day, see `dueDigest`).
  const { date } = parisClock(ctx.now)
  // Saturday's first digest also brings the weekly report (threshold review).
  const weekly = isReportDay(ctx.now) && settings.lastMorningDigest !== date
  const stamp =
    slot === 'evening'
      ? { lastEveningDigest: date, lastMorningDigest: date }
      : { lastMorningDigest: date }
  await ctx.payload.updateGlobal({ slug: 'scout-settings', data: stamp, overrideAccess: true })
  Object.assign(settings, stamp)

  if (weekly) {
    try {
      const report = await gatherReport(ctx, settings.threshold ?? 60, 7)
      for (const message of reportMessages(report)) {
        if (ctx.config.bot && !ctx.config.dryRun) {
          await sendBotMessage(ctx.config.bot, message, ctx.fetch)
        } else {
          await ctx.notify(message)
        }
      }
    } catch (err) {
      ctx.payload.logger.error({
        msg: '[scout] weekly report failed',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return slot
}
