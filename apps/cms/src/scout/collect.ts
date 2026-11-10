// ─── Collect ─────────────────────────────────────────────────────────────────
// Reads every source that is due (official every 5 min, the rest every 15)
// and stores the items it hasn't seen yet as `scout-items` with status "new".

import { DEFAULT_SOURCES, isGamingItem } from './default-sources'
import type { ScoutContext, SourceDoc } from './context'
import { parseFeed, type FeedItem } from './feeds'
import { USER_AGENT } from './extract'
import { isDue } from './schedule'

const CONCURRENCY = 6
/** Per feed and run: a feed that dumps 100 items at once doesn't flood the triage. */
const MAX_ITEMS_PER_FEED = 30
/**
 * Items older than this are ignored. Mainly for a feed's first read, which
 * would otherwise import its whole backlog as "news".
 */
const MAX_AGE_MS = 48 * 3_600_000

/** Load the default list into an empty `scout-sources` (first run only). */
export async function ensureSources(ctx: ScoutContext): Promise<number> {
  const { totalDocs } = await ctx.payload.count({
    collection: 'scout-sources',
    overrideAccess: true,
  })
  if (totalDocs > 0) return 0
  for (const s of DEFAULT_SOURCES) {
    await ctx.payload.create({
      collection: 'scout-sources',
      data: { ...s, kind: 'rss', general: s.general ?? false, active: true },
      overrideAccess: true,
    })
  }
  ctx.payload.logger.info({ msg: '[scout] default sources loaded', count: DEFAULT_SOURCES.length })
  return DEFAULT_SOURCES.length
}

type FetchOutcome =
  | { kind: 'items'; items: FeedItem[]; etag?: string; lastModified?: string }
  | { kind: 'not-modified' }
  | { kind: 'error'; message: string }

async function fetchFeed(ctx: ScoutContext, source: SourceDoc): Promise<FetchOutcome> {
  try {
    const headers: Record<string, string> = {
      'user-agent': USER_AGENT,
      accept:
        'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
    }
    if (source.etag) headers['if-none-match'] = source.etag
    if (source.lastModified) headers['if-modified-since'] = source.lastModified
    const res = await ctx.fetch(source.url, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    })
    if (res.status === 304) return { kind: 'not-modified' }
    if (!res.ok) return { kind: 'error', message: `HTTP ${res.status}` }
    const body = await res.text()
    if (body.length > 5_000_000) return { kind: 'error', message: 'feed larger than 5 MB' }
    const items = parseFeed(body)
    if (items.length === 0 && !/<(rss|feed|rdf:RDF)\b/i.test(body)) {
      return { kind: 'error', message: 'not an RSS/Atom feed' }
    }
    return {
      kind: 'items',
      items,
      etag: res.headers.get('etag') ?? undefined,
      lastModified: res.headers.get('last-modified') ?? undefined,
    }
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : String(err) }
  }
}

/** Store the items of one feed that are new, recent and (for general outlets) about games. */
async function storeItems(
  ctx: ScoutContext,
  source: SourceDoc,
  items: FeedItem[],
): Promise<number> {
  const now = ctx.now.getTime()
  const candidates = items
    .slice(0, MAX_ITEMS_PER_FEED)
    .filter((i) => !i.publishedAt || now - i.publishedAt.getTime() <= MAX_AGE_MS)
    .filter((i) => !source.general || isGamingItem(i.title, i.summary))
  if (candidates.length === 0) return 0

  const { docs: existing } = await ctx.payload.find({
    collection: 'scout-items',
    where: { url: { in: candidates.map((i) => i.url) } },
    limit: candidates.length,
    depth: 0,
    select: { url: true },
    overrideAccess: true,
  })
  const seen = new Set((existing as unknown as Array<{ url: string }>).map((d) => d.url))

  let stored = 0
  for (const item of candidates) {
    if (seen.has(item.url)) continue
    seen.add(item.url) // the same URL twice in one feed
    try {
      await ctx.payload.create({
        collection: 'scout-items',
        data: {
          title: item.title,
          url: item.url,
          summary: item.summary,
          publishedAt: (item.publishedAt ?? ctx.now).toISOString(),
          source: source.id,
          status: 'new',
        },
        overrideAccess: true,
      })
      stored++
    } catch {
      // Unique index on url: another run stored it in the meantime.
    }
  }
  return stored
}

export interface CollectReport {
  fetched: number
  stored: number
  errors: number
}

export async function collect(ctx: ScoutContext): Promise<CollectReport> {
  const { docs } = await ctx.payload.find({
    collection: 'scout-sources',
    where: { and: [{ active: { equals: true } }, { kind: { equals: 'rss' } }] },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  const due = (docs as unknown as SourceDoc[]).filter((s) =>
    isDue(s.lastFetchedAt ? new Date(s.lastFetchedAt) : null, s.cadence, ctx.now),
  )

  const report: CollectReport = { fetched: 0, stored: 0, errors: 0 }
  const queue = [...due]
  const worker = async () => {
    for (let source = queue.shift(); source; source = queue.shift()) {
      const outcome = await fetchFeed(ctx, source)
      report.fetched++
      let lastStatus = 'ok'
      const data: Record<string, unknown> = { lastFetchedAt: ctx.now.toISOString() }
      if (outcome.kind === 'error') {
        report.errors++
        lastStatus = outcome.message.slice(0, 200)
        data.consecutiveFailures = (source.consecutiveFailures ?? 0) + 1
      } else {
        data.consecutiveFailures = 0
        if (outcome.kind === 'not-modified') {
          lastStatus = 'not modified'
        } else {
          const stored = await storeItems(ctx, source, outcome.items)
          report.stored += stored
          lastStatus = `ok, ${stored} new`
          if (outcome.etag) data.etag = outcome.etag
          if (outcome.lastModified) data.lastModified = outcome.lastModified
        }
      }
      data.lastStatus = lastStatus
      await ctx.payload.update({
        collection: 'scout-sources',
        id: source.id,
        data,
        overrideAccess: true,
      })
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))
  return report
}
