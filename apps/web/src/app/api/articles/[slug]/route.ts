import { NextRequest, NextResponse } from 'next/server'
import { fetchArticleBySlug } from '@/lib/payload'
import { log } from '@/lib/log'
import { clientIp, publicCache, rateLimit, tooManyRequests } from '@/lib/rate-limit'

// Returns a single published article by slug from the Payload CMS.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const limited = rateLimit(`articles:${clientIp(req)}`, 120, 60_000)
  if (!limited.ok) {
    log.warn('rate limited', { route: '/api/articles/[slug]' }) // no IP in logs: personal data
    return tooManyRequests(limited.retryAfter)
  }

  const { slug } = await params

  try {
    const article = await fetchArticleBySlug(slug)
    if (!article) {
      return NextResponse.json(
        { message: `Article "${slug}" not found`, status: 404 },
        { status: 404, headers: publicCache(60) }
      )
    }
    return NextResponse.json(article, { headers: publicCache(60) })
  } catch (error) {
    log.error('article API failed', { route: '/api/articles/[slug]', slug, error })
    return NextResponse.json(
      { message: 'Failed to load article from CMS', status: 502 },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
