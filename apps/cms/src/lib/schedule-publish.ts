// ─── Schedule publish over REST ──────────────────────────────────────────────
// The admin's "Schedule publish" button queues Payload's `schedulePublish`
// job through a server function that scripts can't call, and the jobs
// collection is closed to REST. This endpoint queues the very same job, so a
// script logged in as an editor (scripts/publish-articles.mjs) can schedule
// articles: they show up as scheduled in /admin and the per-minute jobs run
// publishes them, exactly as if the button had been used.
//
//   POST /api/articles-schedule  { "id": 12, "publishAt": "2026-11-12T09:00:00Z" }
//
// Editors only (a logged-in `users` session or JWT). The date must be in the
// future and within a year; the article must exist.

import type { PayloadHandler } from 'payload'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const YEAR = 365 * 86_400_000

export const schedulePublishHandler: PayloadHandler = async (req) => {
  if (!req.user || req.user.collection !== 'users') return json({ error: 'unauthorized' }, 401)

  let body: { id?: unknown; publishAt?: unknown }
  try {
    body = (await req.json?.()) ?? {}
  } catch {
    return json({ error: 'bad json' }, 400)
  }
  const id = Number(body.id)
  const when = new Date(String(body.publishAt ?? ''))
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'id must be an article id' }, 400)
  if (Number.isNaN(when.getTime())) return json({ error: 'publishAt must be an ISO date' }, 400)
  const now = Date.now()
  if (when.getTime() <= now || when.getTime() > now + YEAR) {
    return json({ error: 'publishAt must be in the future, within a year' }, 400)
  }

  try {
    await req.payload.findByID({ collection: 'articles', id, draft: true, depth: 0, req })
  } catch {
    return json({ error: 'article not found' }, 404)
  }

  const job = (await req.payload.jobs.queue({
    task: 'schedulePublish' as never,
    input: {
      type: 'publish',
      doc: { relationTo: 'articles', value: String(id) },
      user: { relationTo: 'users', value: req.user.id },
    } as never,
    waitUntil: when,
  })) as { id: number | string }

  return json({ ok: true, job: job.id, publishAt: when.toISOString() })
}
