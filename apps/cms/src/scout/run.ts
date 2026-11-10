// ─── One scout run ───────────────────────────────────────────────────────────
// Called every 5 minutes by the `scoutTick` job (payload.config.ts), or by
// hand with `pnpm scout:run`. Order: collect → triage → drafts (step 2, when
// switched on) → digest if due → housekeeping. Each step logs a JSON line; an error in one step is logged and
// doesn't stop the others.

import type { Payload } from 'payload'
import { collect, ensureSources } from './collect'
import { scoutConfig, type ScoutConfig } from './config'
import type { ScoutContext, SettingsDoc } from './context'
import { maybeSendDigest } from './digest'
import { autoDraft } from './draft'
import { postToDiscord, type DiscordMessage } from './discord'
import { purgeOld } from './retention'
import { triage } from './triage'

export interface RunOptions {
  config?: ScoutConfig
  now?: Date
  fetch?: ScoutContext['fetch']
  notify?: ScoutContext['notify']
  /** Run even when SCOUT_ENABLED isn't true (the CLI does, in dry run). */
  force?: boolean
  /** Send this digest now, whatever the time. */
  digest?: 'morning' | 'evening'
}

export interface RunReport {
  ran: boolean
  reason?: string
  collected?: { fetched: number; stored: number; errors: number }
  triaged?: {
    items: number
    newStories: number
    joined: number
    skipped: number
    skippedReason?: string
  }
  drafted?: number
  digest?: string | null
}

/** The run context: real network and clock unless the caller (a test) passes its own. */
export function makeContext(payload: Payload, opts: RunOptions = {}): ScoutContext {
  const config = opts.config ?? scoutConfig()
  const notify =
    opts.notify ??
    (async (message: DiscordMessage) => {
      if (config.dryRun || !config.discordWebhook) {
        payload.logger.info({ msg: '[scout] discord (not sent)', message })
        return
      }
      await postToDiscord(config.discordWebhook, message)
    })
  return { payload, config, now: opts.now ?? new Date(), fetch: opts.fetch ?? fetch, notify }
}

export async function runScout(payload: Payload, opts: RunOptions = {}): Promise<RunReport> {
  const ctx = makeContext(payload, opts)
  const { config } = ctx
  if (!config.enabled && !opts.force) return { ran: false, reason: 'SCOUT_ENABLED is not true' }

  const settings = (await payload.findGlobal({
    slug: 'scout-settings',
    overrideAccess: true,
  })) as unknown as SettingsDoc
  if (settings.paused) return { ran: false, reason: 'paused in Scout settings' }

  const report: RunReport = { ran: true }
  const step = async <T>(name: string, fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn()
    } catch (err) {
      payload.logger.error({
        msg: `[scout] ${name} failed`,
        error: err instanceof Error ? err.message : String(err),
      })
      return undefined
    }
  }

  await step('sources', () => ensureSources(ctx))
  report.collected = await step('collect', () => collect(ctx))
  report.triaged = await step('triage', () => triage(ctx, settings))
  report.drafted = await step('drafts', () => autoDraft(ctx, settings))
  report.digest = (await step('digest', () => maybeSendDigest(ctx, settings, opts.digest))) ?? null
  await step('retention', () => purgeOld(ctx))

  payload.logger.info({ msg: '[scout] run', dryRun: config.dryRun, ...report })
  return report
}
