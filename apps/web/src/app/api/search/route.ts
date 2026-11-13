import { NextRequest, NextResponse } from 'next/server'
import {
  getSearchClient,
  articleToSearchHit,
  ARTICLES_INDEX,
  type GameHit,
  type SearchEngine,
  type SearchHit,
  type SearchResponse,
} from '@/lib/search'
import { fetchGameName, searchArticles, searchCategoryCounts, searchGames } from '@/lib/payload'
import { CATEGORIES } from '@/lib/categories'
import { parseSearchQuery, SEARCH_PAGE_SIZE, type SearchQuery } from '@/lib/search-query'
import { log } from '@/lib/log'
import { clientIp, publicCache, rateLimit, tooManyRequests } from '@/lib/rate-limit'

// Site search, with two backends:
//
//  1. **Meilisearch** when MEILISEARCH_HOST is set — typo-tolerant, ranked by
//     relevance. Proxied server-side so the API key never reaches the browser.
//  2. **The CMS (Postgres ILIKE)** otherwise — every word of the query in the
//     title, the excerpt, the game's name or a tag's name, newest first. No extra
//     infrastructure, so search works out of the box on a fresh clone and in
//     production without a paid search service.
//
// Meilisearch failures also fall through to the CMS: a degraded search beats a
// broken one, and the search box sits in the global header on every page.
//
// Query params: q, category (CMS value), game (slug), page, limit (≤ 50),
// facets=1 (results per category, for the /search chips), games=1 (matching
// games, for the header suggestions).

const CATEGORY_VALUES = CATEGORIES.map((c) => c.value)

type Page = { hits: SearchHit[]; total: number; page: number; totalPages: number }

async function viaCms(query: SearchQuery, limit: number): Promise<Page> {
  const res = await searchArticles({ ...query, limit })
  return {
    hits: res.articles.map(articleToSearchHit),
    total: res.total,
    page: res.page,
    totalPages: res.totalPages,
  }
}

async function viaMeilisearch(
  query: SearchQuery,
  limit: number,
  withFacets: boolean
): Promise<(Page & { facets?: Record<string, number> }) | null> {
  const client = getSearchClient()
  // The index only stores the game's name, not its slug: a game filter goes
  // to the CMS, which has both.
  if (!client || query.game) return null
  const res = await client.index(ARTICLES_INDEX).search(query.q, {
    limit,
    offset: (query.page - 1) * limit,
    filter: query.category ? `category = "${query.category}"` : undefined,
    facets: withFacets ? ['category'] : undefined,
    attributesToRetrieve: ['id', 'slug', 'title', 'excerpt', 'category', 'author', 'game', 'coverImage'],
  })
  const total = res.estimatedTotalHits ?? res.hits.length
  return {
    hits: res.hits as SearchHit[],
    total,
    page: query.page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    // With a category filter the distribution only covers that category, so
    // the chips would lie: let the CMS count instead.
    facets: withFacets && !query.category ? res.facetDistribution?.category : undefined,
  }
}

export async function GET(req: NextRequest) {
  // Search is the one endpoint that runs database queries per distinct input,
  // so it gets its own limit (cached repeats don't count, see publicCache).
  // 60 a minute leaves room for the header suggestions, which fire as you type.
  const limited = rateLimit(`search:${clientIp(req)}`, 60, 60_000)
  if (!limited.ok) {
    log.warn('rate limited', { route: '/api/search' }) // no IP in logs: personal data
    return tooManyRequests(limited.retryAfter)
  }

  const { searchParams } = new URL(req.url)
  const query = parseSearchQuery(searchParams)
  const rawLimit = Number(searchParams.get('limit') ?? SEARCH_PAGE_SIZE)
  const limit =
    Number.isInteger(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 50) : SEARCH_PAGE_SIZE
  const withFacets = searchParams.get('facets') === '1'
  const withGames = searchParams.get('games') === '1'

  if (!query.q) {
    const empty: SearchResponse = {
      query: '',
      hits: [],
      total: 0,
      page: 1,
      totalPages: 0,
      engine: 'cms',
    }
    return NextResponse.json(empty)
  }

  // Side lookups never break the search itself: no games or no chip label at worst.
  const gamesPromise: Promise<GameHit[] | undefined> = withGames
    ? searchGames(query.q).catch(() => [])
    : Promise.resolve(undefined)
  const gameNamePromise = query.game
    ? fetchGameName(query.game).catch(() => null)
    : Promise.resolve(null)

  let page: Page | null = null
  let facets: Record<string, number> | undefined
  let engine: SearchEngine = 'cms'

  try {
    const meili = await viaMeilisearch(query, limit, withFacets)
    if (meili) {
      const { facets: distribution, ...rest } = meili
      page = rest
      facets = distribution
      engine = 'meilisearch'
    }
  } catch (error) {
    // Index missing (never reindexed), instance down, bad key… — don't fail
    // the request, just use the CMS below.
    log.warn('meilisearch failed, falling back to the CMS', { route: '/api/search', error })
  }

  try {
    if (!page) page = await viaCms(query, limit)
    if (withFacets && !facets) facets = await searchCategoryCounts(query.q, CATEGORY_VALUES, query.game)
  } catch (error) {
    // Only reachable if the CMS itself is unreachable, in which case the whole
    // site is already degraded.
    log.error('search failed', { route: '/api/search', error })
    return NextResponse.json(
      { message: 'Search failed', status: 502 },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const [games, gameName] = await Promise.all([gamesPromise, gameNamePromise])
  const body: SearchResponse = {
    query: query.q,
    ...page,
    engine,
    ...(facets ? { facets } : {}),
    ...(games ? { games } : {}),
    ...(gameName ? { gameName } : {}),
  }
  return NextResponse.json(body, { headers: publicCache(60) })
}
