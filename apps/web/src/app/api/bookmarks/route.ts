import { NextRequest } from 'next/server'
import { saveArticle, savedArticleIds, unsaveArticle } from '@/lib/readers'
import { asReader, idFrom, refuse, reply } from '@/lib/reader-route'

// The signed-in reader's saved articles, for the Save button on article pages.
//
//   GET    /api/bookmarks?article=12   → { saved: boolean }
//   POST   /api/bookmarks { articleId } → { saved: true }   (verified email only)
//   DELETE /api/bookmarks?article=12   → { saved: false }
//
// The reader is whoever Clerk says is signed in: the browser never names one.
// Private answers, never cached. The list itself is rendered on /account.
// Refusals come back as { code, message } (lib/reader-route.ts).

export async function GET(req: NextRequest) {
  return asReader(req, { bucket: 'bookmarks', limit: 60, needProfile: false }, async ({ clerkId }) => {
    const id = idFrom(req.nextUrl.searchParams.get('article'))
    if (!id) return refuse('not-found', 400)
    return reply({ saved: (await savedArticleIds(clerkId, [id])).includes(id) })
  })
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { articleId?: unknown }
  return asReader(req, { bucket: 'bookmarks', limit: 60 }, async ({ profile }) => {
    const id = idFrom(body.articleId)
    if (!id) return refuse('not-found', 400)
    await saveArticle(profile!, id)
    return reply({ saved: true })
  })
}

export async function DELETE(req: NextRequest) {
  return asReader(req, { bucket: 'bookmarks', limit: 60, needProfile: false }, async ({ clerkId }) => {
    const id = idFrom(req.nextUrl.searchParams.get('article'))
    if (!id) return refuse('not-found', 400)
    await unsaveArticle(clerkId, id)
    return reply({ saved: false })
  })
}
