// ─── Esport follows and the readers' notifications (2026-11-25) ──────────────
// A reader follows a team, an event (a PandaScore season: all its stages) or a
// match on the site; the esport sync (esport/sync.ts) and article publishing
// (collections/Articles.ts) turn what happens to them into notifications: a
// match starting, its result, a news naming a followed team. The site's bell
// lists them (`/api/notifications`), wording them in the page's language.
// Web push comes on top (same notifications).
//
// The site calls the handlers below with READER_API_SECRET, as the signed-in
// reader (like saved articles, src/lib/readers.ts).

import type { Payload, PayloadHandler } from 'payload'
import {
  checkSecret,
  ensureReader,
  findReader,
  isClerkId,
  json,
  readBody,
  writerFrom,
} from './readers'
import { sendPush } from './web-push'

export const FOLLOW_KINDS = ['team', 'event', 'match'] as const
export type FollowKind = (typeof FOLLOW_KINDS)[number]

/** At most this many esport follows per reader. */
export const MAX_ESPORT_FOLLOWS = 300
/** Notifications are kept this long. */
export const NOTIFICATION_DAYS = 30

export interface FollowInput {
  kind: FollowKind
  pandaId: number
  game: string | null
  label: string
  acronym: string | null
  logo: string | null
  slug: string | null
  at: string | null
}

const text = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null

/** A follow sent by the site, checked field by field (null when unusable). */
export function followFromBody(raw: unknown): FollowInput | null {
  const b = (raw ?? {}) as Record<string, unknown>
  const kind = b.kind as FollowKind
  const pandaId = Number(b.pandaId)
  const label = text(b.label, 120)
  if (!FOLLOW_KINDS.includes(kind) || !Number.isInteger(pandaId) || pandaId <= 0 || !label)
    return null
  const logo = text(b.logo, 500)
  return {
    kind,
    pandaId,
    game: text(b.game, 20),
    label,
    acronym: text(b.acronym, 20),
    // Only PandaScore's image CDN: the site shows it.
    logo: logo && /^https:\/\/cdn(-api)?\.pandascore\.co\//.test(logo) ? logo : null,
    slug: (() => {
      const s = text(b.slug, 160)
      return s && /^[a-z0-9-]+$/.test(s) ? s : null
    })(),
    at: text(b.at, 40),
  }
}

// ─── What happened (pure) ────────────────────────────────────────────────────

export interface EventTeam {
  id: number | null
  name: string
  acronym: string | null
  logo: string | null
}

export interface MatchEvent {
  type: 'start' | 'end'
  matchId: number
  game: string
  serieId: number | null
  event: string
  stage: string
  slug: string | null
  t1: EventTeam
  t2: EventTeam
  s1: number | null
  s2: number | null
  winner: 1 | 2 | null
}

/** A match's status change seen by the sync → the event to notify, if any. */
export function transitionOf(
  before: string | null | undefined,
  after: string,
): 'start' | 'end' | null {
  if (!before || before === after) return null
  if (after === 'running' && before === 'not_started') return 'start'
  if (after === 'finished' && (before === 'not_started' || before === 'running')) return 'end'
  return null
}

export interface FollowRow {
  reader: number | string
  kind: FollowKind
  pandaId: number
  label: string
  acronym?: string | null
}

/** The readers who follow one of the match's teams, its event or the match itself. */
export function recipientsFor(e: MatchEvent, follows: FollowRow[]): Set<string> {
  const out = new Set<string>()
  for (const f of follows) {
    const hit =
      (f.kind === 'team' && (f.pandaId === e.t1.id || f.pandaId === e.t2.id)) ||
      (f.kind === 'event' && e.serieId !== null && f.pandaId === e.serieId) ||
      (f.kind === 'match' && f.pandaId === e.matchId)
    if (hit) out.add(String(f.reader))
  }
  return out
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Does this text name the team? Its full name anywhere (any case, whole
 * words), or its acronym in capitals when 3+ letters ("NIP", not "G2" or "9z").
 */
export function mentionsTeam(
  text: string,
  team: { label: string; acronym?: string | null },
): boolean {
  const name = team.label.trim()
  if (
    name.length >= 3 &&
    new RegExp(`(^|[^\\p{L}\\p{N}])${escape(name)}($|[^\\p{L}\\p{N}])`, 'iu').test(text)
  )
    return true
  const ac = team.acronym?.trim() ?? ''
  return (
    ac.length >= 3 &&
    ac !== name &&
    new RegExp(`(^|[^\\p{L}\\p{N}])${escape(ac)}($|[^\\p{L}\\p{N}])`, 'u').test(text)
  )
}

// ─── Storage ─────────────────────────────────────────────────────────────────

type NotifyKind = 'match_start' | 'match_end' | 'article'
type Settings = {
  matchStart?: boolean | null
  results?: boolean | null
  news?: boolean | null
  hideScores?: boolean | null
}

async function settingsOf(payload: Payload, readerIds: string[]): Promise<Map<string, Settings>> {
  const out = new Map<string, Settings>()
  if (!readerIds.length) return out
  const { docs } = await payload.find({
    collection: 'readers',
    where: { id: { in: readerIds } },
    limit: readerIds.length,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: { notify: true, banned: true },
  } as never)
  for (const d of docs as unknown as Array<{ id: number; notify?: Settings; banned?: boolean }>) {
    if (!d.banned) out.set(String(d.id), d.notify ?? {})
  }
  return out
}

const wants = (s: Settings | undefined, kind: NotifyKind) =>
  !!s &&
  (kind === 'match_start' ? s.matchStart : kind === 'match_end' ? s.results : s.news) !== false

/** Store one notification per reader; a second one with the same key is skipped. */
async function store(
  payload: Payload,
  readers: string[],
  kind: NotifyKind,
  data: Record<string, unknown>,
  url: string,
  dedupeKey: string,
): Promise<number> {
  const settings = await settingsOf(payload, readers)
  let made = 0
  for (const reader of readers) {
    if (!wants(settings.get(reader), kind)) continue
    // Already notified (same reader and key): skip, without relying on the
    // unique index's error (it would hide real failures).
    const { totalDocs } = await payload.count({
      collection: 'reader-notifications' as never,
      where: { and: [{ reader: { equals: reader } }, { dedupeKey: { equals: dedupeKey } }] },
      overrideAccess: true,
    })
    if (totalDocs) continue
    await payload.create({
      collection: 'reader-notifications' as never,
      // Relationship ids are numbers in Postgres.
      data: { reader: Number(reader), kind, data, url, dedupeKey } as never,
      overrideAccess: true,
      depth: 0,
    })
    made++
    // And to the reader's browsers with push on (lib/web-push.ts; off without VAPID keys).
    await sendPush(
      payload,
      Number(reader),
      { kind, data, url, tag: dedupeKey },
      settings.get(reader)?.hideScores === true,
    ).catch((err) => payload.logger.warn({ msg: '[push] failed', error: String(err) }))
  }
  return made
}

/** The match starts / ends: notify the followers of its teams, event or itself. */
export async function notifyMatchEvents(payload: Payload, events: MatchEvent[]): Promise<number> {
  if (!events.length) return 0
  const teams = [
    ...new Set(events.flatMap((e) => [e.t1.id, e.t2.id]).filter((x): x is number => x !== null)),
  ]
  const series = [...new Set(events.map((e) => e.serieId).filter((x): x is number => x !== null))]
  const matches = [...new Set(events.map((e) => e.matchId))]
  const { docs } = await payload.find({
    collection: 'esport-follows' as never,
    where: {
      or: [
        { and: [{ kind: { equals: 'team' } }, { pandaId: { in: teams.length ? teams : [0] } }] },
        { and: [{ kind: { equals: 'event' } }, { pandaId: { in: series.length ? series : [0] } }] },
        { and: [{ kind: { equals: 'match' } }, { pandaId: { in: matches } }] },
      ],
    },
    limit: 10000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const follows = docs as unknown as FollowRow[]
  let made = 0
  for (const e of events) {
    const readers = [...recipientsFor(e, follows)]
    if (!readers.length) continue
    const { type, ...data } = e
    made += await store(
      payload,
      readers,
      type === 'start' ? 'match_start' : 'match_end',
      data,
      // The match on its tournament page (scrolled to and highlighted).
      e.slug
        ? `/esport/tournaments/${e.slug}#match-${e.matchId}`
        : type === 'start'
          ? '/esport/calendar'
          : '/esport/results',
      `${type}:${e.matchId}`,
    )
  }
  return made
}

/** A newly published esport article: notify the followers of the teams it names. */
export async function notifyArticle(
  payload: Payload,
  article: {
    id: number | string
    slug: string
    title: string
    excerpt?: string | null
    category?: string
  },
): Promise<number> {
  if (article.category !== 'esport') return 0
  const { docs } = await payload.find({
    collection: 'esport-follows' as never,
    where: { kind: { equals: 'team' } },
    limit: 10000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const haystack = `${article.title}\n${article.excerpt ?? ''}`
  const byReader = new Map<string, string[]>()
  for (const f of docs as unknown as FollowRow[]) {
    if (!mentionsTeam(haystack, f)) continue
    const r = String(f.reader)
    byReader.set(r, [...(byReader.get(r) ?? []), f.label])
  }
  let made = 0
  for (const [reader, teams] of byReader) {
    made += await store(
      payload,
      [reader],
      'article',
      { articleId: Number(article.id), title: article.title, teams },
      `/article/${article.slug}`,
      `article:${article.id}`,
    )
  }
  return made
}

/** Notifications older than NOTIFICATION_DAYS go (called by the sync). */
export async function pruneNotifications(payload: Payload, now = new Date()): Promise<void> {
  await payload.delete({
    collection: 'reader-notifications' as never,
    where: {
      createdAt: {
        less_than: new Date(now.getTime() - NOTIFICATION_DAYS * 86400_000).toISOString(),
      },
    },
    overrideAccess: true,
  })
  await pruneMatchFollows(payload, now)
}

/** A followed match is dropped a day after it ended (its result was notified). */
export const MATCH_FOLLOW_GRACE_MS = 24 * 3600 * 1000

export async function pruneMatchFollows(payload: Payload, now = new Date()): Promise<number> {
  const { docs } = await payload.find({
    collection: 'esport-follows' as never,
    where: { kind: { equals: 'match' } },
    limit: 10000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: { pandaId: true, at: true },
  } as never)
  const follows = docs as unknown as Array<{ id: number; pandaId: number; at?: string | null }>
  if (!follows.length) return 0
  const cutoff = new Date(now.getTime() - MATCH_FOLLOW_GRACE_MS).toISOString()
  const { docs: over } = await payload.find({
    collection: 'esport-matches',
    where: {
      and: [
        { pandaId: { in: [...new Set(follows.map((f) => f.pandaId))] } },
        { status: { in: ['finished', 'canceled'] } },
        { endAt: { less_than: cutoff } },
      ],
    },
    limit: 10000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: { pandaId: true },
  } as never)
  const done = new Set(
    (over as unknown as Array<{ pandaId: number }>).map((m) => Number(m.pandaId)),
  )
  // Also a match no longer synced that should have been played days ago.
  const stale = (f: { at?: string | null }) =>
    !!f.at && Date.parse(f.at) < now.getTime() - 4 * MATCH_FOLLOW_GRACE_MS
  const ids = follows.filter((f) => done.has(Number(f.pandaId)) || stale(f)).map((f) => f.id)
  if (ids.length) {
    await payload.delete({
      collection: 'esport-follows' as never,
      where: { id: { in: ids } },
      overrideAccess: true,
    })
  }
  return ids.length
}

// ─── HTTP: the website's calls (READER_API_SECRET) ───────────────────────────

const FOLLOW_FIELDS = ['kind', 'pandaId', 'game', 'label', 'acronym', 'logo', 'slug', 'at'] as const

/**
 * Followed matches with what the reader's list shows: both teams' names and
 * logos, and their tournament page (`slug`), looked up now from the synced
 * match (a follow made before the sync knew its tournament had none).
 */
async function withMatchDetails(
  payload: Payload,
  rows: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  const ids = rows.filter((r) => r.kind === 'match').map((r) => Number(r.pandaId))
  if (!ids.length) return rows
  const { docs } = await payload.find({
    collection: 'esport-matches',
    where: { pandaId: { in: ids } },
    limit: ids.length,
    depth: 1,
    pagination: false,
    overrideAccess: true,
  })
  type T = { name?: string | null; logoUrl?: string | null }
  const byId = new Map(
    (
      docs as unknown as Array<{
        pandaId: number
        team1?: T
        team2?: T
        tournament?: { slug?: string | null } | null
      }>
    ).map((m) => [Number(m.pandaId), m]),
  )
  return rows.map((r) => {
    const m = r.kind === 'match' ? byId.get(Number(r.pandaId)) : undefined
    if (!m) return r
    const team = (t?: T) => ({ name: t?.name ?? null, logo: t?.logoUrl ?? null })
    const slug =
      (m.tournament && typeof m.tournament === 'object' ? m.tournament.slug : null) ?? r.slug
    return { ...r, slug: slug ?? null, teams: [team(m.team1), team(m.team2)] }
  })
}

/**
 * /reader-api/esport-follows
 *   GET    ?clerkId          → { docs: follows }
 *   POST   { profile, follow } → { following: true }   (verified email)
 *   DELETE { clerkId, kind, pandaId } → { following: false }
 */
export const esportFollowsHandler: PayloadHandler = async (req) => {
  const denied = checkSecret(req.headers)
  if (denied) return denied
  if (req.method === 'GET') {
    const clerkId = req.searchParams.get('clerkId')
    if (!isClerkId(clerkId)) return json({ error: 'invalid clerkId' }, 400)
    const reader = await findReader(req.payload, clerkId)
    if (!reader) return json({ docs: [] })
    const { docs } = await req.payload.find({
      collection: 'esport-follows' as never,
      where: { reader: { equals: reader.id } },
      sort: '-createdAt',
      limit: MAX_ESPORT_FOLLOWS,
      depth: 0,
      overrideAccess: true,
    })
    const rows = (docs as unknown as Array<Record<string, unknown>>).map((d) =>
      Object.fromEntries(FOLLOW_FIELDS.map((k) => [k, d[k] ?? null])),
    )
    return json({ docs: await withMatchDetails(req.payload, rows) })
  }
  const body = await readBody(req)
  if (req.method === 'DELETE') {
    if (!isClerkId(body.clerkId)) return json({ error: 'invalid clerkId' }, 400)
    const kind = body.kind as FollowKind
    const pandaId = Number(body.pandaId)
    if (!FOLLOW_KINDS.includes(kind) || !Number.isInteger(pandaId))
      return json({ error: 'invalid follow' }, 400)
    const reader = await ensureReader(req.payload, body.clerkId)
    await req.payload.delete({
      collection: 'esport-follows' as never,
      where: {
        and: [
          { reader: { equals: reader.id } },
          { kind: { equals: kind } },
          { pandaId: { equals: pandaId } },
        ],
      },
      overrideAccess: true,
    })
    return json({ following: false })
  }
  const writer = await writerFrom(req.payload, body.profile)
  if ('error' in writer) return writer.error
  const follow = followFromBody(body.follow)
  if (!follow) return json({ error: 'invalid follow' }, 400)
  const mine = { reader: { equals: writer.reader.id } }
  const { totalDocs: already } = await req.payload.count({
    collection: 'esport-follows' as never,
    where: {
      and: [mine, { kind: { equals: follow.kind } }, { pandaId: { equals: follow.pandaId } }],
    },
    overrideAccess: true,
  })
  if (already) return json({ following: true })
  const { totalDocs } = await req.payload.count({
    collection: 'esport-follows' as never,
    where: mine,
    overrideAccess: true,
  })
  if (totalDocs >= MAX_ESPORT_FOLLOWS) return json({ error: 'too-many' }, 409)
  try {
    await req.payload.create({
      collection: 'esport-follows' as never,
      data: { reader: writer.reader.id, ...follow } as never,
      overrideAccess: true,
    })
  } catch {
    // Double click: the unique index refused the second one.
  }
  return json({ following: true })
}

/**
 * /reader-api/notifications
 *   GET  ?clerkId&limit   → { docs, unread }
 *   POST { clerkId, read: 'all' | number[] } → { unread: 0 | n }
 */
export const notificationsHandler: PayloadHandler = async (req) => {
  const denied = checkSecret(req.headers)
  if (denied) return denied
  const unreadOf = async (readerId: number | string) =>
    (
      await req.payload.count({
        collection: 'reader-notifications' as never,
        where: { and: [{ reader: { equals: readerId } }, { readAt: { exists: false } }] },
        overrideAccess: true,
      })
    ).totalDocs
  if (req.method === 'GET') {
    const clerkId = req.searchParams.get('clerkId')
    if (!isClerkId(clerkId)) return json({ error: 'invalid clerkId' }, 400)
    const reader = await findReader(req.payload, clerkId)
    if (!reader) return json({ docs: [], unread: 0 })
    const limit = Math.max(0, Math.min(50, Number(req.searchParams.get('limit') ?? 20) || 0))
    const docs = limit
      ? (
          await req.payload.find({
            collection: 'reader-notifications' as never,
            where: { reader: { equals: reader.id } },
            sort: '-createdAt',
            limit,
            depth: 0,
            overrideAccess: true,
          })
        ).docs
      : []
    return json({
      docs: (docs as unknown as Array<Record<string, unknown>>).map((d) => ({
        id: d.id,
        kind: d.kind,
        data: d.data,
        url: d.url,
        readAt: d.readAt ?? null,
        createdAt: d.createdAt,
      })),
      unread: await unreadOf(reader.id),
    })
  }
  const body = await readBody(req)
  if (!isClerkId(body.clerkId)) return json({ error: 'invalid clerkId' }, 400)
  const reader = await findReader(req.payload, body.clerkId)
  if (!reader) return json({ unread: 0 })
  const ids = Array.isArray(body.read)
    ? body.read
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0)
        .slice(0, 100)
    : null
  if (body.read !== 'all' && !ids?.length) return json({ error: 'invalid read' }, 400)
  await req.payload.update({
    collection: 'reader-notifications' as never,
    where: {
      and: [
        { reader: { equals: reader.id } },
        { readAt: { exists: false } },
        ...(ids ? [{ id: { in: ids } }] : []),
      ],
    },
    data: { readAt: new Date().toISOString() } as never,
    overrideAccess: true,
  })
  return json({ unread: await unreadOf(reader.id) })
}

const SETTING_KEYS = ['matchStart', 'results', 'news', 'hideScores'] as const

/**
 * /reader-api/notify-settings
 *   GET  ?clerkId → { matchStart, results, news, hideScores }
 *   POST { clerkId, settings } → the same, saved. Only the booleans sent
 *        change: Preferences sends the three switches, the anti-spoil default
 *        sends hideScores alone.
 */
export const notifySettingsHandler: PayloadHandler = async (req) => {
  const denied = checkSecret(req.headers)
  if (denied) return denied
  const pick = (s: Settings | undefined) => ({
    matchStart: s?.matchStart !== false,
    results: s?.results !== false,
    news: s?.news !== false,
    hideScores: s?.hideScores === true,
  })
  if (req.method === 'GET') {
    const clerkId = req.searchParams.get('clerkId')
    if (!isClerkId(clerkId)) return json({ error: 'invalid clerkId' }, 400)
    const reader = await findReader(req.payload, clerkId)
    return json(pick((reader as unknown as { notify?: Settings } | null)?.notify))
  }
  const body = await readBody(req)
  if (!isClerkId(body.clerkId)) return json({ error: 'invalid clerkId' }, 400)
  const sent = (body.settings ?? {}) as Record<string, unknown>
  const reader = await ensureReader(req.payload, body.clerkId)
  const notify = pick((reader as unknown as { notify?: Settings }).notify)
  for (const k of SETTING_KEYS) if (typeof sent[k] === 'boolean') notify[k] = sent[k] as boolean
  await req.payload.update({
    collection: 'readers',
    id: reader.id,
    data: { notify } as never,
    overrideAccess: true,
  })
  return json(notify)
}

const text64 = (v: unknown) =>
  typeof v === 'string' && /^[A-Za-z0-9_\-=]{8,200}$/.test(v) ? v : null

/**
 * /reader-api/push (web push, lib/web-push.ts)
 *   GET    ?clerkId → { count }
 *   POST   { clerkId, subscription: { endpoint, keys: { p256dh, auth } }, locale, userAgent }
 *          → { subscribed: true } (one row per browser: the same endpoint moves to this reader)
 *   DELETE { clerkId, endpoint } → { subscribed: false }
 */
export const pushHandler: PayloadHandler = async (req) => {
  const denied = checkSecret(req.headers)
  if (denied) return denied
  if (req.method === 'GET') {
    const clerkId = req.searchParams.get('clerkId')
    if (!isClerkId(clerkId)) return json({ error: 'invalid clerkId' }, 400)
    const reader = await findReader(req.payload, clerkId)
    if (!reader) return json({ count: 0 })
    const { totalDocs } = await req.payload.count({
      collection: 'push-subscriptions' as never,
      where: { reader: { equals: reader.id } },
      overrideAccess: true,
    })
    return json({ count: totalDocs })
  }
  const body = await readBody(req)
  if (!isClerkId(body.clerkId)) return json({ error: 'invalid clerkId' }, 400)
  if (req.method === 'DELETE') {
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''
    const reader = await findReader(req.payload, body.clerkId)
    if (reader && endpoint) {
      await req.payload.delete({
        collection: 'push-subscriptions' as never,
        where: { and: [{ reader: { equals: reader.id } }, { endpoint: { equals: endpoint } }] },
        overrideAccess: true,
      })
    }
    return json({ subscribed: false })
  }
  const sub = (body.subscription ?? {}) as {
    endpoint?: unknown
    keys?: { p256dh?: unknown; auth?: unknown }
  }
  const endpoint =
    typeof sub.endpoint === 'string' && sub.endpoint.length <= 1000 ? sub.endpoint : ''
  const p256dh = text64(sub.keys?.p256dh)
  const auth = text64(sub.keys?.auth)
  if (!/^https:\/\/[^\s]+$/.test(endpoint) || !p256dh || !auth)
    return json({ error: 'invalid subscription' }, 400)
  const reader = await ensureReader(req.payload, body.clerkId)
  const data = {
    reader: reader.id,
    endpoint,
    p256dh,
    auth,
    locale: body.locale === 'fr' ? 'fr' : 'en',
    userAgent: typeof body.userAgent === 'string' ? body.userAgent.slice(0, 200) : null,
  }
  const { docs } = await req.payload.find({
    collection: 'push-subscriptions' as never,
    where: { endpoint: { equals: endpoint } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (docs[0]) {
    await req.payload.update({
      collection: 'push-subscriptions' as never,
      id: (docs[0] as unknown as { id: number }).id,
      data: data as never,
      overrideAccess: true,
    })
  } else {
    await req.payload.create({
      collection: 'push-subscriptions' as never,
      data: data as never,
      overrideAccess: true,
    })
  }
  return json({ subscribed: true })
}
