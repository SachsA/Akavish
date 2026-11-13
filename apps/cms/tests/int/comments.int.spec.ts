/**
 * Comments (src/lib/comments.ts, collections/Comments.ts): the rules decided on
 * 2026-11-13. Local/CI Postgres like the other int tests; everything under a
 * unique prefix, deleted afterwards.
 */
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import {
  cleanBody,
  commentReportHandler,
  commentsHandler,
  deleteCommentAs,
  listComments,
  moderateComment,
  moderationMessage,
  postComment,
  reportComment,
  voteComment,
} from '@/lib/comments'
import { deleteReader, findReader, upsertReader, type ReaderDoc } from '@/lib/readers'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

let payload: Payload
const RUN = `c${Date.now().toString(36)}`
const clerkId = (n: string) => `user_${RUN}${n}0000`
const OLD = '2026-01-01T00:00:00.000Z'
let authorId: number | string
let article: number | string
const later = (s: number) => new Date(Date.now() + s * 1000)

const richText = {
  root: {
    type: 'root',
    format: '' as const,
    indent: 0,
    version: 1,
    direction: 'ltr' as const,
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [{ type: 'text', text: 'Body', format: 0, style: '', mode: 'normal', detail: 0, version: 1 }],
      },
    ],
  },
}

async function newArticle(title: string, extra: Record<string, unknown> = {}) {
  const doc = await payload.create({
    collection: 'articles',
    data: {
      title: `${RUN} ${title}`,
      excerpt: 'E',
      content: richText,
      category: 'news',
      status: 'published',
      _status: 'published',
      author: authorId,
      ...extra,
    } as never,
  })
  return doc.id
}

async function reader(name: string, extra: Partial<{ role: string; createdAt: string; verified: boolean }> = {}) {
  await upsertReader(payload, {
    clerkId: clerkId(name),
    username: `${RUN}${name}`,
    emailVerified: extra.verified ?? true,
    createdAt: extra.createdAt ?? OLD,
  })
  const doc = (await findReader(payload, clerkId(name)))!
  if (extra.role) {
    await payload.update({ collection: 'readers', id: doc.id, data: { role: extra.role } as never, overrideAccess: true })
  }
  return (await findReader(payload, clerkId(name)))!
}

/** A comment posted "later" so the 30 s pacing never gets in the way. */
let tick = 0
const post = (r: ReaderDoc, body: string, replyTo?: number | string, on = article) =>
  postComment(payload, r, { articleId: on, body, replyTo }, later(40 * ++tick))

beforeAll(async () => {
  payload = await getPayload({ config })
  authorId = (await payload.create({ collection: 'authors', data: { name: `${RUN} A` } as never })).id
  article = await newArticle('main')
  await payload.updateGlobal({ slug: 'community-settings', data: { commentsEnabled: true, autoHideReports: 3 } as never })
})

afterAll(async () => {
  await payload.delete({ collection: 'readers', where: { clerkId: { like: RUN } }, overrideAccess: true })
  await payload.delete({ collection: 'articles', where: { title: { like: RUN } }, overrideAccess: true })
  await payload.delete({ collection: 'authors', where: { name: { like: RUN } }, overrideAccess: true })
  await payload.updateGlobal({ slug: 'community-settings', data: { commentsEnabled: true, autoHideReports: 3 } as never })
}, 180_000)

describe('text', () => {
  it('keeps plain text tidy', () => {
    expect(cleanBody('  hi\r\n\r\n\r\n\r\nthere ​\u0007 ')).toBe('hi\n\nthere')
    expect(cleanBody(undefined)).toBe('')
  })
})

describe('posting', () => {
  it('posts, threads one level deep and names whom a reply answers', async () => {
    const alice = await reader('alice')
    const bob = await reader('bob')
    const top = await post(alice, 'First!')
    expect(top).toMatchObject({ body: 'First!', author: { name: `${RUN}alice`, role: 'reader' }, mine: true, parentId: null })

    const r1 = await post(bob, 'Reply to Alice', top.id)
    expect(r1).toMatchObject({ parentId: top.id, replyToId: top.id, replyToName: `${RUN}alice` })
    const r2 = await post(alice, 'Reply to Bob', r1.id)
    // A reply to a reply stays in the same thread, and says it answers Bob.
    expect(r2).toMatchObject({ parentId: top.id, replyToId: r1.id, replyToName: `${RUN}bob` })
  })

  it('refuses what the rules refuse', async () => {
    const carol = await reader('carol')
    await expect(post(carol, '   ')).rejects.toMatchObject({ code: 'empty' })
    await expect(post(carol, 'x'.repeat(2001))).rejects.toMatchObject({ code: 'too-long' })

    const young = await reader('young', { createdAt: new Date().toISOString() })
    await expect(postComment(payload, young, { articleId: article, body: 'hi' }, new Date())).rejects.toMatchObject({
      code: 'too-new',
    })

    // 30 s between two comments, and never the same text twice in a day.
    await post(carol, 'Hello there')
    await expect(postComment(payload, carol, { articleId: article, body: 'Again' }, new Date())).rejects.toMatchObject({
      code: 'slow-down',
    })
    await expect(post(carol, 'HELLO THERE')).rejects.toMatchObject({ code: 'duplicate' })

    const closed = await newArticle('closed', { commentsClosed: true })
    await expect(post(carol, 'On a closed article', undefined, closed)).rejects.toMatchObject({ code: 'closed' })

    await payload.updateGlobal({ slug: 'community-settings', data: { commentsEnabled: false } as never })
    await expect(post(carol, 'While off')).rejects.toMatchObject({ code: 'disabled' })
    expect((await listComments(payload, article)).enabled).toBe(false)
    await payload.updateGlobal({ slug: 'community-settings', data: { commentsEnabled: true } as never })
  })

  it('caps a reader at 30 comments a day', async () => {
    const dave = await reader('dave')
    const other = await newArticle('daily')
    for (let i = 0; i < 30; i++) await post(dave, `Comment number ${i}`, undefined, other)
    await expect(post(dave, 'One too many', undefined, other)).rejects.toMatchObject({ code: 'daily-limit' })
  })
})

describe('listing, votes and moderation', () => {
  it('sorts by likes then oldest, replies oldest first, with the viewer’s own state', async () => {
    const on = await newArticle('list')
    const [e, f, g] = [await reader('e'), await reader('f'), await reader('g')]
    const oldest = await post(e, 'Oldest', undefined, on)
    const liked = await post(f, 'Liked', undefined, on)
    const newest = await post(g, 'Newest', undefined, on)
    const reply = await post(g, 'A reply', oldest.id, on)

    expect(await voteComment(payload, e, liked.id, 1)).toMatchObject({ likes: 1, dislikes: 0, myVote: 1 })
    await voteComment(payload, g, liked.id, -1)
    await expect(voteComment(payload, f, liked.id, 1)).rejects.toMatchObject({ code: 'own' })

    const list = await listComments(payload, on, { viewerClerkId: clerkId('e') })
    expect(list.comments.map((c) => c.body)).toEqual(['Liked', 'Oldest', 'Newest'])
    expect(list.total).toBe(4)
    expect(list.comments[0]).toMatchObject({ likes: 1, dislikes: 1, myVote: 1, mine: false })
    expect(list.comments[1]).toMatchObject({ mine: true })
    expect(list.comments[1].replies?.map((r) => r.id)).toEqual([reply.id])
    expect(list.viewer).toMatchObject({ role: 'reader', canModerate: false, verified: true })

    // Switch and take back a vote.
    expect(await voteComment(payload, e, liked.id, -1)).toMatchObject({ likes: 0, dislikes: 2 })
    expect(await voteComment(payload, e, liked.id, 0)).toMatchObject({ likes: 0, dislikes: 1, myVote: 0 })
    expect(newest.status).toBe('visible')
  })

  it('reports: once per reader, hidden at the threshold, sent to the moderation channel', async () => {
    process.env.MODERATION_DISCORD_WEBHOOK_URL = 'https://discord.example/webhook'
    const sent: string[] = []
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      sent.push(JSON.parse(String((init as RequestInit).body)).content)
      return new Response(null, { status: 204 })
    })
    const on = await newArticle('reports')
    const author = await reader('troll')
    const bad = await post(author, 'Buy cheap stuff', undefined, on)
    const [r1, r2, r3] = [await reader('r1'), await reader('r2'), await reader('r3')]
    await expect(reportComment(payload, author, bad.id, 'spam', null)).rejects.toMatchObject({ code: 'own' })
    await expect(reportComment(payload, r1, bad.id, 'nonsense', null)).rejects.toMatchObject({ code: 'bad-reason' })
    expect(await reportComment(payload, r1, bad.id, 'spam', 'ads')).toEqual({ reported: true, hidden: false })
    expect(await reportComment(payload, r1, bad.id, 'spam', null)).toEqual({ reported: true, hidden: false })
    await reportComment(payload, r2, bad.id, 'spam', null)
    expect(await reportComment(payload, r3, bad.id, 'other', null)).toEqual({ reported: true, hidden: true })
    await new Promise((r) => setTimeout(r, 50))
    expect(sent).toHaveLength(3)
    expect(sent[2]).toContain('hidden automatically')
    expect(sent[0]).toContain('> Buy cheap stuff')
    expect(sent[0]).not.toContain(`${RUN}troll`) // no reader names in Discord
    fetchSpy.mockRestore()
    delete process.env.MODERATION_DISCORD_WEBHOOK_URL

    // Hidden: placeholder for readers, text for moderators, who can restore it.
    const asReader = await listComments(payload, on, { viewerClerkId: clerkId('r1') })
    expect(asReader.comments[0]).toMatchObject({ status: 'hidden', body: null, reported: true })
    const mod = await reader('mod', { role: 'moderator' })
    const asMod = await listComments(payload, on, { viewerClerkId: clerkId('mod') })
    expect(asMod.comments[0].body).toBe('Buy cheap stuff')
    await expect(moderateComment(payload, r1, bad.id, 'restore')).rejects.toMatchObject({ code: 'forbidden' })
    await moderateComment(payload, mod, bad.id, 'restore')
    const { docs } = await payload.find({ collection: 'comment-reports', where: { comment: { equals: bad.id } }, overrideAccess: true })
    expect(docs.every((d) => d.status === 'resolved')).toBe(true)
    await moderateComment(payload, mod, bad.id, 'hide')
  })

  it('deleting: own only (moderators any), placeholder while replies remain', async () => {
    const on = await newArticle('delete')
    const [h, i] = [await reader('h'), await reader('i')]
    const top = await post(h, 'Top', undefined, on)
    const reply = await post(i, 'Reply', top.id, on)
    await expect(deleteCommentAs(payload, i, top.id)).rejects.toMatchObject({ code: 'forbidden' })

    await deleteCommentAs(payload, h, top.id)
    let list = await listComments(payload, on)
    expect(list.comments[0]).toMatchObject({ id: top.id, status: 'deleted', body: null, author: null })
    expect(list.comments[0].replies).toHaveLength(1)

    // The last reply gone, the placeholder goes too.
    await deleteCommentAs(payload, i, reply.id)
    list = await listComments(payload, on)
    expect(list.comments).toHaveLength(0)

    const admin = await reader('admin', { role: 'admin' })
    const lone = await post(i, 'Alone', undefined, on)
    await deleteCommentAs(payload, admin, lone.id)
    expect((await listComments(payload, on)).comments).toHaveLength(0)
  })

  it('a deleted account takes its comments and votes with it', async () => {
    const on = await newArticle('account')
    const [j, k] = [await reader('j'), await reader('k')]
    const top = await post(j, 'Mine', undefined, on)
    const theirs = await post(k, 'Theirs', undefined, on)
    await post(k, 'Answer', top.id, on)
    await voteComment(payload, j, theirs.id, 1)

    await deleteReader(payload, clerkId('j'))
    const list = await listComments(payload, on)
    const placeholder = list.comments.find((c) => c.id === top.id)
    expect(placeholder).toMatchObject({ status: 'deleted', body: null, author: null })
    expect(list.comments.find((c) => c.id === theirs.id)?.likes).toBe(0)
  })

  it('deleting an article deletes its comments', async () => {
    const on = await newArticle('gone')
    const l = await reader('l')
    const top = await post(l, 'Bye', undefined, on)
    await post(l, 'Bye again', top.id, on)
    await payload.delete({ collection: 'articles', id: on, overrideAccess: true })
    const { totalDocs } = await payload.count({ collection: 'comments', where: { article: { equals: on } }, overrideAccess: true })
    expect(totalDocs).toBe(0)
  })
})

describe('the website endpoints', () => {
  const SECRET = 'comments-secret'
  const req = (init: { method?: string; body?: unknown; query?: string }) =>
    ({
      payload,
      method: init.method ?? 'POST',
      headers: new Headers({ authorization: `Bearer ${SECRET}` }),
      searchParams: new URLSearchParams(init.query ?? ''),
      json: async () => init.body ?? {},
    }) as never
  const profile = (n: string, verified = true) => ({
    clerkId: clerkId(n),
    username: `${RUN}${n}`,
    emailVerified: verified,
    createdAt: OLD,
  })

  beforeAll(() => {
    process.env.READER_API_SECRET = SECRET
  })
  afterAll(() => {
    delete process.env.READER_API_SECRET
  })

  it('only verified, unbanned accounts write', async () => {
    const on = await newArticle('http')
    const unverified = await commentsHandler(req({ body: { profile: profile('u', false), articleId: on, body: 'hi' } }))
    expect(unverified.status).toBe(403)
    expect(await unverified.json()).toEqual({ error: 'unverified' })

    const ok = await commentsHandler(req({ body: { profile: profile('m'), articleId: on, body: 'Hello from the site' } }))
    expect(ok.status).toBe(201)
    const { comment } = await ok.json()

    const banned = (await findReader(payload, clerkId('m')))!
    await payload.update({ collection: 'readers', id: banned.id, data: { banned: true } as never, overrideAccess: true })
    const after = await commentsHandler(req({ body: { profile: profile('m'), articleId: on, body: 'Still here?' } }))
    expect(await after.json()).toEqual({ error: 'banned' })
    const report = await commentReportHandler(req({ body: { profile: profile('m'), commentId: comment.id, reason: 'spam' } }))
    expect(report.status).toBe(403)

    const list = await commentsHandler(req({ method: 'GET', query: `article=${on}&clerkId=${clerkId('m')}` }))
    const body = await list.json()
    expect(body.comments[0]).toMatchObject({ body: 'Hello from the site', mine: true })
    expect(body.viewer).toMatchObject({ banned: true })
  })

  it('formats the moderation message', () => {
    const text = moderationMessage({
      commentId: 9,
      reason: 'harassment',
      note: 'insults',
      body: 'line one\nline two',
      reports: 1,
      threshold: 3,
      autoHidden: false,
      articleSlug: 'gta-vi',
      webUrl: 'https://akavish.gg',
      cmsUrl: 'https://cms.akavish.gg',
    })
    expect(text).toContain('Harassment or hate')
    expect(text).toContain('> line one\n> line two')
    expect(text).toContain('https://akavish.gg/article/gta-vi#comment-9')
    expect(text).toContain('https://cms.akavish.gg/admin/collections/comments/9')
  })
})
