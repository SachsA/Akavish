import { NextRequest, NextResponse } from 'next/server'
import { getSearchClient, ARTICLES_INDEX, type SearchHit } from '@/lib/search'

// Proxies a search query to Meilisearch (server-side, key never exposed).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50)

  if (!q) {
    return NextResponse.json({ query: q, hits: [], total: 0 })
  }

  const client = getSearchClient()
  if (!client) {
    return NextResponse.json(
      { message: 'Search is not configured', status: 503 },
      { status: 503 }
    )
  }

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
    return NextResponse.json({ query: q, hits, total: res.estimatedTotalHits ?? hits.length })
  } catch (err) {
    // If the index hasn't been created yet (no reindex run), treat as empty
    // results rather than an error — the UI shows "no results" instead of
    // "search unavailable".
    const code = (err as { code?: string })?.code
    if (code === 'index_not_found') {
      return NextResponse.json({ query: q, hits: [], total: 0 })
    }
    return NextResponse.json(
      { message: 'Search failed', status: 502 },
      { status: 502 }
    )
  }
}
