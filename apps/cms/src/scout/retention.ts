// ─── Retention ───────────────────────────────────────────────────────────────
// Raw items: 30 days. Stories that never became an article: 30 days after
// their last item. Usage rows: 13 months (a full year back for the budget
// history). Runs at most once an hour, at the start of the hour's first tick.

import type { ScoutContext } from './context'

const DAY = 86_400_000

export async function purgeOld(ctx: ScoutContext): Promise<void> {
  if (ctx.now.getUTCMinutes() >= 5) return
  const before = (days: number) => new Date(ctx.now.getTime() - days * DAY).toISOString()

  await ctx.payload.delete({
    collection: 'scout-items',
    where: { createdAt: { less_than: before(30) } },
    overrideAccess: true,
  })
  await ctx.payload.delete({
    collection: 'scout-stories',
    where: {
      and: [
        { status: { in: ['new', 'listed', 'rejected'] } },
        { updatedAt: { less_than: before(30) } },
      ],
    },
    overrideAccess: true,
  })
  await ctx.payload.delete({
    collection: 'scout-usage',
    where: { createdAt: { less_than: before(400) } },
    overrideAccess: true,
  })
}
