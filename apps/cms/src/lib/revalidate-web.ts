// ─── Tell the website something changed ──────────────────────────────────────
// The site caches its CMS reads (ISR: 5 min for lists, 1 h for the rest).
// After a change that the public can see, the CMS pings the site's
// /api/revalidate with the cache tags of what changed: the article, the
// lists, its games, tags, author, and the studio and console pages they lead
// to. Only those pages rebuild (apps/web/src/lib/revalidate.ts, `TAGS`), not
// the whole site: a full flush on every scout save cost ~15K Vercel ISR
// writes a day (2026-11-19).
//
// Off unless REVALIDATE_SECRET is set (same value on the CMS and the site).
// Fire-and-forget: a failure is logged and the cache timers still catch up.
// Renames (a studio, a tag) only refresh their own page; the pages that show
// the name elsewhere catch up within the hour.

import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  Payload,
  PayloadHandler,
} from 'payload'
import { isEditorUser } from '../access/roles'

/** Same cap as the site's (apps/web/src/lib/revalidate.ts). */
const MAX_TAGS = 100

const webUrl = () => (process.env.WEB_URL || 'http://localhost:3000').replace(/\/+$/, '')

/** Whether a saved document changes what the public sees (drafts don't). */
export function isPublicChange(
  doc: { _status?: string | null; status?: string | null } | null | undefined,
  previousDoc?: { _status?: string | null; status?: string | null } | null,
): boolean {
  const live = (d?: typeof doc) =>
    !!d && (d._status === undefined ? true : d._status === 'published') && d.status !== 'draft'
  return live(doc) || live(previousDoc)
}

type Ref = number | string | { id?: number | string; slug?: string | null } | null | undefined
type Doc = Record<string, unknown> | null | undefined

const idOf = (r: Ref): number | string | undefined =>
  r == null ? undefined : typeof r === 'object' ? r.id : r

const refs = (v: unknown): Ref[] => (Array.isArray(v) ? (v as Ref[]) : v == null ? [] : [v as Ref])

const ids = (...vals: unknown[]): Array<number | string> => [
  ...new Set(
    vals
      .flatMap(refs)
      .map(idOf)
      .filter((x): x is number | string => x != null && x !== ''),
  ),
]

const slugOf = (d: Doc): string | undefined =>
  d && typeof d.slug === 'string' && d.slug ? d.slug : undefined

/** Slugs of these documents (read without the hook's transaction). */
async function slugsOf(
  payload: Payload,
  collection: 'articles' | 'games' | 'tags' | 'authors' | 'companies' | 'platforms',
  where: Record<string, unknown>,
): Promise<string[]> {
  const res = await payload.find({
    collection,
    where,
    limit: 200,
    depth: 0,
    pagination: false,
    select: { slug: true },
    overrideAccess: true,
  } as never)
  return (res.docs as Array<{ slug?: string | null }>).map((d) => d.slug ?? '').filter(Boolean)
}

/** The files of an image (original and sizes), to tell a new file from a text edit. */
const filesOf = (d: Doc): string => {
  if (!d) return ''
  const sizes = (d.sizes ?? {}) as Record<string, { filename?: string | null } | null>
  return [
    d.filename,
    ...Object.keys(sizes)
      .sort()
      .map((k) => sizes[k]?.filename ?? ''),
  ].join('|')
}

/**
 * The site's cache tags a change drops (same strings as the site's `TAGS`).
 * Reads the related documents' slugs, so it's async; the hook doesn't wait.
 * `null`: drop everything (an image's file changed: its old URLs may be on
 * any page, a logo, an avatar, a "Read next" card).
 */
export async function tagsFor(
  payload: Payload,
  collection: string,
  doc: Doc,
  previousDoc?: Doc,
): Promise<string[] | null> {
  const tags = new Set<string>()
  const own = (prefix: string) => {
    for (const s of [slugOf(doc), slugOf(previousDoc)]) if (s) tags.add(`${prefix}:${s}`)
  }
  switch (collection) {
    case 'articles': {
      tags.add('articles')
      own('article')
      const gameIds = ids(
        doc?.game,
        doc?.relatedGames,
        previousDoc?.game,
        previousDoc?.relatedGames,
      )
      const tagIds = ids(doc?.tags, previousDoc?.tags)
      const authorIds = ids(doc?.author, previousDoc?.author)
      const [games, tagSlugs, authors] = await Promise.all([
        gameIds.length
          ? payload.find({
              collection: 'games',
              where: { id: { in: gameIds } },
              limit: 200,
              depth: 0,
              pagination: false,
              select: { slug: true, developers: true, publishers: true, platforms: true },
              overrideAccess: true,
            } as never)
          : null,
        tagIds.length ? slugsOf(payload, 'tags', { id: { in: tagIds } }) : [],
        authorIds.length ? slugsOf(payload, 'authors', { id: { in: authorIds } }) : [],
      ])
      const gameDocs = (games?.docs ?? []) as unknown as Doc[]
      for (const g of gameDocs) if (slugOf(g)) tags.add(`game:${slugOf(g)}`)
      for (const s of tagSlugs) tags.add(`tag:${s}`)
      for (const s of authors) tags.add(`author:${s}`)
      // Studio and console pages list the articles about their games or tag.
      const companyIds = ids(...gameDocs.flatMap((g) => [g?.developers, g?.publishers]))
      const platformIds = ids(...gameDocs.map((g) => g?.platforms))
      const linked = (col: 'companies' | 'platforms', own: Array<number | string>) => {
        const or = [
          ...(own.length ? [{ id: { in: own } }] : []),
          ...(tagIds.length ? [{ tag: { in: tagIds } }] : []),
        ]
        return or.length ? slugsOf(payload, col, { or }) : Promise.resolve([])
      }
      const [companies, platforms] = await Promise.all([
        linked('companies', companyIds),
        linked('platforms', platformIds),
      ])
      for (const s of companies) tags.add(`company:${s}`)
      for (const s of platforms) tags.add(`platform:${s}`)
      break
    }
    case 'games':
      tags.add('games')
      own('game')
      break
    case 'tags':
      own('tag')
      break
    case 'authors':
      own('author')
      break
    case 'companies':
      tags.add('taxonomy')
      own('company')
      break
    case 'platforms':
      tags.add('taxonomy')
      own('platform')
      break
    case 'media': {
      // A new file (replaced, or its sizes made again): the old ones are
      // deleted, so every page that may link them must go (2026-11-23: after
      // the WebP conversion, "Read next" cards, console and studio pages kept
      // the deleted JPEG sizes for up to an hour).
      if (previousDoc && filesOf(doc) !== filesOf(previousDoc)) return null
      // A cover's credit or alt text: the articles and games showing it.
      const id = idOf(doc as Ref)
      if (id == null) break
      const [articles, games] = await Promise.all([
        slugsOf(payload, 'articles', { coverImage: { in: [id] } }),
        slugsOf(payload, 'games', { cover: { in: [id] } }),
      ])
      for (const s of articles) tags.add(`article:${s}`)
      for (const s of games) tags.add(`game:${s}`)
      if (articles.length) tags.add('articles').add('article-extras')
      if (games.length) tags.add('games')
      break
    }
  }
  return [...tags]
}

/**
 * Ping the site. Without `tags` (or if they can't be worked out), the site
 * drops all its CMS cache; with an empty list there's nothing to drop.
 */
export function revalidateWeb(
  payload: Payload,
  reason: string,
  tags?: () => Promise<string[] | null>,
): void {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret) return
  void (async () => {
    let list: string[] | undefined
    if (tags) {
      try {
        list = (await tags()) ?? undefined
      } catch (err) {
        payload.logger.warn({
          msg: '[revalidate] tags failed, full refresh',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    if (list && !list.length) return null
    return fetch(`${webUrl()}/api/revalidate`, {
      method: 'POST',
      headers: { 'x-revalidate-secret': secret, 'content-type': 'application/json' },
      // Too many (a huge round-up): a full refresh is as cheap.
      body: JSON.stringify(
        list?.length && list.length <= MAX_TAGS ? { reason, tags: list } : { reason },
      ),
      signal: AbortSignal.timeout(8_000),
    })
  })()
    .then((res) => {
      if (res && !res.ok)
        payload.logger.warn({ msg: '[revalidate] web refused', status: res.status })
    })
    .catch((err) =>
      payload.logger.warn({
        msg: '[revalidate] web unreachable',
        error: err instanceof Error ? err.message : String(err),
      }),
    )
}

/** afterChange: refresh the site when a public document changes. */
export const revalidateAfterChange: CollectionAfterChangeHook = ({
  doc,
  previousDoc,
  req,
  collection,
}) => {
  if (isPublicChange(doc, previousDoc)) {
    // A draft side (unpublished before, or now) has nothing cached to drop.
    const prev = isPublicChange(previousDoc) ? previousDoc : undefined
    revalidateWeb(req.payload, `${collection.slug} ${doc.id}`, () =>
      tagsFor(req.payload, collection.slug, doc, prev),
    )
  }
  return doc
}

/**
 * POST /api/revalidate-web (editors): drop the site's whole CMS cache. For a
 * page showing something stale that no hook covers. Rarely needed.
 */
export const revalidateAllHandler: PayloadHandler = async (req) => {
  if (!req.user || req.user.collection !== 'users')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (!isEditorUser(req.user)) return Response.json({ error: 'editors only' }, { status: 403 })
  if (!process.env.REVALIDATE_SECRET)
    return Response.json({ error: 'REVALIDATE_SECRET unset' }, { status: 503 })
  revalidateWeb(req.payload, `manual, ${req.user.email ?? 'editor'}`)
  return Response.json({ ok: true })
}

/** afterChange for media: a new upload isn't on any page yet, an edit may be. */
export const revalidateAfterUpdate: CollectionAfterChangeHook = (args) =>
  args.operation === 'update' ? revalidateAfterChange(args) : args.doc

/** afterDelete: refresh the site when a public document goes away. */
export const revalidateAfterDelete: CollectionAfterDeleteHook = ({ doc, req, collection }) => {
  if (isPublicChange(doc)) {
    revalidateWeb(req.payload, `${collection.slug} ${doc.id} deleted`, () =>
      tagsFor(req.payload, collection.slug, doc),
    )
  }
  return doc
}
