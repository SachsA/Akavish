import { auth } from '@clerk/nextjs/server'
import { NextRequest } from 'next/server'
import { deleteComment, listComments, postComment, ReaderApiError, ReadersUnavailable } from '@/lib/readers'
import { asReader, idFrom, refuse, reply } from '@/lib/reader-route'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'

// Comments under an article (rules: apps/cms/src/lib/comments.ts).
//
//   GET    /api/comments?article=12&page=1          anyone; signed in, also your votes and rights
//   POST   /api/comments { articleId, body, replyTo? }  verified readers
//   DELETE /api/comments?id=34                      your own, or any as Owner / Admin / Mod
//
// Never cached: votes, deletions and new comments must show at once.

export async function GET(req: NextRequest) {
  const limited = rateLimit(`comments:${clientIp(req)}`, 120, 60_000)
  if (!limited.ok) return tooManyRequests(limited.retryAfter)
  const article = idFrom(req.nextUrl.searchParams.get('article'))
  if (!article) return refuse('not-found', 400)
  const page = Number(idFrom(req.nextUrl.searchParams.get('page')) ?? 1)
  const { userId } = await auth()
  try {
    return reply(await listComments(article, Math.min(page, 500), userId))
  } catch (error) {
    if (error instanceof ReaderApiError) return refuse(error.code, error.status)
    if (error instanceof ReadersUnavailable) return refuse('unavailable', 503)
    throw error
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { articleId?: unknown; body?: unknown; replyTo?: unknown }
  return asReader(req, { bucket: 'comments-write' }, async ({ profile }) => {
    const articleId = idFrom(body.articleId)
    if (!articleId) return refuse('not-found', 400)
    const replyTo = body.replyTo == null ? null : Number(idFrom(body.replyTo))
    if (body.replyTo != null && !replyTo) return refuse('reply-target', 400)
    const text = typeof body.body === 'string' ? body.body : ''
    if (text.length > 4000) return refuse('too-long', 400)
    const comment = await postComment(profile!, { articleId, body: text, replyTo })
    return reply({ comment }, 201)
  })
}

export async function DELETE(req: NextRequest) {
  return asReader(req, { bucket: 'comments-write' }, async ({ profile }) => {
    const id = idFrom(req.nextUrl.searchParams.get('id'))
    if (!id) return refuse('not-found', 400)
    await deleteComment(profile!, Number(id))
    return reply({ deleted: true })
  })
}
