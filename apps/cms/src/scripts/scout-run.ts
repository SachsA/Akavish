/**
 * Run the AI scout once, by hand, against the LOCAL database.
 *
 *   pnpm scout:run          dry run: real feeds, no AI call, no Discord post
 *                           (each item becomes its own story, digest printed)
 *   pnpm scout:run --live   with ANTHROPIC_API_KEY and SCOUT_DISCORD_WEBHOOK_URL
 *                           from apps/cms/.env: real triage, real Discord post
 *
 * Add --digest to send the digest now, whatever the time, or --report to only
 * print the weekly report (last 7 days, or --days=N) without running the scout. Production doesn't
 * use this: the `scoutTick` job runs every 5 minutes inside the CMS.
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import { scoutConfig } from '../scout/config'
import { gatherReport, reportText } from '../scout/report'
import { makeContext, runScout } from '../scout/run'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal'])

const raw = process.env.DATABASE_URL
if (!raw) throw new Error('[scout:run] DATABASE_URL is not set (apps/cms/.env).')
const host = new URL(raw).hostname
if (!LOCAL_HOSTS.has(host)) {
  throw new Error(
    `[scout:run] Refusing to run against "${host}": local database only. Production runs the scoutTick job.`,
  )
}

const payload = await getPayload({ config })

if (process.argv.includes('--report')) {
  const days = Number(process.argv.find((a) => a.startsWith('--days='))?.slice(7)) || 7
  const settings = (await payload.findGlobal({ slug: 'scout-settings' })) as {
    threshold?: number | null
  }
  console.log(reportText(await gatherReport(makeContext(payload), settings.threshold ?? 60, days)))
  process.exit(0)
}

const live = process.argv.includes('--live')
const forceDigest = process.argv.includes('--digest')

const base = scoutConfig()
const cfg = { ...base, enabled: true, dryRun: live ? base.dryRun : true }

const report = await runScout(payload, {
  config: cfg,
  force: true,
  digest: forceDigest ? 'evening' : undefined,
})
console.log(JSON.stringify(report, null, 2))
process.exit(0)
