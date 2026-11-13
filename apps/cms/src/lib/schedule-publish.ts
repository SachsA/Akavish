// ─── Schedule publish over REST ──────────────────────────────────────────────
// The admin's "Schedule publish" button queues Payload's `schedulePublish`
// job through a server function that scripts can't call, and the jobs
// collection is closed to REST. This endpoint queues the very same job, so a
// script logged in as an editor (scripts/publish-articles.mjs) can schedule
// articles: they show up as scheduled in /admin and the per-minute jobs run
// publishes them, exactly as if the button had been used.
//
//   POST /api/articles-schedule  { "id": 12, "publishAt": "2026-11-12T09:00:00Z" }
//   POST /api/articles-schedule  { "id": 12, "publishAt": null }   cancel
//
// It sets the schedule rather than adding one: the article's pending publish
// jobs are cancelled first, so moving a date never leaves the old one behind.
// Editors and admins only (a logged-in `users` session or JWT; writers can't
// publish, src/access/roles.ts). The date must be in the
// future and within a year; the article must exist.

import type { PayloadHandler } from 'payload'
import { isEditorUser } from '../access/roles'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const YEAR = 365 * 86_400_000

export const schedulePublishHandler: PayloadHandler = async (req) => {
  if (!req.user || req.user.collection !== 'users') return json({ error: 'unauthorized' }, 401)
  if (!isEditorUser(req.user)) return json({ error: 'editors only' }, 403)

  let body: { id?: unknown; publishAt?: unknown }
  try {
    body = (await req.json?.()) ?? {}
  } catch {
    return json({ error: 'bad json' }, 400)
  }
  const id = Number(body.id)
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'id must be an article id' }, 400)
  const cancelOnly = body.publishAt === null
  const when = new Date(String(body.publishAt ?? ''))
  if (!cancelOnly) {
    if (Number.isNaN(when.getTime())) return json({ error: 'publishAt must be an ISO date' }, 400)
    const now = Date.now()
    if (when.getTime() <= now || when.getTime() > now + YEAR) {
      return json({ error: 'publishAt must be in the future, within a year' }, 400)
    }
  }

  try {
    await req.payload.findByID({ collection: 'articles', id, draft: true, depth: 0, req })
  } catch {
    return json({ error: 'article not found' }, 404)
  }

  // Pending publishes of this article (few: filtered here rather than with a
  // query on the JSON `input` column).
  const { docs: pending } = await req.payload.find({
    collection: 'payload-jobs' as never,
    where: {
      taskSlug: { equals: 'schedulePublish' },
      completedAt: { exists: false },
      processing: { equals: false },
    } as never,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const mine = (
    pending as unknown as Array<{
      id: number | string
      input?: { doc?: { relationTo?: string; value?: unknown } }
    }>
  ).filter(
    (j) => j.input?.doc?.relationTo === 'articles' && String(j.input.doc.value) === String(id),
  )
  for (const j of mine) {
    await req.payload.delete({
      collection: 'payload-jobs' as never,
      id: j.id,
      overrideAccess: true,
    })
  }
  if (cancelOnly) return json({ ok: true, cancelled: mine.length })

  const job = (await req.payload.jobs.queue({
    task: 'schedulePublish' as never,
    input: {
      type: 'publish',
      doc: { relationTo: 'articles', value: String(id) },
      user: { relationTo: 'users', value: req.user.id },
    } as never,
    waitUntil: when,
  })) as { id: number | string }

  return json({ ok: true, job: job.id, publishAt: when.toISOString(), cancelled: mine.length })
}
