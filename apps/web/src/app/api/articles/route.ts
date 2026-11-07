import { NextRequest, NextResponse } from 'next/server'
import type { ArticleCategory } from '@akavish/types'
import { fetchArticles } from '@/lib/payload'
import { log } from '@/lib/log'
import { clientIp, publicCache, rateLimit, tooManyRequests } from '@/lib/rate-limit'

/** Whole number in [min, max], else the fallback (no NaN or 10 000-item pages). */
function intParam(raw: string | null, fallback: number, min: number, max: number) {
  const n = Number(raw)
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback
}

// Proxies published articles from the Payload CMS REST API.
export async function GET(req: NextRequest) {
  const limited = rateLimit(`articles:${clientIp(req)}`, 120, 60_000)
  if (!limited.ok) {
    log.warn('rate limited', { route: '/api/articles' }) // no IP in logs: personal data
    return tooManyRequests(limited.retryAfter)
  }

  const { searchParams } = new URL(req.url)
  const page = intParam(searchParams.get('page'), 1, 1, 10_000)
  const limit = intParam(searchParams.get('perPage') ?? searchParams.get('limit'), 20, 1, 50)
  const category = searchParams.get('category') ?? undefined

  try {
    const result = await fetchArticles({
      page,
      limit,
      category: (category as ArticleCategory) ?? undefined,
    })
    return NextResponse.json(result, { headers: publicCache(60) })
  } catch (error) {
    log.error('articles API failed', { route: '/api/articles', error })
    return NextResponse.json(
      { message: 'Failed to load articles from CMS', status: 502 },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
