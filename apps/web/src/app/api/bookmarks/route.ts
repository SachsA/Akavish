import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { NotFound, ReadersUnavailable, saveArticle, savedArticleIds, unsaveArticle } from '@/lib/readers'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'

// The signed-in reader's saved articles, for the Save button on article pages.
//
//   GET    /api/bookmarks?article=12   → { saved: boolean }
//   POST   /api/bookmarks { articleId } → { saved: true }
//   DELETE /api/bookmarks?article=12   → { saved: false }
//
// The reader is whoever Clerk says is signed in: the browser never names one.
// Private answers, never cached. The list itself is rendered on /account.

const NO_STORE = { 'Cache-Control': 'private, no-store' }

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

function articleIdFrom(value: unknown): string | null {
  const s = String(value ?? '')
  return /^[1-9]\d{0,9}$/.test(s) ? s : null
}

function sameHost(origin: string, host: string): boolean {
  try {
    return new URL(origin).host === host
  } catch {
    return false // "null" and other opaque origins
  }
}

async function handle(
  req: NextRequest,
  run: (clerkId: string, articleId: string) => Promise<NextResponse>,
  articleId: unknown
) {
  // Changes only from our own pages (Clerk's cookie is SameSite=Lax already;
  // this is the belt to those braces).
  const origin = req.headers.get('origin')
  if (req.method !== 'GET' && origin && !sameHost(origin, req.nextUrl.host)) {
    return reply({ message: 'Cross-site request refused.' }, 403)
  }
  const { userId } = await auth()
  if (!userId) return reply({ message: 'Sign in to save articles.' }, 401)
  const limited = rateLimit(`bookmarks:${userId}`, 60, 60_000)
  if (!limited.ok) return tooManyRequests(limited.retryAfter)
  const id = articleIdFrom(articleId)
  if (!id) return reply({ message: 'Bad article id.' }, 400)
  try {
    return await run(userId, id)
  } catch (error) {
    if (error instanceof NotFound) return reply({ message: 'Article not found.' }, 404)
    if (error instanceof ReadersUnavailable) {
      return reply({ message: 'Saving is unavailable right now.' }, 503)
    }
    throw error
  }
}

export async function GET(req: NextRequest) {
  return handle(
    req,
    async (clerkId, id) => reply({ saved: (await savedArticleIds(clerkId, [id])).includes(id) }),
    req.nextUrl.searchParams.get('article')
  )
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { articleId?: unknown }
  return handle(
    req,
    async (clerkId, id) => {
      await saveArticle(clerkId, id)
      return reply({ saved: true })
    },
    body.articleId
  )
}

export async function DELETE(req: NextRequest) {
  return handle(
    req,
    async (clerkId, id) => {
      await unsaveArticle(clerkId, id)
      return reply({ saved: false })
    },
    req.nextUrl.searchParams.get('article')
  )
}
