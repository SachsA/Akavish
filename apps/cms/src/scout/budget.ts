// ─── Budget ──────────────────────────────────────────────────────────────────
// Every paid call is recorded in `scout-usage`. Before a paid call the scout
// checks the month and the day: at 80 % of the month it warns on Discord, at
// 100 % (or past the daily cap) it pauses itself until you untick "paused".
// Third safety net outside the code: the spend limit in the Anthropic console
// and the prepaid balance.

import type { ScoutContext, SettingsDoc } from './context'
import { costUsd } from './pricing'
import { periodStarts } from './schedule'

async function spentSince(ctx: ScoutContext, since: Date): Promise<number> {
  const { docs } = await ctx.payload.find({
    collection: 'scout-usage',
    where: { createdAt: { greater_than_equal: since.toISOString() } },
    limit: 0,
    pagination: false,
    depth: 0,
    select: { costUsd: true },
    overrideAccess: true,
  })
  return (docs as unknown as Array<{ costUsd?: number }>).reduce(
    (sum, d) => sum + (d.costUsd ?? 0),
    0,
  )
}

export async function recordUsage(
  ctx: ScoutContext,
  usage: { purpose: string; model: string; inputTokens: number; outputTokens: number },
): Promise<number> {
  const cost = costUsd(usage.model, usage.inputTokens, usage.outputTokens)
  await ctx.payload.create({
    collection: 'scout-usage',
    data: { kind: 'llm', ...usage, costUsd: cost },
    overrideAccess: true,
  })
  return cost
}

export type BudgetState = { ok: true } | { ok: false; reason: string }

/**
 * Whether a paid call may run now. Sends each alert once (stamped in
 * scout-settings) and pauses the scout when the monthly budget is spent.
 */
export async function checkBudget(ctx: ScoutContext, settings: SettingsDoc): Promise<BudgetState> {
  const { month, day } = periodStarts(ctx.now)
  const [monthSpent, daySpent] = await Promise.all([spentSince(ctx, month), spentSince(ctx, day)])
  const { monthlyBudgetUsd, dailyBudgetUsd } = ctx.config
  const monthKey = ctx.now.toISOString().slice(0, 7)
  const dayKey = ctx.now.toISOString().slice(0, 10)
  const fmt = (n: number) => `${n.toFixed(2)} $`

  // The alerts already sent, newest last (kept short: only recent keys matter).
  const sent = (settings.lastBudgetAlert ?? '').split(',').filter(Boolean)
  const alertOnce = async (key: string, text: string) => {
    if (sent.includes(key)) return
    await ctx.notify({ content: text })
    sent.push(key)
    settings.lastBudgetAlert = sent.slice(-10).join(',')
    await ctx.payload.updateGlobal({
      slug: 'scout-settings',
      data: { lastBudgetAlert: settings.lastBudgetAlert },
      overrideAccess: true,
    })
  }

  if (monthSpent >= monthlyBudgetUsd) {
    await ctx.payload.updateGlobal({
      slug: 'scout-settings',
      data: { paused: true },
      overrideAccess: true,
    })
    await alertOnce(
      `${monthKey}:100`,
      `**Scout en pause** : budget du mois atteint (${fmt(monthSpent)} sur ${fmt(monthlyBudgetUsd)}). ` +
        `Il reprendra quand tu décocheras « paused » dans /admin → Scout settings (pense à relever SCOUT_MONTHLY_BUDGET_USD si besoin).`,
    )
    return { ok: false, reason: 'monthly budget spent' }
  }
  if (daySpent >= dailyBudgetUsd) {
    await alertOnce(
      `${dayKey}:day`,
      `**Scout** : plafond du jour atteint (${fmt(daySpent)} sur ${fmt(dailyBudgetUsd)}). Le tri reprend demain.`,
    )
    return { ok: false, reason: 'daily budget spent' }
  }
  if (monthSpent >= 0.8 * monthlyBudgetUsd) {
    await alertOnce(
      `${monthKey}:80`,
      `**Scout** : 80 % du budget du mois dépensés (${fmt(monthSpent)} sur ${fmt(monthlyBudgetUsd)}).`,
    )
  }
  return { ok: true }
}
