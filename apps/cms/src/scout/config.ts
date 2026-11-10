// ─── Scout configuration ─────────────────────────────────────────────────────
// Everything comes from environment variables (Railway in production,
// apps/cms/.env locally). The scout is OFF unless SCOUT_ENABLED=true, so a
// fresh clone, CI and the e2e tests never collect anything or spend money.

export interface ScoutConfig {
  enabled: boolean
  /** No AI call and no Discord post: everything is logged instead. */
  dryRun: boolean
  anthropicKey?: string
  discordWebhook?: string
  triageModel: string
  monthlyBudgetUsd: number
  dailyBudgetUsd: number
}

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v)
  return v && Number.isFinite(n) && n > 0 ? n : fallback
}

export function scoutConfig(env: Record<string, string | undefined> = process.env): ScoutConfig {
  const anthropicKey = env.ANTHROPIC_API_KEY || undefined
  return {
    enabled: env.SCOUT_ENABLED === 'true',
    // Without an API key there is nothing to call: run dry rather than fail.
    dryRun: env.SCOUT_DRY_RUN === 'true' || !anthropicKey,
    anthropicKey,
    discordWebhook: env.SCOUT_DISCORD_WEBHOOK_URL || undefined,
    triageModel: env.SCOUT_TRIAGE_MODEL || 'claude-haiku-5-5',
    // In dollars, as Anthropic bills: 50 $ sits just under the 50 € agreed.
    monthlyBudgetUsd: num(env.SCOUT_MONTHLY_BUDGET_USD, 50),
    dailyBudgetUsd: num(env.SCOUT_DAILY_BUDGET_USD, 5),
  }
}
