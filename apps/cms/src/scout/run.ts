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
import { runLive } from './live'
import { autoDraft } from './draft'
import { postToDiscord, type DiscordMessage } from './discord'
import { sendBotMessage } from './discord-bot'
import { purgeOld } from './retention'
import { rescoreRecent, triage } from './triage'
import { maybeEsportRecap } from '../esport/recap'

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
    covered?: number
    skippedReason?: string
  }
  /** Stories whose score moved without a new item (clock, weights). */
  rescored?: number
  drafted?: number
  /** The morning esport recap's story, when one was drafted this run. */
  esportRecap?: number | null
  /** 1 when the running event's page changed. */
  live?: number
  digest?: string | null
}

/** The run context: real network and clock unless the caller (a test) passes its own. */
export function makeContext(payload: Payload, opts: RunOptions = {}): ScoutContext {
  const config = opts.config ?? scoutConfig()
  const fetchImpl = opts.fetch ?? fetch
  // Alerts and errors go through the bot when it's set up (same name and
  // avatar as the drafts), else through the webhook.
  const notify =
    opts.notify ??
    (async (message: DiscordMessage) => {
      if (config.dryRun || (!config.bot && !config.discordWebhook)) {
        payload.logger.info({ msg: '[scout] discord (not sent)', message })
        return
      }
      if (config.bot) await sendBotMessage(config.bot, message as never, fetchImpl)
      else await postToDiscord(config.discordWebhook!, message)
    })
  return { payload, config, now: opts.now ?? new Date(), fetch: fetchImpl, notify }
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
  report.rescored = await step('rescore', () => rescoreRecent(ctx, settings.threshold ?? 60))
  report.drafted = await step('drafts', () => autoDraft(ctx, settings))
  // The morning esport results recap, once a day from 8 am Paris.
  report.esportRecap = (await step('esport recap', () => maybeEsportRecap(ctx, settings))) ?? null
  report.live = await step('live', () => runLive(ctx, settings))
  report.digest = (await step('digest', () => maybeSendDigest(ctx, settings, opts.digest))) ?? null
  await step('retention', () => purgeOld(ctx))

  payload.logger.info({ msg: '[scout] run', dryRun: config.dryRun, ...report })
  return report
}

/** A run older than this is dead: a run takes a minute or two. */
const STALE_MS = 20 * 60_000

/**
 * Remove scout runs left "processing" by a server that stopped mid-run (a
 * redeploy, a crash). Payload never retries such a job, and schedules no new
 * one while it exists: the scout would stay stopped (2026-11-18, from 17:45
 * to the evening, after a deploy). Called before each scheduling.
 */
export async function releaseStaleScoutRuns(payload: Payload, now = new Date()): Promise<number> {
  const { docs } = await payload.find({
    collection: 'payload-jobs',
    where: {
      and: [
        { taskSlug: { equals: 'scoutTick' } },
        { processing: { equals: true } },
        { completedAt: { exists: false } },
        { updatedAt: { less_than: new Date(now.getTime() - STALE_MS).toISOString() } },
      ],
    },
    limit: 20,
    depth: 0,
    overrideAccess: true,
  })
  for (const job of docs) {
    await payload.delete({ collection: 'payload-jobs', id: job.id, overrideAccess: true })
    payload.logger.warn({ msg: '[scout] stale run released', job: job.id, since: job.updatedAt })
  }
  return docs.length
}
