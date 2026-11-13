import { NextRequest } from 'next/server'
import { reportComment } from '@/lib/readers'
import { asReader, idFrom, refuse, reply } from '@/lib/reader-route'

// POST /api/comments/report { commentId, reason, note? } — once per reader and comment.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { commentId?: unknown; reason?: unknown; note?: unknown }
  return asReader(req, { bucket: 'comments-report', limit: 10 }, async ({ profile }) => {
    const id = idFrom(body.commentId)
    if (!id) return refuse('not-found', 400)
    const note = typeof body.note === 'string' ? body.note.slice(0, 500) : ''
    return reply(await reportComment(profile!, Number(id), String(body.reason ?? ''), note))
  })
}
