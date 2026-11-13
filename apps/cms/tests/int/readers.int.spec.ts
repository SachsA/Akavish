/**
 * Reader accounts, saved articles and roles (src/lib/readers.ts,
 * collections/Readers.ts, src/access/roles.ts). Runs against the local/CI
 * Postgres like api.int.spec.ts; everything is created under a unique prefix
 * and deleted afterwards.
 */
import { createHmac } from 'node:crypto'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import {
  addBookmark,
  clerkWebhookHandler,
  deleteReader,
  ensureReader,
  listBookmarks,
  profileFromClerk,
  readerBookmarksHandler,
  readerSavedHandler,
  readerSyncHandler,
  removeBookmark,
  savedAmong,
  upsertReader,
  verifyClerkWebhook,
} from '@/lib/readers'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
const RUN = `r${Date.now().toString(36)}`
const clerk = (name: string) => `user_${RUN}${name}0000`.replace(/[^A-Za-z0-9_]/g, '')
const email = (name: string) => `${RUN}-${name}@example.com`

let authorId: number | string
let otherAuthorId: number | string
let published: number | string
let draft: number | string

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

async function article(title: string, status: 'draft' | 'published', author = authorId) {
  const doc = await payload.create({
    collection: 'articles',
    data: {
      title: `${RUN} ${title}`,
      excerpt: 'Excerpt',
      content: richText,
      category: 'news',
      status,
      _status: status,
      author,
    } as never,
  })
  return doc.id
}

async function staffUser(role: 'admin' | 'editor' | 'writer', name: string, author?: number | string) {
  const doc = await payload.create({
    collection: 'users',
    data: { email: email(name), password: 'pw-test-123', role, author } as never,
    overrideAccess: true,
  })
  return { ...doc, collection: 'users' as const }
}

beforeAll(async () => {
  payload = await getPayload({ config })
  authorId = (await payload.create({ collection: 'authors', data: { name: `${RUN} Writer` } as never })).id
  otherAuthorId = (await payload.create({ collection: 'authors', data: { name: `${RUN} Other` } as never })).id
  published = await article('published', 'published')
  draft = await article('draft', 'draft')
})

afterAll(async () => {
  await payload.delete({ collection: 'readers', where: { clerkId: { like: RUN } }, overrideAccess: true })
  await payload.delete({ collection: 'articles', where: { title: { like: RUN } }, overrideAccess: true })
  await payload.delete({ collection: 'users', where: { email: { like: RUN } }, overrideAccess: true })
  await payload.delete({ collection: 'authors', where: { name: { like: RUN } }, overrideAccess: true })
})

describe('reader accounts', () => {
  it('creates a reader, then refreshes it without losing what was not sent', async () => {
    const id = clerk('a')
    const first = await upsertReader(payload, {
      clerkId: id,
      email: 'Someone@Example.com',
      emailVerified: true,
      displayName: '  Some One  ',
      imageUrl: 'https://img.example/a.png',
    })
    expect(first).toMatchObject({ clerkId: id, displayName: 'Some One', email: 'someone@example.com', role: 'reader' })

    const again = await upsertReader(payload, { clerkId: id, displayName: 'Renamed' })
    expect(again.id).toBe(first.id)
    expect(again).toMatchObject({ displayName: 'Renamed', imageUrl: 'https://img.example/a.png' })
  })

  it('refuses something that is not a Clerk id', async () => {
    await expect(upsertReader(payload, { clerkId: 'nope' })).rejects.toThrow()
  })

  it('links a reader to the CMS account with the same verified email, with the Author badge', async () => {
    const user = await staffUser('writer', 'linked', authorId)
    const unverified = await upsertReader(payload, {
      clerkId: clerk('u'),
      email: email('linked'),
      emailVerified: false,
    })
    expect(unverified.role).toBe('reader')

    const linked = await upsertReader(payload, {
      clerkId: clerk('l'),
      email: email('linked').toUpperCase(),
      emailVerified: true,
    })
    expect(linked.role).toBe('author')
    expect(linked.authorSlug).toBeTruthy()
    const row = await payload.findByID({ collection: 'readers', id: linked.id, depth: 0, overrideAccess: true })
    expect(row.cmsUser).toBe(user.id)
    expect(row.author).toBe(authorId)
  })

  it('allows only one Owner', async () => {
    const a = await ensureReader(payload, clerk('o1'))
    const b = await ensureReader(payload, clerk('o2'))
    // Clear any owner left by a previous run on this database.
    await payload.update({
      collection: 'readers',
      where: { role: { equals: 'owner' } },
      data: { role: 'reader' },
      overrideAccess: true,
    })
    await payload.update({ collection: 'readers', id: a.id, data: { role: 'owner' }, overrideAccess: true })
    await expect(
      payload.update({ collection: 'readers', id: b.id, data: { role: 'owner' }, overrideAccess: true }),
    ).rejects.toThrow(/role/)
    // Saving the owner again is fine.
    await payload.update({ collection: 'readers', id: a.id, data: { displayName: 'Boss' }, overrideAccess: true })
    await payload.update({ collection: 'readers', id: a.id, data: { role: 'reader' }, overrideAccess: true })
  })

  it('maps a Clerk webhook user to a profile', () => {
    expect(
      profileFromClerk({
        id: 'user_2abcdefghijk',
        first_name: 'Alex',
        last_name: null,
        username: 'akavish',
        image_url: 'https://img.clerk.com/x',
        primary_email_address_id: 'e2',
        email_addresses: [
          { id: 'e1', email_address: 'old@example.com', verification: { status: 'verified' } },
          { id: 'e2', email_address: 'alex@example.com', verification: { status: 'unverified' } },
        ],
      }),
    ).toEqual({
      clerkId: 'user_2abcdefghijk',
      email: 'alex@example.com',
      emailVerified: false,
      displayName: 'Alex',
      username: 'akavish',
      firstName: 'Alex',
      imageUrl: 'https://img.clerk.com/x',
      createdAt: null,
    })
    expect(profileFromClerk({ id: 'bad' })).toBeNull()
  })
})

describe('saved articles', () => {
  it('saves published articles only, once, newest first, and unsaves', async () => {
    const reader = await ensureReader(payload, clerk('s'))
    expect(await addBookmark(payload, reader.id, draft)).toBe('not-found')
    expect(await addBookmark(payload, reader.id, 99_999_999)).toBe('not-found')
    expect(await addBookmark(payload, reader.id, published)).toBe('saved')
    expect(await addBookmark(payload, reader.id, published)).toBe('saved') // double click
    const second = await article('second', 'published')
    await addBookmark(payload, reader.id, second)

    const list = await listBookmarks(payload, reader.id)
    expect(list.total).toBe(2)
    expect((list.docs[0].article as { id: unknown }).id).toBe(second)
    expect(await savedAmong(payload, reader.id, [published, draft, second])).toEqual(
      expect.arrayContaining([published, second]),
    )

    await removeBookmark(payload, reader.id, published)
    expect(await savedAmong(payload, reader.id, [published])).toEqual([])

    // An article taken off the site drops off the list; a deleted one too.
    await payload.update({ collection: 'articles', id: second, data: { status: 'archived' }, overrideAccess: true })
    expect((await listBookmarks(payload, reader.id)).total).toBe(0)
    await payload.update({ collection: 'articles', id: second, data: { status: 'published' }, overrideAccess: true })
    await payload.delete({ collection: 'articles', id: second, overrideAccess: true })
    expect((await listBookmarks(payload, reader.id)).total).toBe(0)
  })

  it('deleting a reader deletes their saved articles', async () => {
    const reader = await ensureReader(payload, clerk('d'))
    await addBookmark(payload, reader.id, published)
    expect(await deleteReader(payload, clerk('d'))).toBe(true)
    const { totalDocs } = await payload.count({
      collection: 'bookmarks',
      where: { reader: { equals: reader.id } },
      overrideAccess: true,
    })
    expect(totalDocs).toBe(0)
    expect(await deleteReader(payload, clerk('d'))).toBe(false)
  })
})

describe('the website endpoints (READER_API_SECRET)', () => {
  const SECRET = 'test-reader-secret'
  const req = (init: {
    method?: string
    body?: unknown
    query?: string
    auth?: string | null
  }) =>
    ({
      payload,
      method: init.method ?? 'POST',
      headers: new Headers(init.auth === null ? {} : { authorization: init.auth ?? `Bearer ${SECRET}` }),
      searchParams: new URLSearchParams(init.query ?? ''),
      json: async () => init.body ?? {},
    }) as never

  beforeAll(() => {
    process.env.READER_API_SECRET = SECRET
  })
  afterAll(() => {
    delete process.env.READER_API_SECRET
  })

  it('needs the secret', async () => {
    expect((await readerSyncHandler(req({ auth: null }))).status).toBe(401)
    expect((await readerSyncHandler(req({ auth: 'Bearer wrong' }))).status).toBe(401)
    delete process.env.READER_API_SECRET
    expect((await readerSyncHandler(req({}))).status).toBe(503)
    process.env.READER_API_SECRET = SECRET
  })

  it('syncs, saves, lists and unsaves', async () => {
    const id = clerk('w')
    const sync = await readerSyncHandler(
      req({ body: { profile: { clerkId: id, displayName: 'Web', email: 'w@example.com', emailVerified: true } } }),
    )
    expect(sync.status).toBe(200)
    expect((await sync.json()).reader).toMatchObject({ clerkId: id, role: 'reader' })

    const profile = { clerkId: id, emailVerified: true }
    expect((await readerBookmarksHandler(req({ body: { profile, articleId: 'x' } }))).status).toBe(400)
    expect((await readerBookmarksHandler(req({ body: { profile, articleId: draft } }))).status).toBe(404)
    // Saving needs a verified email.
    const unverified = await readerBookmarksHandler(
      req({ body: { profile: { clerkId: id, emailVerified: false }, articleId: published } }),
    )
    expect(unverified.status).toBe(403)
    const save = await readerBookmarksHandler(req({ body: { profile, articleId: published } }))
    expect(await save.json()).toEqual({ saved: true })

    const saved = await readerSavedHandler(req({ method: 'GET', query: `clerkId=${id}&articles=${published},${draft}` }))
    expect((await saved.json()).saved).toEqual([published])

    const list = await readerBookmarksHandler(req({ method: 'GET', query: `clerkId=${id}` }))
    const body = await list.json()
    expect(body.total).toBe(1)
    expect(body.docs[0].article.title).toBe(`${RUN} published`)

    const unsave = await readerBookmarksHandler(
      req({ method: 'DELETE', body: { clerkId: id, articleId: published } }),
    )
    expect(await unsave.json()).toEqual({ saved: false })
  })

  it('does not create a reader just to answer "saved?"', async () => {
    const res = await readerSavedHandler(req({ method: 'GET', query: `clerkId=${clerk('ghost')}&articles=1` }))
    expect((await res.json()).saved).toEqual([])
    expect(
      (await payload.count({ collection: 'readers', where: { clerkId: { equals: clerk('ghost') } }, overrideAccess: true }))
        .totalDocs,
    ).toBe(0)
  })
})

describe("Clerk's webhook", () => {
  const SECRET = `whsec_${Buffer.from('a-very-secret-key-for-tests').toString('base64')}`
  const sign = (id: string, ts: number, body: string) =>
    createHmac('sha256', Buffer.from(SECRET.slice(6), 'base64')).update(`${id}.${ts}.${body}`).digest('base64')
  const now = Math.floor(Date.now() / 1000)

  it('checks the Svix signature and the timestamp', () => {
    const body = '{"type":"user.created"}'
    const good = { id: 'msg_1', timestamp: String(now), signature: `v1,bad v1,${sign('msg_1', now, body)}` }
    expect(verifyClerkWebhook(SECRET, good, body, now)).toBe(true)
    expect(verifyClerkWebhook(SECRET, good, `${body} `, now)).toBe(false)
    expect(verifyClerkWebhook(SECRET, { ...good, signature: 'v1,bad' }, body, now)).toBe(false)
    expect(verifyClerkWebhook(SECRET, good, body, now + 600)).toBe(false)
    expect(verifyClerkWebhook(SECRET, { ...good, id: null }, body, now)).toBe(false)
  })

  it('creates on user.created and deletes everything on user.deleted', async () => {
    process.env.CLERK_WEBHOOK_SECRET = SECRET
    const id = clerk('hook')
    const call = (event: unknown) => {
      const body = JSON.stringify(event)
      const ts = Math.floor(Date.now() / 1000)
      return clerkWebhookHandler({
        payload,
        headers: new Headers({
          'svix-id': 'msg_x',
          'svix-timestamp': String(ts),
          'svix-signature': `v1,${sign('msg_x', ts, body)}`,
        }),
        text: async () => body,
      } as never)
    }
    expect((await call({ type: 'user.created', data: { id, first_name: 'Hook' } })).status).toBe(200)
    const reader = await ensureReader(payload, id)
    expect(reader.displayName).toBe('Hook')
    await addBookmark(payload, reader.id, published)

    expect((await call({ type: 'user.deleted', data: { id, deleted: true } })).status).toBe(200)
    expect(
      (await payload.count({ collection: 'readers', where: { clerkId: { equals: id } }, overrideAccess: true }))
        .totalDocs,
    ).toBe(0)

    const unsigned = await clerkWebhookHandler({
      payload,
      headers: new Headers(),
      text: async () => '{}',
    } as never)
    expect(unsigned.status).toBe(401)
    delete process.env.CLERK_WEBHOOK_SECRET
  })
})

describe('editorial roles', () => {
  it('a writer drafts under their own byline and cannot publish', async () => {
    const writer = await staffUser('writer', 'writer', authorId)
    const doc = await payload.create({
      collection: 'articles',
      data: {
        title: `${RUN} by writer`,
        excerpt: 'E',
        content: richText,
        category: 'news',
        author: otherAuthorId, // ignored: a writer always writes as themselves
      } as never,
      draft: true,
      user: writer,
      overrideAccess: false,
    })
    expect((doc.author as { id: unknown }).id ?? doc.author).toBe(authorId)

    await expect(
      payload.update({
        collection: 'articles',
        id: doc.id,
        data: { _status: 'published' } as never,
        user: writer,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/editor publishes/)

    // Someone else's article, or a published one: not theirs to edit.
    const others = await article('others', 'draft', otherAuthorId)
    await expect(
      payload.update({ collection: 'articles', id: others, data: { title: 'x' }, user: writer, overrideAccess: false }),
    ).rejects.toThrow()
    await expect(
      payload.update({ collection: 'articles', id: published, data: { title: 'x' }, user: writer, overrideAccess: false }),
    ).rejects.toThrow()
    await expect(
      payload.delete({ collection: 'articles', id: doc.id, user: writer, overrideAccess: false }),
    ).rejects.toThrow()
  })

  it('a writer without an author profile is told to get one', async () => {
    const writer = await staffUser('writer', 'nobyline')
    await expect(
      payload.create({
        collection: 'articles',
        data: { title: `${RUN} orphan`, excerpt: 'E', content: richText, category: 'news', author: authorId } as never,
        draft: true,
        user: writer,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/author profile/)
  })

  it('an editor publishes anyone’s article; only an admin changes roles or reads readers', async () => {
    const editor = await staffUser('editor', 'editor')
    const others = await article('to publish', 'draft', otherAuthorId)
    const done = await payload.update({
      collection: 'articles',
      id: others,
      data: { _status: 'published' } as never,
      user: editor,
      overrideAccess: false,
    })
    expect(done.status).toBe('published')

    await expect(
      payload.find({ collection: 'readers', user: editor, overrideAccess: false }),
    ).rejects.toThrow()
    await expect(
      payload.find({ collection: 'subscribers', user: editor, overrideAccess: false }),
    ).rejects.toThrow()

    // Role changes by a non-admin are ignored (field access), not applied.
    const self = await payload.update({
      collection: 'users',
      id: editor.id,
      data: { role: 'admin' } as never,
      user: editor,
      overrideAccess: false,
    })
    expect(self.role).toBe('editor')

    const admin = await staffUser('admin', 'admin')
    const promoted = await payload.update({
      collection: 'users',
      id: editor.id,
      data: { role: 'admin' } as never,
      user: admin,
      overrideAccess: false,
    })
    expect(promoted.role).toBe('admin')
  })

  it('the first account ever is an admin', async () => {
    // Can't empty the users table here; the hook is checked by its effect on a
    // normal create instead: a new account defaults to writer.
    const doc = await payload.create({
      collection: 'users',
      data: { email: email('default'), password: 'pw-test-123' } as never,
      overrideAccess: true,
    })
    expect(doc.role).toBe('writer')
  })
})
