/**
 * Akavish — nightly backup trigger (Cloudflare Worker, cron trigger).
 *
 * Why: GitHub runs scheduled workflows late, sometimes hours late (the
 * 03:17 UTC backup started at 11:00 UTC on 2026-11-06). Cloudflare's cron
 * triggers fire on time, so this Worker presses "Run workflow" on
 * .github/workflows/backup.yml every night through GitHub's API. The GitHub
 * cron stays as a fallback; a late duplicate run is harmless.
 *
 * Setup and secrets: DEPLOYMENT.md §9 step 9. Paste this file as-is in the
 * Cloudflare dashboard (Workers → Edit code), or `npx wrangler deploy` from
 * this folder.
 *
 * Secrets (Worker → Settings → Variables and Secrets):
 *   GITHUB_TOKEN    fine-grained PAT, repo SachsA/Akavish only,
 *                   permission "Actions: Read and write" — nothing else
 *   HC_PING_URL     optional, the healthchecks.io ping URL: a failed dispatch
 *                   then pings /fail, so you get an email right away
 */

const REPO = 'SachsA/Akavish'
const WORKFLOW = 'backup.yml'
const REF = 'main'

export async function dispatchBackup(env, fetchImpl = fetch) {
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN secret is not set')

  const res = await fetchImpl(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'akavish-backup-trigger', // GitHub rejects requests without one
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: REF }),
    },
  )

  // GitHub answers 204 No Content when the run is queued.
  if (res.status !== 204) {
    const detail = (await res.text()).slice(0, 300)
    throw new Error(`GitHub dispatch failed: HTTP ${res.status} ${detail}`)
  }
}

export default {
  async scheduled(_event, env, ctx) {
    try {
      await dispatchBackup(env)
      console.log(`Dispatched ${WORKFLOW} on ${REPO}@${REF}`)
    } catch (err) {
      console.error(String(err))
      if (env.HC_PING_URL) {
        ctx.waitUntil(fetch(`${env.HC_PING_URL}/fail`, { method: 'POST', body: String(err) }))
      }
      throw err // marks the cron run as failed in the Cloudflare dashboard
    }
  },

  // No public endpoint: the *.workers.dev URL answers 404 to everyone.
  async fetch() {
    return new Response('Not found', { status: 404 })
  },
}
