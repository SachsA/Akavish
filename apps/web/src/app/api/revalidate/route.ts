import { revalidatePath, revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { log } from '@/lib/log'
import { CMS_TAG, isValidSecret } from '@/lib/revalidate'

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
  try {
    reason = String(((await req.json()) as { reason?: unknown }).reason ?? '').slice(0, 120)
  } catch {
    // no body: fine
  }
  revalidateTag(CMS_TAG)
  revalidatePath('/', 'layout')
  log.info('revalidated', { route: '/api/revalidate', reason })
  return NextResponse.json(
    { revalidated: true, at: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
