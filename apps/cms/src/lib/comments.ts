// ─── Comments ────────────────────────────────────────────────────────────────
// Reader comments under articles (collections/Comments.ts), for the website,
// server to server with READER_API_SECRET like the rest of src/lib/readers.ts.
//
//   GET    /api/reader-api/comments?article&page&clerkId   list (clerkId: the viewer, optional)
//   POST   /api/reader-api/comments  { profile, articleId, body, replyTo? }
//   DELETE /api/reader-api/comments  { profile, commentId }        own, or a moderator's
//   POST   /api/reader-api/comments/vote      { profile, commentId, value: 1 | -1 | 0 }
//   POST   /api/reader-api/comments/report    { profile, commentId, reason, note? }
//   POST   /api/reader-api/comments/moderate  { profile, commentId, action: hide | restore }
//
// The rules (what the product decided, 2026-11-13):
//  - writing anything (comment, vote, report) needs a verified email and an
//    account that isn't banned (`writerFrom`), and comments a Clerk account at
//    least 10 minutes old;
//  - plain text, 2000 characters, no images; links stay text on the site;
//  - at most one comment every 30 s and 30 a day per reader, no duplicates;
//  - threads one level deep, replies say whom they answer;
//  - no editing; the author deletes their own; Owner, Admin and Mod readers
//    hide, restore and delete anyone's;
//  - a deleted comment with replies stays as "Comment deleted";
//  - top comments first by likes, then oldest; replies oldest first;
//  - N reports from different readers (Community settings, 3) hide a comment
//    until a moderator restores it; each report goes to the moderation Discord
//    channel (MODERATION_DISCORD_WEBHOOK_URL);
//  - Community settings → "Comments on" switches the whole thing off, and an
//    article can close its own comments (`commentsClosed`).

import type { Payload, PayloadHandler, PayloadRequest, Where } from 'payload'
import type { CommentStatus, ReportReason } from '../collections/Comments'
import { REPORT_REASONS } from '../collections/Comments'
import type { ReaderRole } from '../collections/Readers'
import {
  checkSecret,
  findReader,
  idOf,
  isClerkId,
  json,
  readBody,
  writerFrom,
  type ReaderDoc,
} from './readers'

export const COMMENT_MAX_LENGTH = 2000
export const MIN_ACCOUNT_AGE_MS = 10 * 60_000
export const MIN_GAP_MS = 30_000
export const DAILY_LIMIT = 30
export const COMMENTS_PER_PAGE = 20

const MODERATORS: ReaderRole[] = ['owner', 'admin', 'moderator']
export const canModerate = (role: ReaderRole | null | undefined) => !!role && MODERATORS.includes(role)

type Id = number | string

type CommentDoc = {
  id: Id
  body?: string | null
  status: CommentStatus
  article: unknown
  reader?: unknown
  parent?: unknown
  replyTo?: unknown
  replyToName?: string | null
  likes?: number | null
  dislikes?: number | null
  reportCount?: number | null
  createdAt: string
}

export class CommentError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code)
  }
}

// ─── Text ────────────────────────────────────────────────────────────────────

/** Plain text as stored: no control characters, at most one blank line in a row, trimmed. */
export function cleanBody(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ─── Settings and article ────────────────────────────────────────────────────

export async function communitySettings(payload: Payload) {
  const s = (await payload.findGlobal({ slug: 'community-settings', overrideAccess: true })) as {
    commentsEnabled?: boolean | null
    autoHideReports?: number | null
  }
  return {
    commentsEnabled: s.commentsEnabled !== false,
    autoHideReports: Math.max(1, s.autoHideReports ?? 3),
  }
}

async function articleState(payload: Payload, articleId: Id) {
  const { docs } = await payload.find({
    collection: 'articles',
    where: { and: [{ id: { equals: articleId } }, { status: { equals: 'published' } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { slug: true, commentsClosed: true } as never,
  })
  const doc = docs[0] as { slug?: string; commentsClosed?: boolean | null } | undefined
  return doc ? { slug: doc.slug ?? '', closed: doc.commentsClosed === true } : null
}

async function findComment(payload: Payload, id: Id): Promise<CommentDoc | null> {
  try {
    return (await payload.findByID({ collection: 'comments', id, depth: 0, overrideAccess: true })) as unknown as CommentDoc
  } catch {
    return null
  }
}

// ─── Listing ─────────────────────────────────────────────────────────────────

export interface CommentView {
  id: Id
  parentId: Id | null
  replyToId: Id | null
  replyToName: string | null
  status: CommentStatus
  /** null when deleted, or hidden and the viewer isn't a moderator. */
  body: string | null
  author: { name: string; role: ReaderRole } | null
  createdAt: string
  likes: number
  dislikes: number
  myVote: -1 | 0 | 1
  mine: boolean
  reported: boolean
  replies?: CommentView[]
}

export interface CommentList {
  enabled: boolean
  closed: boolean
  /** Visible comments, replies included. */
  total: number
  page: number
  totalPages: number
  comments: CommentView[]
  viewer: { role: ReaderRole; canModerate: boolean; banned: boolean; verified: boolean } | null
}

function toView(
  doc: CommentDoc,
  viewer: ReaderDoc | null,
  votes: Map<string, number>,
  reported: Set<string>,
): CommentView {
  const reader = doc.reader && typeof doc.reader === 'object' ? (doc.reader as ReaderDoc) : null
  const mod = canModerate(viewer?.role)
  const showBody = doc.status === 'visible' || (doc.status === 'hidden' && mod)
  const vote = votes.get(String(doc.id)) ?? 0
  return {
    id: doc.id,
    parentId: idOf(doc.parent),
    replyToId: idOf(doc.replyTo),
    replyToName: doc.replyToName ?? null,
    status: doc.status,
    body: showBody ? (doc.body ?? '') : null,
    author:
      reader && doc.status !== 'deleted'
        ? { name: reader.username ?? 'reader', role: (reader.role ?? 'reader') as ReaderRole }
        : null,
    createdAt: doc.createdAt,
    likes: doc.likes ?? 0,
    dislikes: doc.dislikes ?? 0,
    myVote: vote > 0 ? 1 : vote < 0 ? -1 : 0,
    mine: !!viewer && !!reader && String(reader.id) === String(viewer.id),
    reported: reported.has(String(doc.id)),
  }
}

export async function listComments(
  payload: Payload,
  articleId: Id,
  { page = 1, limit = COMMENTS_PER_PAGE, viewerClerkId }: { page?: number; limit?: number; viewerClerkId?: string | null } = {},
): Promise<CommentList> {
  const settings = await communitySettings(payload)
  const article = await articleState(payload, articleId)
  const viewer = viewerClerkId ? await findReader(payload, viewerClerkId) : null
  const viewerInfo = viewer
    ? {
        role: (viewer.role ?? 'reader') as ReaderRole,
        canModerate: canModerate(viewer.role),
        banned: viewer.banned === true,
        verified: viewer.emailVerified === true,
      }
    : null
  if (!settings.commentsEnabled || !article) {
    return { enabled: settings.commentsEnabled, closed: !article, total: 0, page: 1, totalPages: 0, comments: [], viewer: viewerInfo }
  }

  const top = await payload.find({
    collection: 'comments',
    where: { and: [{ article: { equals: articleId } }, { parent: { exists: false } }] },
    sort: ['-likes', 'createdAt'],
    page,
    limit,
    depth: 1,
    overrideAccess: true,
  })
  const tops = top.docs as unknown as CommentDoc[]
  const replies =
    tops.length === 0
      ? []
      : ((
          await payload.find({
            collection: 'comments',
            where: { parent: { in: tops.map((t) => t.id) } },
            sort: 'createdAt',
            pagination: false,
            depth: 1,
            overrideAccess: true,
          })
        ).docs as unknown as CommentDoc[])

  const ids = [...tops, ...replies].map((c) => c.id)
  const votes = new Map<string, number>()
  const reported = new Set<string>()
  if (viewer && ids.length > 0) {
    const mine: Where = { and: [{ reader: { equals: viewer.id } }, { comment: { in: ids } }] }
    const [v, r] = await Promise.all([
      payload.find({ collection: 'comment-votes', where: mine, pagination: false, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'comment-reports', where: mine, pagination: false, depth: 0, overrideAccess: true }),
    ])
    for (const d of v.docs as unknown as { comment: unknown; value: number }[]) votes.set(String(idOf(d.comment)), d.value)
    for (const d of r.docs as unknown as { comment: unknown }[]) reported.add(String(idOf(d.comment)))
  }

  const { totalDocs } = await payload.count({
    collection: 'comments',
    where: { and: [{ article: { equals: articleId } }, { status: { equals: 'visible' } }] },
    overrideAccess: true,
  })

  return {
    enabled: true,
    closed: article.closed,
    total: totalDocs,
    page: top.page ?? page,
    totalPages: top.totalPages,
    viewer: viewerInfo,
    comments: tops.map((t) => ({
      ...toView(t, viewer, votes, reported),
      replies: replies
        .filter((r) => String(idOf(r.parent)) === String(t.id))
        .map((r) => toView(r, viewer, votes, reported)),
    })),
  }
}

// ─── Writing ─────────────────────────────────────────────────────────────────

export async function postComment(
  payload: Payload,
  reader: ReaderDoc,
  input: { articleId: Id; body: unknown; replyTo?: Id | null },
  now = new Date(),
): Promise<CommentView> {
  const settings = await communitySettings(payload)
  if (!settings.commentsEnabled) throw new CommentError('disabled', 403)
  const article = await articleState(payload, input.articleId)
  if (!article) throw new CommentError('not-found', 404)
  if (article.closed) throw new CommentError('closed', 403)

  const created = new Date(reader.clerkCreatedAt ?? (reader as { createdAt?: string }).createdAt ?? 0)
  if (now.getTime() - created.getTime() < MIN_ACCOUNT_AGE_MS) throw new CommentError('too-new', 403)

  const body = cleanBody(input.body)
  if (!body) throw new CommentError('empty', 400)
  if (body.length > COMMENT_MAX_LENGTH) throw new CommentError('too-long', 400)

  let parent: Id | null = null
  let replyTo: CommentDoc | null = null
  let replyToName: string | null = null
  if (input.replyTo !== undefined && input.replyTo !== null) {
    replyTo = await findComment(payload, input.replyTo)
    if (!replyTo || String(idOf(replyTo.article)) !== String(input.articleId) || replyTo.status !== 'visible') {
      throw new CommentError('reply-target', 400)
    }
    parent = idOf(replyTo.parent) ?? replyTo.id
    const target = idOf(replyTo.reader)
    const targetReader = target
      ? ((await payload.findByID({ collection: 'readers', id: target, depth: 0, overrideAccess: true }).catch(() => null)) as ReaderDoc | null)
      : null
    replyToName = targetReader?.username ?? 'reader'
  }

  // Pace: one every 30 s, 30 a day, never the same text twice in a day.
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString()
  const recent = (
    await payload.find({
      collection: 'comments',
      where: { and: [{ reader: { equals: reader.id } }, { createdAt: { greater_than: dayAgo } }] },
      sort: '-createdAt',
      limit: DAILY_LIMIT,
      depth: 0,
      overrideAccess: true,
    })
  ).docs as unknown as CommentDoc[]
  if (recent[0] && now.getTime() - new Date(recent[0].createdAt).getTime() < MIN_GAP_MS) {
    throw new CommentError('slow-down', 429)
  }
  if (recent.length >= DAILY_LIMIT) throw new CommentError('daily-limit', 429)
  const same = body.toLowerCase()
  if (recent.some((c) => (c.body ?? '').toLowerCase() === same)) throw new CommentError('duplicate', 409)

  const doc = (await payload.create({
    collection: 'comments',
    data: {
      body,
      status: 'visible',
      article: input.articleId,
      reader: reader.id,
      parent,
      replyTo: replyTo?.id ?? null,
      replyToName,
      likes: 0,
      dislikes: 0,
      reportCount: 0,
    } as never,
    depth: 1,
    overrideAccess: true,
  })) as unknown as CommentDoc
  return toView(doc, reader, new Map(), new Set())
}

async function deleteWhere(payload: Payload, collection: 'comment-votes' | 'comment-reports', where: Where, req?: PayloadRequest) {
  await payload.delete({ collection, where, overrideAccess: true, req })
}

/** Votes, reports and replies of a comment (replies with their own votes and reports). */
export async function purgeCommentDependents(payload: Payload, id: Id, req?: PayloadRequest) {
  const replies = (
    await payload.find({
      collection: 'comments',
      where: { parent: { equals: id } },
      pagination: false,
      depth: 0,
      overrideAccess: true,
      req,
    })
  ).docs.map((d) => d.id)
  const all = [id, ...replies]
  await deleteWhere(payload, 'comment-votes', { comment: { in: all } }, req)
  await deleteWhere(payload, 'comment-reports', { comment: { in: all } }, req)
  if (replies.length > 0) {
    // A reply may answer another reply: clear those links before deleting.
    await payload.update({
      collection: 'comments',
      where: { id: { in: replies } },
      data: { replyTo: null } as never,
      overrideAccess: true,
      req,
    })
    await payload.delete({
      collection: 'comments',
      where: { id: { in: replies } },
      overrideAccess: true,
      req,
      context: { skipCommentCascade: true },
    })
  }
}

async function hardDelete(payload: Payload, id: Id, req?: PayloadRequest) {
  await purgeCommentDependents(payload, id, req)
  // Replies elsewhere that answered this one keep their "@name", lose the link.
  await payload.update({
    collection: 'comments',
    where: { replyTo: { equals: id } },
    data: { replyTo: null } as never,
    overrideAccess: true,
    req,
  })
  await payload.delete({ collection: 'comments', id, overrideAccess: true, req, context: { skipCommentCascade: true } })
}

/**
 * Remove a comment the way the site shows it: a top-level one with replies
 * stays as "Comment deleted" (text and author gone), anything else goes; a
 * "Comment deleted" left with no replies goes too.
 */
async function removeComment(payload: Payload, comment: CommentDoc, req?: PayloadRequest) {
  const parentId = idOf(comment.parent)
  if (parentId === null) {
    const { totalDocs } = await payload.count({
      collection: 'comments',
      where: { parent: { equals: comment.id } },
      overrideAccess: true,
      req,
    })
    if (totalDocs > 0) {
      await payload.update({
        collection: 'comments',
        id: comment.id,
        data: { status: 'deleted', body: null, reader: null } as never,
        overrideAccess: true,
        req,
      })
      await deleteWhere(payload, 'comment-reports', { comment: { equals: comment.id } }, req)
      return
    }
    await hardDelete(payload, comment.id, req)
    return
  }
  await hardDelete(payload, comment.id, req)
  const parent = await findComment(payload, parentId)
  if (parent?.status === 'deleted') {
    const { totalDocs } = await payload.count({
      collection: 'comments',
      where: { parent: { equals: parentId } },
      overrideAccess: true,
      req,
    })
    if (totalDocs === 0) await hardDelete(payload, parentId, req)
  }
}

export async function deleteCommentAs(payload: Payload, reader: ReaderDoc, commentId: Id) {
  const comment = await findComment(payload, commentId)
  if (!comment || comment.status === 'deleted') throw new CommentError('not-found', 404)
  const own = String(idOf(comment.reader)) === String(reader.id)
  if (!own && !canModerate(reader.role)) throw new CommentError('forbidden', 403)
  await removeComment(payload, comment)
}

export async function moderateComment(payload: Payload, reader: ReaderDoc, commentId: Id, action: 'hide' | 'restore') {
  if (!canModerate(reader.role)) throw new CommentError('forbidden', 403)
  const comment = await findComment(payload, commentId)
  if (!comment || comment.status === 'deleted') throw new CommentError('not-found', 404)
  await payload.update({
    collection: 'comments',
    id: commentId,
    data: (action === 'hide' ? { status: 'hidden' } : { status: 'visible', autoHidden: false }) as never,
    overrideAccess: true,
  })
  if (action === 'restore') {
    // A moderator looked at it: its open reports are dealt with.
    await payload.update({
      collection: 'comment-reports',
      where: { and: [{ comment: { equals: commentId } }, { status: { equals: 'open' } }] },
      data: { status: 'resolved' } as never,
      overrideAccess: true,
    })
  }
}

async function recountVotes(payload: Payload, commentId: Id, req?: PayloadRequest) {
  const count = (value: number) =>
    payload
      .count({
        collection: 'comment-votes',
        where: { and: [{ comment: { equals: commentId } }, { value: { equals: value } }] },
        overrideAccess: true,
        req,
      })
      .then((r) => r.totalDocs)
  const [likes, dislikes] = await Promise.all([count(1), count(-1)])
  await payload.update({ collection: 'comments', id: commentId, data: { likes, dislikes } as never, overrideAccess: true, req })
  return { likes, dislikes }
}

export async function voteComment(payload: Payload, reader: ReaderDoc, commentId: Id, value: number) {
  if (![1, 0, -1].includes(value)) throw new CommentError('bad-vote', 400)
  const comment = await findComment(payload, commentId)
  if (!comment || comment.status !== 'visible') throw new CommentError('not-found', 404)
  if (String(idOf(comment.reader)) === String(reader.id)) throw new CommentError('own', 403)
  const mine: Where = { and: [{ reader: { equals: reader.id } }, { comment: { equals: commentId } }] }
  const existing = (
    await payload.find({ collection: 'comment-votes', where: mine, limit: 1, depth: 0, overrideAccess: true })
  ).docs[0] as { id: Id; value: number } | undefined
  if (value === 0) {
    if (existing) await payload.delete({ collection: 'comment-votes', id: existing.id, overrideAccess: true })
  } else if (existing) {
    if (existing.value !== value) {
      await payload.update({ collection: 'comment-votes', id: existing.id, data: { value } as never, overrideAccess: true })
    }
  } else {
    try {
      await payload.create({
        collection: 'comment-votes',
        data: { reader: reader.id, comment: commentId, value } as never,
        overrideAccess: true,
      })
    } catch {
      // Double click: the unique (reader, comment) index kept the first one.
    }
  }
  return { ...(await recountVotes(payload, commentId)), myVote: value }
}

export async function reportComment(
  payload: Payload,
  reader: ReaderDoc,
  commentId: Id,
  reasonRaw: unknown,
  noteRaw: unknown,
) {
  const reason = String(reasonRaw) as ReportReason
  if (!REPORT_REASONS.includes(reason)) throw new CommentError('bad-reason', 400)
  const note = cleanBody(noteRaw).slice(0, 500) || null
  const comment = await findComment(payload, commentId)
  if (!comment || comment.status === 'deleted') throw new CommentError('not-found', 404)
  if (String(idOf(comment.reader)) === String(reader.id)) throw new CommentError('own', 403)

  const mine: Where = { and: [{ reader: { equals: reader.id } }, { comment: { equals: commentId } }] }
  const { totalDocs: already } = await payload.count({ collection: 'comment-reports', where: mine, overrideAccess: true })
  if (already > 0) return { reported: true, hidden: comment.status === 'hidden' }
  try {
    await payload.create({
      collection: 'comment-reports',
      data: { reader: reader.id, comment: commentId, reason, note, status: 'open' } as never,
      overrideAccess: true,
    })
  } catch {
    return { reported: true, hidden: comment.status === 'hidden' }
  }

  const { totalDocs: reports } = await payload.count({
    collection: 'comment-reports',
    where: { comment: { equals: commentId } },
    overrideAccess: true,
  })
  const { autoHideReports } = await communitySettings(payload)
  const autoHide = comment.status === 'visible' && reports >= autoHideReports
  await payload.update({
    collection: 'comments',
    id: commentId,
    data: { reportCount: reports, ...(autoHide ? { status: 'hidden', autoHidden: true } : {}) } as never,
    overrideAccess: true,
  })

  const article = await payload
    .findByID({ collection: 'articles', id: idOf(comment.article)!, depth: 0, overrideAccess: true })
    .catch(() => null)
  void notifyModeration(payload, {
    commentId,
    reason,
    note,
    body: comment.body ?? '',
    reports,
    threshold: autoHideReports,
    autoHidden: autoHide,
    articleSlug: (article as { slug?: string } | null)?.slug ?? null,
  })
  return { reported: true, hidden: autoHide || comment.status === 'hidden' }
}

// ─── Moderation channel (Discord) ────────────────────────────────────────────

const REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam',
  harassment: 'Harassment or hate',
  illegal: 'Illegal content',
  other: 'Other',
}

/** The Discord message for a report: what, how many, where to act. No reader names. */
export function moderationMessage(r: {
  commentId: Id
  reason: ReportReason
  note: string | null
  body: string
  reports: number
  threshold: number
  autoHidden: boolean
  articleSlug: string | null
  webUrl: string
  cmsUrl: string
}): string {
  const quote = r.body.length > 300 ? `${r.body.slice(0, 300)}…` : r.body
  const lines = [
    `🚩 **Report: ${REASON_LABELS[r.reason]}** (${r.reports}/${r.threshold})${r.autoHidden ? ' · **hidden automatically**' : ''}`,
    quote ? quote.split('\n').map((l) => `> ${l}`).join('\n') : '> (empty)',
  ]
  if (r.note) lines.push(`Note: ${r.note}`)
  if (r.articleSlug) lines.push(`On the site: ${r.webUrl}/article/${r.articleSlug}#comment-${r.commentId}`)
  lines.push(`In the admin: ${r.cmsUrl}/admin/collections/comments/${r.commentId}`)
  return lines.join('\n').slice(0, 1900)
}

async function notifyModeration(
  payload: Payload,
  r: Omit<Parameters<typeof moderationMessage>[0], 'webUrl' | 'cmsUrl'>,
) {
  const webhook = process.env.MODERATION_DISCORD_WEBHOOK_URL
  if (!webhook) return
  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'Akavish Moderation',
        allowed_mentions: { parse: [] },
        content: moderationMessage({
          ...r,
          webUrl: process.env.WEB_URL || 'https://akavish.gg',
          cmsUrl: process.env.SERVER_URL || 'https://cms.akavish.gg',
        }),
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Discord ${res.status}`)
  } catch (error) {
    payload.logger.warn({ msg: '[comments] moderation alert not sent', error: error instanceof Error ? error.message : String(error) })
  }
}

// ─── Cleanups (account or article deleted) ───────────────────────────────────

/** Everything a reader wrote in the community, when their account goes. */
export async function removeReaderCommunityData(payload: Payload, readerId: Id, req?: PayloadRequest) {
  const byReader: Where = { reader: { equals: readerId } }
  const votes = (
    await payload.find({ collection: 'comment-votes', where: byReader, pagination: false, depth: 0, overrideAccess: true, req })
  ).docs as unknown as { comment: unknown }[]
  await deleteWhere(payload, 'comment-votes', byReader, req)
  const reports = (
    await payload.find({ collection: 'comment-reports', where: byReader, pagination: false, depth: 0, overrideAccess: true, req })
  ).docs as unknown as { comment: unknown }[]
  await deleteWhere(payload, 'comment-reports', byReader, req)

  const theirs = (
    await payload.find({ collection: 'comments', where: byReader, pagination: false, depth: 0, overrideAccess: true, req })
  ).docs as unknown as CommentDoc[]
  const replies = theirs.filter((c) => idOf(c.parent) !== null)
  const tops = theirs.filter((c) => idOf(c.parent) === null)

  // Their replies go, in one go.
  if (replies.length > 0) {
    const ids = replies.map((c) => c.id)
    await deleteWhere(payload, 'comment-votes', { comment: { in: ids } }, req)
    await deleteWhere(payload, 'comment-reports', { comment: { in: ids } }, req)
    await payload.update({ collection: 'comments', where: { replyTo: { in: ids } }, data: { replyTo: null } as never, overrideAccess: true, req })
    await payload.delete({ collection: 'comments', where: { id: { in: ids } }, overrideAccess: true, req, context: { skipCommentCascade: true } })
  }

  // Their top-level comments: a placeholder where others replied, gone otherwise.
  if (tops.length > 0) {
    const answered = new Set(
      (
        await payload.find({
          collection: 'comments',
          where: { parent: { in: tops.map((t) => t.id) } },
          pagination: false,
          depth: 0,
          overrideAccess: true,
          req,
        })
      ).docs.map((d) => String(idOf((d as unknown as CommentDoc).parent))),
    )
    const keep = tops.filter((t) => answered.has(String(t.id))).map((t) => t.id)
    const drop = tops.filter((t) => !answered.has(String(t.id))).map((t) => t.id)
    if (keep.length > 0) {
      await payload.update({
        collection: 'comments',
        where: { id: { in: keep } },
        data: { status: 'deleted', body: null, reader: null } as never,
        overrideAccess: true,
        req,
      })
      await deleteWhere(payload, 'comment-reports', { comment: { in: keep } }, req)
    }
    if (drop.length > 0) {
      await deleteWhere(payload, 'comment-votes', { comment: { in: drop } }, req)
      await deleteWhere(payload, 'comment-reports', { comment: { in: drop } }, req)
      await payload.delete({ collection: 'comments', where: { id: { in: drop } }, overrideAccess: true, req, context: { skipCommentCascade: true } })
    }
  }

  // Placeholders of others left without any reply.
  for (const parentId of new Set(replies.map((r) => String(idOf(r.parent))))) {
    const parent = await findComment(payload, parentId)
    if (parent?.status !== 'deleted') continue
    const { totalDocs } = await payload.count({ collection: 'comments', where: { parent: { equals: parentId } }, overrideAccess: true, req })
    if (totalDocs === 0) await hardDelete(payload, parentId, req)
  }

  const touched = new Set([...votes, ...reports].map((d) => String(idOf(d.comment))))
  for (const id of touched) {
    const still = await findComment(payload, id)
    if (!still) continue
    await recountVotes(payload, id, req)
    const { totalDocs } = await payload.count({ collection: 'comment-reports', where: { comment: { equals: id } }, overrideAccess: true, req })
    await payload.update({ collection: 'comments', id, data: { reportCount: totalDocs } as never, overrideAccess: true, req })
  }
}

/** All comments of an article, when the article is deleted. */
export async function purgeArticleComments(payload: Payload, articleId: Id, req?: PayloadRequest) {
  const ids = (
    await payload.find({
      collection: 'comments',
      where: { article: { equals: articleId } },
      pagination: false,
      depth: 0,
      overrideAccess: true,
      req,
    })
  ).docs.map((d) => d.id)
  if (ids.length === 0) return
  await deleteWhere(payload, 'comment-votes', { comment: { in: ids } }, req)
  await deleteWhere(payload, 'comment-reports', { comment: { in: ids } }, req)
  await payload.update({ collection: 'comments', where: { id: { in: ids } }, data: { replyTo: null, parent: null } as never, overrideAccess: true, req })
  await payload.delete({ collection: 'comments', where: { id: { in: ids } }, overrideAccess: true, req, context: { skipCommentCascade: true } })
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

function idFrom(value: unknown): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

async function run(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof CommentError) return json({ error: error.code }, error.status)
    throw error
  }
}

export const commentsHandler: PayloadHandler = async (req) => {
  const denied = checkSecret(req.headers)
  if (denied) return denied

  if (req.method === 'GET') {
    const articleId = idFrom(req.searchParams.get('article'))
    if (articleId === null) return json({ error: 'invalid article' }, 400)
    const viewer = req.searchParams.get('clerkId')
    const page = Math.max(1, Math.min(500, Number(req.searchParams.get('page')) || 1))
    return json(await listComments(req.payload, articleId, { page, viewerClerkId: isClerkId(viewer) ? viewer : null }))
  }

  const body = await readBody(req)
  const writer = await writerFrom(req.payload, body.profile)
  if ('error' in writer) return writer.error

  return run(async () => {
    if (req.method === 'DELETE') {
      const commentId = idFrom(body.commentId)
      if (commentId === null) return json({ error: 'invalid commentId' }, 400)
      await deleteCommentAs(req.payload, writer.reader, commentId)
      return json({ deleted: true })
    }
    const articleId = idFrom(body.articleId)
    if (articleId === null) return json({ error: 'invalid articleId' }, 400)
    const replyTo = body.replyTo === undefined || body.replyTo === null ? null : idFrom(body.replyTo)
    if (body.replyTo && replyTo === null) return json({ error: 'reply-target' }, 400)
    const comment = await postComment(req.payload, writer.reader, { articleId, body: body.body, replyTo })
    return json({ comment }, 201)
  })
}

export const commentVoteHandler: PayloadHandler = async (req) => {
  const denied = checkSecret(req.headers)
  if (denied) return denied
  const body = await readBody(req)
  const writer = await writerFrom(req.payload, body.profile)
  if ('error' in writer) return writer.error
  const commentId = idFrom(body.commentId)
  if (commentId === null) return json({ error: 'invalid commentId' }, 400)
  return run(async () => json(await voteComment(req.payload, writer.reader, commentId, Number(body.value))))
}

export const commentReportHandler: PayloadHandler = async (req) => {
  const denied = checkSecret(req.headers)
  if (denied) return denied
  const body = await readBody(req)
  const writer = await writerFrom(req.payload, body.profile)
  if ('error' in writer) return writer.error
  const commentId = idFrom(body.commentId)
  if (commentId === null) return json({ error: 'invalid commentId' }, 400)
  return run(async () => json(await reportComment(req.payload, writer.reader, commentId, body.reason, body.note)))
}

export const commentModerateHandler: PayloadHandler = async (req) => {
  const denied = checkSecret(req.headers)
  if (denied) return denied
  const body = await readBody(req)
  const writer = await writerFrom(req.payload, body.profile)
  if ('error' in writer) return writer.error
  const commentId = idFrom(body.commentId)
  if (commentId === null) return json({ error: 'invalid commentId' }, 400)
  const action = body.action === 'hide' || body.action === 'restore' ? body.action : null
  if (!action) return json({ error: 'invalid action' }, 400)
  return run(async () => {
    await moderateComment(req.payload, writer.reader, commentId, action)
    return json({ ok: true })
  })
}
