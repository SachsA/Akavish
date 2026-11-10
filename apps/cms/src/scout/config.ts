// ─── Scout configuration ─────────────────────────────────────────────────────
// Everything comes from environment variables (Railway in production,
// apps/cms/.env locally). The scout is OFF unless SCOUT_ENABLED=true, so a
// fresh clone, CI and the e2e tests never collect anything or spend money.

export interface DiscordBotConfig {
  token: string
  applicationId: string
  /** Verifies that interactions (button clicks) really come from Discord. */
  publicKey: string
  channelId: string
  /** The only Discord user whose clicks are accepted. */
  ownerId: string
}

export interface ScoutConfig {
  enabled: boolean
  /** No AI call and no Discord post: everything is logged instead. */
  dryRun: boolean
  anthropicKey?: string
  discordWebhook?: string
  /** Step 2: the bot that posts drafts with Publish / Edit / Reject. */
  bot?: DiscordBotConfig
  triageModel: string
  draftModel: string
  monthlyBudgetUsd: number
  dailyBudgetUsd: number
  /** Links in Discord messages. */
  serverUrl: string
  webUrl: string
}

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v)
  return v && Number.isFinite(n) && n > 0 ? n : fallback
}

export function scoutConfig(env: Record<string, string | undefined> = process.env): ScoutConfig {
  const anthropicKey = env.ANTHROPIC_API_KEY || undefined
  const bot =
    env.DISCORD_BOT_TOKEN &&
    env.DISCORD_APPLICATION_ID &&
    env.DISCORD_PUBLIC_KEY &&
    env.SCOUT_DISCORD_CHANNEL_ID &&
    env.SCOUT_DISCORD_OWNER_ID
      ? {
          token: env.DISCORD_BOT_TOKEN,
          applicationId: env.DISCORD_APPLICATION_ID,
          publicKey: env.DISCORD_PUBLIC_KEY,
          channelId: env.SCOUT_DISCORD_CHANNEL_ID,
          ownerId: env.SCOUT_DISCORD_OWNER_ID,
        }
      : undefined
  return {
    enabled: env.SCOUT_ENABLED === 'true',
    // Without an API key there is nothing to call: run dry rather than fail.
    dryRun: env.SCOUT_DRY_RUN === 'true' || !anthropicKey,
    anthropicKey,
    discordWebhook: env.SCOUT_DISCORD_WEBHOOK_URL || undefined,
    bot,
    triageModel: env.SCOUT_TRIAGE_MODEL || 'claude-haiku-5-5',
    draftModel: env.SCOUT_DRAFT_MODEL || 'claude-sonnet-5-5',
    // In dollars, as Anthropic bills: 50 $ sits just under the 50 € agreed.
    monthlyBudgetUsd: num(env.SCOUT_MONTHLY_BUDGET_USD, 50),
    dailyBudgetUsd: num(env.SCOUT_DAILY_BUDGET_USD, 5),
    serverUrl: (env.SERVER_URL || 'http://localhost:3001').replace(/\/+$/, ''),
    webUrl: (env.WEB_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  }
}
