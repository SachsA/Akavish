import { NextRequest, NextResponse } from 'next/server'
import {
  getSearchClient,
  articleToSearchHit,
  ARTICLES_INDEX,
  type SearchEngine,
  type SearchHit,
} from '@/lib/search'
import { searchArticles } from '@/lib/payload'

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
  return NextResponse.json({ query: q, hits, total: total ?? hits.length, engine })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50)

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
    } catch {
      // Index missing (never reindexed), instance down, bad key… — don't fail
      // the request, just use the CMS below.
    }
  }

  try {
    return ok(q, await searchViaCms(q, limit), 'cms')
  } catch {
    // Only reachable if the CMS itself is unreachable, in which case the whole
    // site is already degraded.
    return NextResponse.json({ message: 'Search failed', status: 502 }, { status: 502 })
  }
}
