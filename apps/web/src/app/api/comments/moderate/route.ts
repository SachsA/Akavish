import { NextRequest } from 'next/server'
import { moderateComment } from '@/lib/readers'
import { asReader, idFrom, refuse, reply } from '@/lib/reader-route'

// POST /api/comments/moderate { commentId, action: hide | restore } — Owner, Admin and Mod readers.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { commentId?: unknown; action?: unknown }
  return asReader(req, { bucket: 'comments-moderate', limit: 60 }, async ({ profile }) => {
    const id = idFrom(body.commentId)
    if (!id || (body.action !== 'hide' && body.action !== 'restore')) return refuse('not-found', 400)
    await moderateComment(profile!, Number(id), body.action)
    return reply({ ok: true })
  })
}
