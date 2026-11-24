// ─── Payload REST helpers ────────────────────────────────────────────────────
// The CMS (standalone Payload) exposes a REST API at CMS_URL/api.
// These helpers fetch from it and normalise Payload's response shape into the
// shared `Article` type the frontend (and mobile) consume.

import type { Article, PaginatedResponse } from '@akavish/types'
import {
  mapArticle as mapPayloadArticle,
  mediaUrl as sharedMediaUrl,
  type MediaSize,
  type PayloadArticle,
  type PayloadListResponse,
  type PayloadMedia,
} from '@akavish/api-client/payload'

import { log } from './log'
import type { Locale } from './i18n/config'
import { localizeArticle, pick } from './i18n/content'
import { getLocale } from './i18n/server'
import { matchGames } from './game-match'
import type { LibraryCompany, LibraryGame, Release } from './game-library'
import { matchEntities } from './entity-match'
import { PLATFORM_FAMILIES, sortPlatforms, type PlatformFamily, type PlatformInfo } from './platforms'
import { CACHE, CMS_TAG, TAGS } from './revalidate'
import { rowOf, type EsportRow } from './esport'

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:3001'

// Fail fast if the CMS is slow or down (esp. during a build), so callers hit
// their try/catch and degrade gracefully instead of hanging the request/build.
// Uses Promise.race (not AbortSignal) to keep Next's fetch cache semantics —
// a `signal` would mark the fetch dynamic and clash with generateStaticParams.
const CMS_FETCH_TIMEOUT_MS = 8000
async function cmsFetch(url: string, init?: RequestInit): Promise<Response> {
  // Every CMS read carries the `cms` cache tag, so /api/revalidate (pinged by
  // the CMS after a change) can drop them all at once.
  init = { ...init, next: { ...init?.next, tags: [CMS_TAG, ...(init?.next?.tags ?? [])] } }
  // Only the path in logs: the query string can carry search terms.
  const path = url.replace(CMS_URL, '').split('?')[0]
  try {
    const res = await Promise.race([
      fetch(url, init),
      new Promise<Response>((_, reject) =>
        setTimeout(
          () => reject(new Error(`CMS fetch timed out after ${CMS_FETCH_TIMEOUT_MS}ms`)),
          CMS_FETCH_TIMEOUT_MS
        )
      ),
    ])
    if (!res.ok && res.status !== 404) log.warn('CMS answered an error', { path, status: res.status })
    return res
  } catch (error) {
    log.error('CMS unreachable', { path, error })
    throw error
  }
}

// The Payload → Article mapping is shared with the mobile app and lives in
// `@akavish/api-client/payload`. These thin wrappers bind it to this app's CMS
// origin, so the call sites below stay one-argument.
// Articles come back in the page's language (setRequestLocale in the page;
// English outside a page, e.g. in an API route that doesn't pass one).
const mapFor = (locale: Locale) => (doc: PayloadArticle): Article =>
  localizeArticle(mapPayloadArticle(doc, CMS_URL), locale)
const mapArticle = (doc: PayloadArticle): Article => mapFor(getLocale())(doc)
const mediaUrl = (m: PayloadMedia, preferred?: MediaSize) =>
  sharedMediaUrl(m, CMS_URL, preferred)

interface ListParams {
  page?: number
  limit?: number
  category?: string
  authorId?: string
  gameId?: string
  tagId?: string
  /** Only articles the editor marked as homepage lead. */
  featured?: boolean
  /** A company's page: articles about its games, or with its tag. */
  company?: { gameIds: string[]; tagId?: string }
  /** About one of these games (main game or Also covers): a reader's followed games. */
  gameIds?: string[]
  /** Language of the articles; default: the page's (route handlers pass it). */
  locale?: Locale
  /**
   * Cache tags: an entity page's list goes with its entity (`TAGS.game(slug)`…)
   * so a new article only refreshes the pages it's about. Default: the article lists.
   */
  cacheTags?: string[]
}

// Fetch a paginated list of *published* articles, newest first.
export async function fetchArticles(
  params: ListParams = {}
): Promise<PaginatedResponse<Article>> {
  const { page = 1, limit = 20, category, authorId, gameId, tagId, featured, company, gameIds } = params
  const qs = new URLSearchParams({
    'where[status][equals]': 'published',
    sort: '-publishedAt',
    depth: '1',
    limit: String(limit),
    page: String(page),
  })
  if (category) qs.set('where[category][equals]', category)
  if (authorId) qs.set('where[author][equals]', authorId)
  if (gameId) {
    // Main game, or one of the others it covers (a conference recap).
    qs.set('where[or][0][game][equals]', gameId)
    qs.set('where[or][1][relatedGames][in]', gameId)
  }
  if (tagId) qs.set('where[tags][in]', tagId)
  if (gameIds) {
    const ids = gameIds.length ? gameIds.join(',') : '0'
    qs.set('where[or][0][game][in]', ids)
    qs.set('where[or][1][relatedGames][in]', ids)
  }
  if (company) {
    // About one of its games, or tagged with the company.
    const ids = company.gameIds.length ? company.gameIds.join(',') : '0'
    qs.set('where[or][0][game][in]', ids)
    qs.set('where[or][1][relatedGames][in]', ids)
    if (company.tagId) qs.set('where[or][2][tags][in]', company.tagId)
  }
  if (featured) qs.set('where[featured][equals]', 'true')

  const res = await cmsFetch(`${CMS_URL}/api/articles?${qs.toString()}`, {
    next: params.cacheTags
      ? { revalidate: CACHE.details, tags: params.cacheTags }
      : { revalidate: CACHE.lists, tags: [TAGS.articles] },
  })

  if (!res.ok) {
    throw new Error(`CMS responded ${res.status}`)
  }

  const json = (await res.json()) as PayloadListResponse<PayloadArticle>

  return {
    data: json.docs.map(params.locale ? mapFor(params.locale) : mapArticle),
    total: json.totalDocs,
    page: json.page,
    perPage: json.limit,
    totalPages: json.totalPages,
  }
}

// Fetch a single published article by slug, or null if not found.
export async function fetchArticleBySlug(slug: string): Promise<Article | null> {
  const qs = new URLSearchParams({
    'where[slug][equals]': slug,
    'where[status][equals]': 'published',
    depth: '1',
    limit: '1',
  })

  const res = await cmsFetch(`${CMS_URL}/api/articles?${qs.toString()}`, {
    next: { revalidate: CACHE.details, tags: [TAGS.article(slug)] },
  })

  if (!res.ok) {
    throw new Error(`CMS responded ${res.status}`)
  }

  const json = (await res.json()) as PayloadListResponse<PayloadArticle>
  const doc = json.docs[0]
  return doc ? mapArticle(doc) : null
}

/**
 * The current slug of the published article that used to live at `oldSlug`,
 * or null. Backs the 308 redirect on the article page: the CMS records a
 * published article's previous slugs whenever it's renamed (`previousSlugs`).
 */
export async function fetchCurrentSlugFor(oldSlug: string): Promise<string | null> {
  const qs = new URLSearchParams({
    'where[previousSlugs.slug][equals]': oldSlug,
    'where[status][equals]': 'published',
    depth: '0',
    limit: '1',
    'select[slug]': 'true',
  })
  const res = await cmsFetch(`${CMS_URL}/api/articles?${qs.toString()}`, {
    next: { revalidate: CACHE.lists, tags: [TAGS.articles] },
  })
  if (!res.ok) throw new Error(`CMS responded ${res.status}`)
  const json = (await res.json()) as PayloadListResponse<{ slug: string }>
  return json.docs[0]?.slug ?? null
}

/**
 * Search published articles through the CMS (i.e. Postgres `ILIKE`).
 *
 * The **fallback** used by /api/search when Meilisearch isn't configured, so
 * site search works with zero extra infrastructure.
 *
 * Payload's `like` splits the query on spaces and requires *every* word to
 * appear in the column, case-insensitively. So "gta 6" matches a title
 * containing both "gta" and "6" in any order — but a query whose words are
 * spread across the title *and* the excerpt won't match, since each branch of
 * the OR is evaluated on a single column.
 *
 * No typo tolerance and no relevance ranking, hence newest-first ordering. Good
 * enough at this article count; set MEILISEARCH_HOST to get the real thing.
 */
export interface ArticleSearch {
  q: string
  limit?: number
  page?: number
  /** CMS category value (`review`, not `reviews`). */
  category?: string
  /** Game slug. */
  game?: string
  /** Language of the results (the search API passes the page's). */
  locale?: Locale
  /** Games the query names: their articles match too. */
  gameIds?: string[]
}

export interface ArticleSearchResult {
  articles: Article[]
  total: number
  page: number
  totalPages: number
}

/**
 * The `where` of a site search. Payload nests an OR group inside the top-level
 * AND so the published filter (and the optional category / game) apply to every
 * branch:
 *   and[0]: status == published
 *   and[1]: title ~ q  OR  excerpt ~ q  OR  game name ~ q  OR  a tag name ~ q
 *   and[2]: category == …   (optional)
 *   and[3]: game slug == …  (optional)
 * Payload's `like` is case-insensitive and needs every word of `q` in the same
 * field, in any order.
 */
export function searchWhere(
  q: string,
  filters: { category?: string; game?: string; gameIds?: string[] } = {}
): URLSearchParams {
  const qs = new URLSearchParams({
    'where[and][0][status][equals]': 'published',
    'where[and][1][or][0][title][like]': q,
    'where[and][1][or][1][excerpt][like]': q,
    'where[and][1][or][2][game.name][like]': q,
    'where[and][1][or][3][tags.name][like]': q,
    // The French versions too: a search finds an article in either language.
    'where[and][1][or][4][fr.title][like]': q,
    'where[and][1][or][5][fr.excerpt][like]': q,
    'where[and][1][or][6][tags.nameFr][like]': q,
  })
  // Articles about the games the query names ("GTA" → Grand Theft Auto VI),
  // even when their title spells the name out.
  if (filters.gameIds?.length) {
    qs.set('where[and][1][or][7][game][in]', filters.gameIds.join(','))
    qs.set('where[and][1][or][8][relatedGames][in]', filters.gameIds.join(','))
  }
  if (filters.category) qs.set('where[and][2][category][equals]', filters.category)
  if (filters.game) qs.set('where[and][3][game.slug][equals]', filters.game)
  return qs
}

export async function searchArticles({
  q,
  limit = 20,
  page = 1,
  category,
  game,
  locale = 'en',
  gameIds,
}: ArticleSearch): Promise<ArticleSearchResult> {
  const qs = searchWhere(q, { category, game, gameIds })
  qs.set('sort', '-publishedAt')
  qs.set('depth', '1')
  qs.set('limit', String(limit))
  qs.set('page', String(page))

  const res = await cmsFetch(`${CMS_URL}/api/articles?${qs.toString()}`, {
    next: { revalidate: CACHE.lists, tags: [TAGS.articles] },
  })
  if (!res.ok) throw new Error(`CMS responded ${res.status}`)

  const json = (await res.json()) as PayloadListResponse<PayloadArticle>
  return {
    articles: json.docs.map(mapFor(locale)),
    total: json.totalDocs,
    page: json.page ?? page,
    totalPages: json.totalPages,
  }
}

/**
 * How many results the query has in each category (ignoring the category
 * filter itself), for the filter chips on /search. One tiny count query per
 * category, in parallel; a category that fails just shows no count.
 */
export async function searchCategoryCounts(
  q: string,
  categories: string[],
  game?: string,
  gameIds?: string[]
): Promise<Record<string, number>> {
  const counts = await Promise.all(
    categories.map(async (category) => {
      const qs = searchWhere(q, { category, game, gameIds })
      qs.set('limit', '1')
      qs.set('depth', '0')
      qs.set('select[id]', 'true')
      try {
        const res = await cmsFetch(`${CMS_URL}/api/articles?${qs.toString()}`, {
          next: { revalidate: CACHE.lists, tags: [TAGS.articles] },
        })
        if (!res.ok) return [category, 0] as const
        const json = (await res.json()) as PayloadListResponse<unknown>
        return [category, json.totalDocs] as const
      } catch {
        return [category, 0] as const
      }
    })
  )
  return Object.fromEntries(counts)
}

export interface GameSearchHit {
  slug: string
  name: string
  cover?: string
}

export interface GameListItem extends LibraryGame {
  id: string
  /** 'card' variant (960w): the /games grid and the search's game cards. */
  cover?: string
  /** First release (search ties). */
  releaseDate?: string
}

type RawRelease = { platforms?: unknown[] | null; date?: string | null; precision?: string | null }

/**
 * Consoles as populated by the CMS ({ slug }) → their slugs. A plain string
 * is already a slug (the CMS before its Platforms migration, during a deploy).
 */
export const platformSlugs = (v: unknown[] | null | undefined): string[] =>
  (v ?? []).flatMap((p) =>
    typeof p === 'string'
      ? [p]
      : p && typeof p === 'object' && 'slug' in p
        ? [String((p as { slug: string }).slug)]
        : [],
  )

/** Releases as the CMS stores them → the library's shape (day, no time, console slugs). */
export function mapReleases(rows: RawRelease[] | null | undefined): Release[] {
  return (rows ?? []).map((r) => {
    const precision = (['day', 'month', 'quarter', 'year', 'tba'] as const).find((p) => p === r.precision) ?? 'tba'
    const date = precision !== 'tba' && r.date ? r.date.slice(0, 10) : null
    return { platforms: platformSlugs(r.platforms), date, precision: date ? precision : 'tba' }
  })
}

export interface PlatformEntity extends PlatformInfo {
  id: string
  aliases: string[]
  /** The console's own release (YYYY-MM-DD + precision), when known. */
  release?: Release
  logo?: string
  tagId?: string
  /** Its tag's slug: an article tagged with it links here (`fetchTagPages`). */
  tagSlug?: string
}

/**
 * Every console (Platforms in the CMS), in the site's order: the library's
 * filter, the labels on game pages, the console pages. Cached 5 min.
 */
export async function fetchAllPlatforms(): Promise<PlatformEntity[]> {
  const qs = new URLSearchParams({ depth: '1', pagination: 'false', sort: 'position' })
  for (const f of ['url', 'filename', 'prefix', 'sizes][square][url']) qs.set(`populate[media][${f}]`, 'true')
  qs.set('populate[tags][slug]', 'true')
  const res = await cmsFetch(`${CMS_URL}/api/platforms?${qs.toString()}`, {
    next: { revalidate: CACHE.details, tags: [TAGS.taxonomy] },
  })
  if (!res.ok) throw new Error(`CMS responded ${res.status}`)
  const json = (await res.json()) as PayloadListResponse<{
    id: string | number
    slug: string
    name: string
    short?: string | null
    family?: string | null
    position?: number | null
    aliases?: string[] | null
    releaseDate?: string | null
    releasePrecision?: string | null
    logo?: PayloadMedia
    tag?: { id: string | number; slug?: string } | string | number | null
  }>
  const list = json.docs.map((d): PlatformEntity => {
    const tag = d.tag && typeof d.tag === 'object' ? d.tag.id : d.tag
    const tagSlug = d.tag && typeof d.tag === 'object' ? d.tag.slug : undefined
    const release = mapReleases([{ date: d.releaseDate, precision: d.releasePrecision }])[0]
    return {
      id: String(d.id),
      value: d.slug,
      label: d.name,
      short: d.short?.trim() || d.name,
      family: (PLATFORM_FAMILIES as readonly string[]).includes(d.family ?? '') ? (d.family as PlatformFamily) : 'other',
      position: Number(d.position ?? 0),
      aliases: d.aliases ?? [],
      ...(release.date ? { release } : {}),
      logo: mediaUrl(d.logo, 'square'),
      tagId: tag ? String(tag) : undefined,
      tagSlug,
    }
  })
  return sortPlatforms(list.map((p) => p.value), list).map((v) => list.find((p) => p.value === v)!)
}

export async function fetchPlatformBySlug(slug: string): Promise<PlatformEntity | null> {
  return (await fetchAllPlatforms()).find((p) => p.value === slug) ?? null
}

const companySlugs = (v: unknown[] | null | undefined) =>
  (v ?? []).flatMap((c) => (c && typeof c === 'object' && 'slug' in c ? [String((c as { slug: string }).slug)] : []))

/**
 * Every game on the site with its releases, A to Z: the games library
 * (/games) and the search's game matching (lib/game-match.ts). One request,
 * only the fields used (the list grows by itself: Next caches up to 2 MB a
 * response, about 3,000 games this way), cached 5 min.
 */
export async function fetchAllGames(): Promise<GameListItem[]> {
  const qs = new URLSearchParams({ depth: '1', pagination: 'false', sort: 'name' })
  for (const f of ['name', 'slug', 'cover', 'releases', 'releaseDate', 'developers', 'publishers', 'genre'])
    qs.set(`select[${f}]`, 'true')
  for (const f of ['url', 'filename', 'prefix', 'sizes][card][url', 'sizes][card][filename'])
    qs.set(`populate[media][${f}]`, 'true')
  qs.set('populate[companies][slug]', 'true')
  qs.set('populate[platforms][slug]', 'true')
  const res = await cmsFetch(`${CMS_URL}/api/games?${qs.toString()}`, {
    next: { revalidate: CACHE.details, tags: [TAGS.games] },
  })
  if (!res.ok) throw new Error(`CMS responded ${res.status}`)
  const json = (await res.json()) as PayloadListResponse<{
    id: string | number
    slug: string
    name: string
    cover?: PayloadMedia
    releaseDate?: string | null
    releases?: RawRelease[] | null
    developers?: unknown[] | null
    publishers?: unknown[] | null
    genre?: string[] | null
  }>
  return json.docs.map((doc) => ({
    id: String(doc.id),
    slug: doc.slug,
    name: doc.name,
    cover: mediaUrl(doc.cover, 'card'),
    releaseDate: doc.releaseDate ?? undefined,
    releases: mapReleases(doc.releases),
    developers: companySlugs(doc.developers),
    publishers: companySlugs(doc.publishers),
    genres: doc.genre ?? [],
  }))
}

export interface CompanyEntity extends LibraryCompany {
  id: string
  aliases: string[]
  logo?: string
  tagId?: string
}

export interface CompanyListItem extends LibraryCompany {
  aliases: string[]
  /** Its tag's slug, when it has one. */
  tagSlug?: string
}

/** Every studio and publisher (the library's filter, the search), A to Z, cached 5 min. */
export async function fetchAllCompanies(): Promise<CompanyListItem[]> {
  const qs = new URLSearchParams({ depth: '1', pagination: 'false', sort: 'name' })
  for (const f of ['name', 'slug', 'aliases', 'tag']) qs.set(`select[${f}]`, 'true')
  qs.set('populate[tags][slug]', 'true')
  const res = await cmsFetch(`${CMS_URL}/api/companies?${qs.toString()}`, {
    next: { revalidate: CACHE.details, tags: [TAGS.taxonomy] },
  })
  if (!res.ok) throw new Error(`CMS responded ${res.status}`)
  const json = (await res.json()) as PayloadListResponse<{
    slug: string
    name: string
    aliases?: string[] | null
    tag?: { slug?: string } | number | string | null
  }>
  return json.docs.map((d) => ({
    slug: d.slug,
    name: d.name,
    aliases: d.aliases ?? [],
    tagSlug: d.tag && typeof d.tag === 'object' ? d.tag.slug : undefined,
  }))
}

/** A console's or a studio's page, for the search and for the tags that stand for one. */
export interface EntityLink {
  kind: 'platform' | 'company'
  path: string
  name: string
}

/**
 * The tags that stand for a console or a studio ("PS5", "Rockstar Games") →
 * that page: an article's tag chip and the tag page link there.
 */
export async function fetchTagPages(): Promise<Map<string, EntityLink>> {
  const [platforms, companies] = await Promise.all([
    fetchAllPlatforms().catch(() => [] as PlatformEntity[]),
    fetchAllCompanies().catch(() => [] as CompanyListItem[]),
  ])
  const out = new Map<string, EntityLink>()
  for (const c of companies)
    if (c.tagSlug) out.set(c.tagSlug, { kind: 'company', path: `/company/${c.slug}`, name: c.name })
  for (const p of platforms)
    if (p.tagSlug) out.set(p.tagSlug, { kind: 'platform', path: `/platform/${p.value}`, name: p.label })
  return out
}

/** Consoles, then studios, the query names ("ps5", "rockstar"), for the search. */
export async function searchEntities(q: string, limit = 3): Promise<EntityLink[]> {
  const [platforms, companies] = await Promise.all([
    fetchAllPlatforms().catch(() => [] as PlatformEntity[]),
    fetchAllCompanies().catch(() => [] as CompanyListItem[]),
  ])
  const consoles = matchEntities(
    platforms.map((p) => ({ ...p, names: [p.label, p.short, p.value, ...p.aliases] })),
    q,
    limit,
  ).map((p): EntityLink => ({ kind: 'platform', path: `/platform/${p.value}`, name: p.label }))
  const studios = matchEntities(
    companies.map((c) => ({ ...c, names: [c.name, ...c.aliases] })),
    q,
    limit,
  ).map((c): EntityLink => ({ kind: 'company', path: `/company/${c.slug}`, name: c.name }))
  return [...consoles, ...studios].slice(0, limit)
}

export async function fetchCompanyBySlug(slug: string): Promise<CompanyEntity | null> {
  const doc = await fetchOneBySlug<{
    id: string | number
    slug: string
    name: string
    aliases?: string[] | null
    logo?: PayloadMedia
    tag?: { id: string | number } | string | number | null
  }>('companies', slug)
  if (!doc) return null
  const tag = doc.tag && typeof doc.tag === 'object' ? doc.tag.id : doc.tag
  return {
    id: String(doc.id),
    slug: doc.slug,
    name: doc.name,
    aliases: doc.aliases ?? [],
    logo: mediaUrl(doc.logo, 'square'),
    tagId: tag ? String(tag) : undefined,
  }
}

/**
 * Games matching a query, best first: "GTA" finds Grand Theft Auto VI, "cod"
 * Call of Duty (initials, numbers, starts of words: lib/game-match.ts).
 */
export async function searchGames(q: string, limit = 3): Promise<GameSearchHit[]> {
  return matchGames(await fetchAllGames(), q, limit).map((g) => ({
    slug: g.slug,
    name: g.name,
    cover: g.cover,
  }))
}

/** Name of a game from its slug, for the "Game: …" filter chip on /search. */
export async function fetchGameName(slug: string): Promise<string | null> {
  const qs = new URLSearchParams({
    'where[slug][equals]': slug,
    depth: '0',
    limit: '1',
    'select[name]': 'true',
  })
  const res = await cmsFetch(`${CMS_URL}/api/games?${qs.toString()}`, {
    next: { revalidate: CACHE.details, tags: [TAGS.games] },
  })
  if (!res.ok) return null
  const json = (await res.json()) as PayloadListResponse<{ name: string }>
  return json.docs[0]?.name ?? null
}

// ─── Article page: related + previous/next ───────────────────────────────────

/** Run an articles query and map the results. Shared by the helpers below. */
async function fetchArticleList(qs: URLSearchParams): Promise<Article[]> {
  // Not the article lists' tag: a new article doesn't rebuild every article
  // page for its "Read next" and prev / next links (they catch up within the
  // hour). Their own tag goes when a cover changes (lib/revalidate-web.ts).
  const res = await cmsFetch(`${CMS_URL}/api/articles?${qs.toString()}`, {
    next: { revalidate: CACHE.details, tags: [TAGS.extras] },
  })
  if (!res.ok) throw new Error(`CMS responded ${res.status}`)
  const json = (await res.json()) as PayloadListResponse<PayloadArticle>
  return json.docs.map(mapArticle)
}

/** Published + "not this article" — the base of every query on this page. */
function baseParams(excludeId: string): URLSearchParams {
  const qs = new URLSearchParams({
    'where[and][0][status][equals]': 'published',
    'where[and][1][id][not_equals]': excludeId,
    depth: '1',
  })
  return qs
}

/**
 * Articles to suggest at the end of `article`.
 *
 * Same game first (the strongest signal a reader cares about), then topped up
 * with the same category so the section is never half-empty on a game with only
 * one article. Returns fewer than `limit` — or nothing — rather than padding
 * with unrelated content.
 */
export async function fetchRelatedArticles(article: Article, limit = 3): Promise<Article[]> {
  const collected: Article[] = []
  const seen = new Set<string>([article.id])

  const push = (articles: Article[]) => {
    for (const a of articles) {
      if (collected.length >= limit) return
      if (seen.has(a.id)) continue
      seen.add(a.id)
      collected.push(a)
    }
  }

  if (article.game?.id) {
    const qs = baseParams(article.id)
    qs.set('where[and][2][game][equals]', article.game.id)
    qs.set('sort', '-publishedAt')
    qs.set('limit', String(limit))
    push(await fetchArticleList(qs))
  }

  if (collected.length < limit) {
    const qs = baseParams(article.id)
    qs.set('where[and][2][category][equals]', article.category)
    qs.set('sort', '-publishedAt')
    // Over-fetch a little: some results may already be in `collected`.
    qs.set('limit', String(limit * 2))
    push(await fetchArticleList(qs))
  }

  return collected
}

/**
 * The articles published immediately before and after this one, for the
 * prev/next footer. `previous` is older, `next` is newer — reading order.
 *
 * Unpublished articles have no `publishedAt` to compare against, so they get no
 * neighbours.
 */
export async function fetchAdjacentArticles(
  article: Article
): Promise<{ next: Article | null; previous: Article | null }> {
  if (!article.publishedAt) return { next: null, previous: null }

  const olderParams = baseParams(article.id)
  olderParams.set('where[and][2][publishedAt][less_than]', article.publishedAt)
  olderParams.set('sort', '-publishedAt')
  olderParams.set('limit', '1')

  const newerParams = baseParams(article.id)
  newerParams.set('where[and][2][publishedAt][greater_than]', article.publishedAt)
  newerParams.set('sort', 'publishedAt')
  newerParams.set('limit', '1')

  const [older, newer] = await Promise.all([
    fetchArticleList(olderParams),
    fetchArticleList(newerParams),
  ])

  return { next: newer[0] ?? null, previous: older[0] ?? null }
}

// ─── Entity fetchers (author / game / tag) ───────────────────────────────────

export interface AuthorEntity {
  id: string
  slug: string
  name: string
  avatar?: string
  bio?: string
  twitter?: string
}

export interface GameEntity {
  id: string
  slug: string
  name: string
  cover?: string
  /** Every console of its releases, in the site's order. */
  platforms: string[]
  releases: Release[]
  genre: string[]
  developers: LibraryCompany[]
  publishers: LibraryCompany[]
}

export interface TagEntity {
  id: string
  slug: string
  name: string
}

const ENTITY_TAG: Record<string, (slug: string) => string> = {
  authors: TAGS.author,
  games: TAGS.game,
  tags: TAGS.tag,
  companies: TAGS.company,
}

// Generic helper: fetch one doc from a collection by slug.
async function fetchOneBySlug<T>(collection: string, slug: string): Promise<T | null> {
  const qs = new URLSearchParams({
    'where[slug][equals]': slug,
    depth: '1',
    limit: '1',
  })
  const res = await cmsFetch(`${CMS_URL}/api/${collection}?${qs.toString()}`, {
    next: { revalidate: CACHE.details, tags: ENTITY_TAG[collection] ? [ENTITY_TAG[collection](slug)] : [] },
  })
  if (!res.ok) throw new Error(`CMS responded ${res.status}`)
  const json = (await res.json()) as PayloadListResponse<T>
  return json.docs[0] ?? null
}

export async function fetchAuthorBySlug(slug: string): Promise<AuthorEntity | null> {
  const doc = await fetchOneBySlug<{
    id: string | number
    slug: string
    name: string
    avatar?: { url?: string } | string | null
    bio?: string
    bioFr?: string | null
    twitter?: string
  }>('authors', slug)
  if (!doc) return null
  return {
    id: String(doc.id),
    slug: doc.slug,
    name: doc.name,
    avatar: mediaUrl(doc.avatar, 'square'),
    bio: doc.bio ? pick(getLocale(), doc.bio, doc.bioFr) : doc.bio,
    twitter: doc.twitter,
  }
}

export async function fetchGameBySlug(slug: string): Promise<GameEntity | null> {
  const doc = await fetchOneBySlug<{
    id: string | number
    slug: string
    name: string
    cover?: { url?: string } | string | null
    platforms?: unknown[] | null
    releases?: RawRelease[] | null
    genre?: string[] | null
    developers?: Array<{ slug: string; name: string } | number> | null
    publishers?: Array<{ slug: string; name: string } | number> | null
  }>('games', slug)
  if (!doc) return null
  const companies = (v: typeof doc.developers) =>
    (v ?? []).flatMap((c) => (typeof c === 'object' && c ? [{ slug: c.slug, name: c.name }] : []))
  return {
    id: String(doc.id),
    slug: doc.slug,
    name: doc.name,
    // Game covers render at ~320 CSS px → 'card' (960w) is plenty at 2x.
    cover: mediaUrl(doc.cover, 'card'),
    platforms: sortPlatforms(platformSlugs(doc.platforms), await fetchAllPlatforms().catch(() => [])),
    releases: mapReleases(doc.releases).sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999')),
    genre: doc.genre ?? [],
    developers: companies(doc.developers),
    publishers: companies(doc.publishers),
  }
}

export async function fetchTagBySlug(slug: string): Promise<TagEntity | null> {
  const doc = await fetchOneBySlug<{ id: string | number; slug: string; name: string; nameFr?: string | null }>(
    'tags',
    slug
  )
  if (!doc) return null
  return { id: String(doc.id), slug: doc.slug, name: pick(getLocale(), doc.name, doc.nameFr) }
}

// ─── Live showcase pages ─────────────────────────────────────────────────────

/**
 * Ids of the articles covering a showcase live right now (the scout's live
 * mode). They stay in English until the live ends, then get translated
 * (apps/cms/src/lib/translate.ts); the French page says so meanwhile.
 * Nothing on error: the page then just says "not translated yet".
 */
export async function fetchLiveArticleIds(): Promise<string[]> {
  try {
    // A live starting or ending doesn't ping the site: 5 min at most.
    const res = await cmsFetch(`${CMS_URL}/api/live-articles`, { next: { revalidate: CACHE.lists } })
    if (!res.ok) return []
    const json = (await res.json()) as { ids?: Array<number | string> }
    return (json.ids ?? []).map(String)
  } catch {
    return []
  }
}

// ─── Sitemap helpers ─────────────────────────────────────────────────────────

export interface SlugEntry {
  slug: string
  updatedAt?: string
  /** Articles: the French version exists (the sitemap only lists /fr then). */
  translated?: boolean
}

// All published article slugs (+ last-modified) for the sitemap.
export async function fetchAllArticleSlugs(): Promise<SlugEntry[]> {
  const qs = new URLSearchParams({
    'where[status][equals]': 'published',
    depth: '0',
    limit: '1000',
    sort: '-publishedAt',
  })
  const res = await cmsFetch(`${CMS_URL}/api/articles?${qs.toString()}`, {
    next: { revalidate: CACHE.lists, tags: [TAGS.articles] },
  })
  if (!res.ok) throw new Error(`CMS responded ${res.status}`)
  const json = (await res.json()) as PayloadListResponse<{
    slug: string
    updatedAt?: string
    fr?: { title?: string | null } | null
  }>
  return json.docs.map((d) => ({ slug: d.slug, updatedAt: d.updatedAt, translated: Boolean(d.fr?.title) }))
}

/** Articles published since `sinceIso` (the Google News sitemap), newest first. */
export async function fetchRecentArticles(
  sinceIso: string
): Promise<Array<{ slug: string; title: string; publishedAt: string; frTitle?: string }>> {
  const qs = new URLSearchParams({
    'where[status][equals]': 'published',
    'where[publishedAt][greater_than]': sinceIso,
    depth: '0',
    limit: '1000',
    sort: '-publishedAt',
    'select[slug]': 'true',
    'select[title]': 'true',
    'select[publishedAt]': 'true',
    'select[fr]': 'true',
  })
  const res = await cmsFetch(`${CMS_URL}/api/articles?${qs.toString()}`, {
    next: { revalidate: CACHE.lists, tags: [TAGS.articles] },
  })
  if (!res.ok) throw new Error(`CMS responded ${res.status}`)
  const json = (await res.json()) as PayloadListResponse<{
    slug: string
    title: string
    publishedAt?: string | null
    fr?: { title?: string | null } | null
  }>
  return json.docs.flatMap((d) =>
    d.publishedAt
      ? [{ slug: d.slug, title: d.title, publishedAt: d.publishedAt, ...(d.fr?.title ? { frTitle: d.fr.title } : {}) }]
      : []
  )
}

// All slugs of a simple collection (authors / games / tags) for the sitemap.
export async function fetchAllEntitySlugs(
  collection: 'authors' | 'games' | 'tags' | 'companies' | 'platforms'
): Promise<(SlugEntry & { id: string })[]> {
  const qs = new URLSearchParams({ depth: '0', pagination: 'false', 'select[slug]': 'true', 'select[updatedAt]': 'true' })
  const res = await cmsFetch(`${CMS_URL}/api/${collection}?${qs.toString()}`, {
    // The sitemap's list: new games come with the scout's articles.
    next: { revalidate: CACHE.lists, tags: [TAGS.articles, TAGS.games] },
  })
  if (!res.ok) throw new Error(`CMS responded ${res.status}`)
  const json = (await res.json()) as PayloadListResponse<{
    id: string | number
    slug: string
    updatedAt?: string
  }>
  return json.docs.map((d) => ({ id: String(d.id), slug: d.slug, updatedAt: d.updatedAt }))
}

/**
 * IDs of the authors, games and tags that at least one *published* article
 * points to. The sitemap uses this to leave out taxonomy pages that would only
 * say "no articles yet" — thin pages that dilute a small site in search results.
 * One request, relationship IDs only (`depth: 0` + `select`).
 */
export async function fetchUsedTaxonomyIds(): Promise<{
  authors: Set<string>
  games: Set<string>
  tags: Set<string>
}> {
  const qs = new URLSearchParams({
    'where[status][equals]': 'published',
    depth: '0',
    limit: '1000',
    'select[author]': 'true',
    'select[game]': 'true',
    'select[tags]': 'true',
  })
  const res = await cmsFetch(`${CMS_URL}/api/articles?${qs.toString()}`, {
    next: { revalidate: CACHE.lists, tags: [TAGS.articles] },
  })
  if (!res.ok) throw new Error(`CMS responded ${res.status}`)
  const json = (await res.json()) as PayloadListResponse<{
    author?: string | number | null
    game?: string | number | null
    tags?: (string | number)[] | null
  }>

  const used = { authors: new Set<string>(), games: new Set<string>(), tags: new Set<string>() }
  for (const doc of json.docs) {
    if (doc.author != null) used.authors.add(String(doc.author))
    if (doc.game != null) used.games.add(String(doc.game))
    for (const t of doc.tags ?? []) used.tags.add(String(t))
  }
  return used
}

// ─── Esport matches (PandaScore, synced by the CMS) ──────────────────────────

const ESPORT_FIELDS = [
  'pandaId', 'game', 'status', 'name', 'scheduledAt', 'beginAt', 'endAt', 'bestOf',
  'team1', 'team2', 'score1', 'score2', 'winner', 'forfeit', 'streamUrl', 'tournament',
]

/**
 * The results (finished in the last 3 days) or the calendar (on now and the
 * next 7 days). The window moves once a day (midnight UTC), so the URL, and
 * the cache with it, holds all day; the sync's new rows show within 5 min.
 */
export async function fetchEsportMatches(kind: 'results' | 'calendar'): Promise<EsportRow[]> {
  const DAY = 24 * 3600 * 1000
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const t0 = today.getTime()
  const qs = new URLSearchParams()
  if (kind === 'results') {
    qs.set('where[status][equals]', 'finished')
    qs.set('where[endAt][greater_than_equal]', new Date(t0 - 3 * DAY).toISOString())
    qs.set('sort', '-endAt')
  } else {
    qs.set('where[status][in]', 'not_started,running')
    qs.set('where[beginAt][greater_than_equal]', new Date(t0 - DAY).toISOString())
    qs.set('where[beginAt][less_than]', new Date(t0 + 8 * DAY).toISOString())
    qs.set('sort', 'beginAt')
  }
  qs.set('limit', '1000')
  qs.set('depth', '1')
  for (const f of ESPORT_FIELDS) qs.set(`select[${f}]`, 'true')
  for (const f of ['pandaId', 'name', 'league', 'serie', 'tier']) qs.set(`populate[esport-tournaments][${f}]`, 'true')
  const res = await cmsFetch(`${CMS_URL}/api/esport-matches?${qs.toString()}`, {
    next: { revalidate: CACHE.lists, tags: [TAGS.esport] },
  })
  if (!res.ok) throw new Error(`CMS esport matches: ${res.status}`)
  const json = (await res.json()) as { docs?: Array<Record<string, unknown>> }
  return (json.docs ?? []).map(rowOf).filter((r): r is EsportRow => r !== null)
}
