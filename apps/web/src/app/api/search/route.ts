import { NextRequest, NextResponse } from 'next/server'
import {
  getSearchClient,
  articleToSearchHit,
  ARTICLES_INDEX,
  type SearchEngine,
  type SearchHit,
} from '@/lib/search'
import { searchArticles } from '@/lib/payload'
import { log } from '@/lib/log'
import { clientIp, publicCache, rateLimit, tooManyRequests } from '@/lib/rate-limit'

// Site search, with two backends:
//
//  1. **Meilisearch** when MEILISEARCH_HOST is set — typo-tolerant, ranked by
//     relevance. Proxied server-side so the API key never reaches the browser.
//  2. **The CMS (Postgres ILIKE)** otherwise — substring match on title and
//     excerpt, newest-first. No extra infrastructure, so search works out of the
//     box on a fresh clone and in production without a paid search service.
//
// Meilisearch failures also fall through to the CMS: a degraded search beats a
// broken one, and the search box sits in the global header on every page.

/** Query the CMS. Shared by the "no Meilisearch" and "Meilisearch broke" paths. */
async function searchViaCms(q: string, limit: number) {
  const articles = await searchArticles(q, limit)
  return articles.map(articleToSearchHit)
}

function ok(q: string, hits: SearchHit[], engine: SearchEngine, total?: number) {
  return NextResponse.json(
    { query: q, hits, total: total ?? hits.length, engine },
    { headers: publicCache(60) }
  )
}

export async function GET(req: NextRequest) {
  // Search is the one endpoint that runs a database query per distinct input,
  // so it gets the tighter limit (cached repeats don't count, see publicCache).
  const limited = rateLimit(`search:${clientIp(req)}`, 30, 60_000)
  if (!limited.ok) {
    log.warn('rate limited', { route: '/api/search' }) // no IP in logs: personal data
    return tooManyRequests(limited.retryAfter)
  }

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const rawLimit = Number(searchParams.get('limit') ?? 20)
  const limit = Number.isInteger(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 50) : 20

  if (!q) {
    return NextResponse.json({ query: q, hits: [], total: 0, engine: 'cms' })
  }

  const client = getSearchClient()

  if (client) {
    try {
      const res = await client.index(ARTICLES_INDEX).search(q, {
        limit,
        attributesToRetrieve: [
          'id',
          'slug',
          'title',
          'excerpt',
          'category',
          'author',
          'game',
          'coverImage',
        ],
      })
      const hits = res.hits as SearchHit[]
      return ok(q, hits, 'meilisearch', res.estimatedTotalHits ?? hits.length)
    } catch (error) {
      // Index missing (never reindexed), instance down, bad key… — don't fail
      // the request, just use the CMS below.
      log.warn('meilisearch failed, falling back to the CMS', { route: '/api/search', error })
    }
  }

  try {
    return ok(q, await searchViaCms(q, limit), 'cms')
  } catch (error) {
    // Only reachable if the CMS itself is unreachable, in which case the whole
    // site is already degraded.
    log.error('search failed', { route: '/api/search', error })
    return NextResponse.json(
      { message: 'Search failed', status: 502 },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
