// ─── Digests (8 am and 8 pm, Paris time) ─────────────────────────────────────
// Step 1 ("observation"): every story found since the previous digest, best
// score first, so you can judge whether the right ones come out on top before
// the scout starts writing. Stories listed once are marked "listed".

import type { ItemDoc, ScoutContext, SettingsDoc, SourceDoc, StoryDoc } from './context'
import { digestMessages, type DigestStory } from './discord'
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

  for (const message of digestMessages(slot, digest, settings.threshold ?? 60)) {
    await ctx.notify(message)
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
  const stamp =
    slot === 'evening'
      ? { lastEveningDigest: date, lastMorningDigest: date }
      : { lastMorningDigest: date }
  await ctx.payload.updateGlobal({ slug: 'scout-settings', data: stamp, overrideAccess: true })
  Object.assign(settings, stamp)
  return slot
}
