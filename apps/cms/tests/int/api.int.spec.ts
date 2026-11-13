/**
 * Integration tests for the Akavish-specific CMS behaviour: the parts the web
 * app relies on and that a Payload upgrade or a careless edit could break
 * silently. They boot Payload against the local/CI Postgres (migrated), create
 * their own documents under a unique prefix and delete them afterwards.
 *
 * Run: `pnpm test:int` in apps/cms (needs `docker compose up -d` + `pnpm migrate`).
 */
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { slugify } from '@/fields/slug'
import { schedulePublishHandler } from '@/lib/schedule-publish'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
const RUN = `t${Date.now().toString(36)}`
const created: {
  collection: 'articles' | 'tags' | 'authors' | 'games'
  id: number | string
}[] = []
let authorId: number | string

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
        children: [
          {
            type: 'text',
            text: 'Body',
            format: 0,
            style: '',
            mode: 'normal',
            detail: 0,
            version: 1,
          },
        ],
      },
    ],
  },
}

async function createArticle(data: Record<string, unknown>) {
  const doc = await payload.create({
    collection: 'articles',
    data: {
      title: `${RUN} article`,
      excerpt: 'Excerpt',
      content: richText,
      category: 'news',
      status: 'draft',
      author: authorId,
      ...data,
    } as never,
  })
  created.push({ collection: 'articles', id: doc.id })
  return doc
}

beforeAll(async () => {
  payload = await getPayload({ config })
  // Articles require an author.
  const author = await payload.create({
    collection: 'authors',
    data: { name: `${RUN} Author` } as never,
  })
  authorId = author.id
  created.push({ collection: 'authors', id: author.id })
})

afterAll(async () => {
  for (const { collection, id } of created.reverse()) {
    await payload.delete({ collection, id }).catch(() => undefined)
  }
})

describe('slugify', () => {
  it('lowercases, strips accents and collapses punctuation into dashes', () => {
    expect(slugify('  Élden Ring: Shadow of the Erdtree! ')).toBe(
      'elden-ring-shadow-of-the-erdtree',
    )
    expect(slugify('GTA VI -- 2026')).toBe('gta-vi-2026')
  })
})

describe('slug field', () => {
  it('generates the slug from the title and suffixes it on a clash', async () => {
    // Two different names (tag names are unique) that slugify to the same thing.
    const a = await payload.create({
      collection: 'tags',
      data: { name: `${RUN} Same Name` } as never,
    })
    created.push({ collection: 'tags', id: a.id })
    const b = await payload.create({
      collection: 'tags',
      data: { name: `${RUN} same-name!` } as never,
    })
    created.push({ collection: 'tags', id: b.id })

    expect(a.slug).toBe(`${RUN}-same-name`)
    expect(b.slug).toBe(`${RUN}-same-name-2`)
  })
})

describe('articles', () => {
  it('stamps publishedAt when an article is published, not while it is a draft', async () => {
    const draft = await createArticle({ title: `${RUN} dated` })
    expect(draft.publishedAt ?? null).toBeNull()

    const published = await payload.update({
      collection: 'articles',
      id: draft.id,
      data: { status: 'published', _status: 'published' } as never,
    })
    expect(published.publishedAt).toBeTruthy()
  })

  it('is not featured unless the editor ticks it', async () => {
    const doc = await createArticle({ title: `${RUN} not featured` })
    expect(doc.featured).toBe(false)
  })

  it('publishes a scheduled draft and makes it public', async () => {
    // What the admin's "Schedule publish" does: queue the job with a date…
    const draft = await createArticle({ title: `${RUN} scheduled` })
    await payload.jobs.queue({
      task: 'schedulePublish',
      input: { type: 'publish', doc: { relationTo: 'articles', value: String(draft.id) } },
      waitUntil: new Date(Date.now() - 1000),
    } as never)
    // …then the queue runner (autoRun, every minute in the CMS server) picks it up.
    await payload.jobs.run()

    const after = await payload.findByID({ collection: 'articles', id: draft.id, depth: 0 })
    expect(after._status).toBe('published')
    expect(after.status).toBe('published') // synced by the hook, so the site shows it
    expect(after.publishedAt).toBeTruthy()
  })

  it('never un-archives an article on publish', async () => {
    const doc = await createArticle({
      title: `${RUN} archived`,
      status: 'archived',
      _status: 'published',
    })
    expect(doc.status).toBe('archived')
  })

  it('records the old slug when a published article is renamed', async () => {
    const doc = await createArticle({
      title: `${RUN} renamed`,
      slug: `${RUN}-old`,
      status: 'published',
      _status: 'published',
    })
    const renamed = await payload.update({
      collection: 'articles',
      id: doc.id,
      data: { slug: `${RUN}-new` } as never,
    })
    expect(renamed.slug).toBe(`${RUN}-new`)
    expect((renamed.previousSlugs ?? []).map((s: { slug?: string | null }) => s.slug)).toEqual([
      `${RUN}-old`,
    ])
  })

  it('does not record old slugs for drafts (they never had a public URL)', async () => {
    const doc = await createArticle({ title: `${RUN} draft rename`, slug: `${RUN}-draft-old` })
    const renamed = await payload.update({
      collection: 'articles',
      id: doc.id,
      data: { slug: `${RUN}-draft-new` } as never,
    })
    expect(renamed.previousSlugs ?? []).toEqual([])
  })

  it('shows the public only published articles', async () => {
    await createArticle({ title: `${RUN} public`, status: 'published', _status: 'published' })
    await createArticle({ title: `${RUN} hidden` })

    const asPublic = await payload.find({
      collection: 'articles',
      where: { title: { like: RUN } },
      overrideAccess: false, // as an anonymous visitor
      limit: 100,
    })
    const titles = asPublic.docs.map((d) => d.title)
    expect(titles).toContain(`${RUN} public`)
    expect(titles).not.toContain(`${RUN} hidden`)
  })
})

describe('game pages', () => {
  it('list the articles about the game and the ones that also cover it', async () => {
    const game = async (name: string) => {
      const doc = await payload.create({ collection: 'games', data: { name } as never })
      created.push({ collection: 'games', id: doc.id })
      return doc.id
    }
    const g1 = await game(`${RUN} Game One`)
    const g2 = await game(`${RUN} Game Two`)
    const main = await createArticle({ status: 'published', game: g1 })
    const recap = await createArticle({ status: 'published', game: g2, relatedGames: [g1] })
    const other = await createArticle({ status: 'published', game: g2 })

    // The same query as the web's fetchArticles({ gameId }).
    const { docs } = await payload.find({
      collection: 'articles',
      depth: 0,
      where: {
        status: { equals: 'published' },
        or: [{ game: { equals: g1 } }, { relatedGames: { in: [g1] } }],
      },
    })
    const ids = docs.map((d) => d.id)
    expect(ids).toEqual(expect.arrayContaining([main.id, recap.id]))
    expect(ids).not.toContain(other.id)
  })
})

describe('schedule publish endpoint', () => {
  const call = (user: unknown, body: unknown) =>
    schedulePublishHandler({ payload, user, json: async () => body } as never)
  const editor = { id: 1, collection: 'users', role: 'editor' }

  it('only lets editors schedule', async () => {
    expect((await call(null, {})).status).toBe(401)
    // Writers can't publish, so they can't schedule a publication either.
    expect((await call({ id: 1, collection: 'users', role: 'writer' }, {})).status).toBe(403)
  })

  it('refuses a past date, a bad id and a missing article', async () => {
    const doc = await createArticle({ title: `${RUN} schedule bad` })
    expect((await call(editor, { id: doc.id, publishAt: '2020-01-01T00:00:00Z' })).status).toBe(400)
    expect((await call(editor, { id: 'x', publishAt: '2099-01-01T00:00:00Z' })).status).toBe(400)
    const later = new Date(Date.now() + 86_400_000).toISOString()
    expect((await call(editor, { id: 99_999_999, publishAt: later })).status).toBe(404)
  })

  it('queues the same schedulePublish job as the admin button', async () => {
    const doc = await createArticle({ title: `${RUN} schedule ok` })
    const later = new Date(Date.now() + 86_400_000)
    const res = await call(editor, { id: doc.id, publishAt: later.toISOString() })
    expect(res.status).toBe(200)
    const { job } = (await res.json()) as { job: number }
    const queued = await payload.findByID({ collection: 'payload-jobs' as never, id: job })
    expect(queued).toMatchObject({
      taskSlug: 'schedulePublish',
      input: { type: 'publish', doc: { relationTo: 'articles', value: String(doc.id) } },
    })
    expect(new Date((queued as unknown as { waitUntil: string }).waitUntil).getTime()).toBe(
      later.getTime(),
    )
    await payload.delete({ collection: 'payload-jobs' as never, id: job })
  })

  it('replaces the previous schedule, and null cancels it', async () => {
    const doc = await createArticle({ title: `${RUN} schedule move` })
    const pending = async () =>
      (
        await payload.find({
          collection: 'payload-jobs' as never,
          where: { taskSlug: { equals: 'schedulePublish' } } as never,
          pagination: false,
        })
      ).docs.filter(
        (j) =>
          (j as unknown as { input: { doc: { value: string } } }).input.doc.value ===
          String(doc.id),
      )
    const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()
    await call(editor, { id: doc.id, publishAt: day(1) })
    const moved = await call(editor, { id: doc.id, publishAt: day(2) })
    expect(await moved.json()).toMatchObject({ cancelled: 1 })
    const left = await pending()
    expect(left).toHaveLength(1)
    expect(
      new Date((left[0] as unknown as { waitUntil: string }).waitUntil).getTime(),
    ).toBeGreaterThan(Date.now() + 1.5 * 86_400_000)
    const cancelled = await call(editor, { id: doc.id, publishAt: null })
    expect(await cancelled.json()).toMatchObject({ ok: true, cancelled: 1 })
    expect(await pending()).toHaveLength(0)
  })
})
