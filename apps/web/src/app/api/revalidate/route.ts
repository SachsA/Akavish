import { revalidatePath, revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { log } from '@/lib/log'
import { CMS_TAG, cleanTags, isValidSecret } from '@/lib/revalidate'

// POST /api/revalidate, called by the CMS after a public change (an article
// published, edited or removed, a game, a tag, an author). Header
// `x-revalidate-secret` must match REVALIDATE_SECRET, set to the same value on
// the CMS (Railway) and here (Vercel). Without it the route answers 404.
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!isValidSecret(req.headers.get('x-revalidate-secret'), secret)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  let reason = ''
  let tags: string[] = []
  try {
    const body = (await req.json()) as { reason?: unknown; tags?: unknown }
    reason = String(body.reason ?? '').slice(0, 120)
    tags = cleanTags(body.tags)
  } catch {
    // no body: fine
  }
  // `expire: 0` drops the cached CMS data now, as Next 15's one-argument call
  // did; the 'max' profile would serve stale data once more. With tags, only
  // what changed (the pages that read it go stale with it); without, all of it.
  if (tags.length) {
    for (const tag of tags) revalidateTag(tag, { expire: 0 })
  } else {
    revalidateTag(CMS_TAG, { expire: 0 })
    revalidatePath('/', 'layout')
  }
  log.info('revalidated', { route: '/api/revalidate', reason, tags: tags.length ? tags : 'all' })
  return NextResponse.json(
    { revalidated: true, at: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
