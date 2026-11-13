import { NextRequest } from 'next/server'
import { voteComment } from '@/lib/readers'
import { asReader, idFrom, refuse, reply } from '@/lib/reader-route'

// POST /api/comments/vote { commentId, value: 1 | -1 | 0 } — like, dislike, take back.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { commentId?: unknown; value?: unknown }
  return asReader(req, { bucket: 'comments-vote', limit: 60 }, async ({ profile }) => {
    const id = idFrom(body.commentId)
    const value = Number(body.value)
    if (!id || ![1, 0, -1].includes(value)) return refuse('not-found', 400)
    return reply(await voteComment(profile!, Number(id), value as -1 | 0 | 1))
  })
}
