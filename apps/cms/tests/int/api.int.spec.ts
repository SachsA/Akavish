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

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
const RUN = `t${Date.now().toString(36)}`
const created: { collection: 'articles' | 'tags' | 'authors'; id: number | string }[] = []
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
        children: [{ type: 'text', text: 'Body', format: 0, style: '', mode: 'normal', detail: 0, version: 1 }],
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
  const author = await payload.create({ collection: 'authors', data: { name: `${RUN} Author` } as never })
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
    expect(slugify('  Élden Ring: Shadow of the Erdtree! ')).toBe('elden-ring-shadow-of-the-erdtree')
    expect(slugify('GTA VI -- 2026')).toBe('gta-vi-2026')
  })
})

describe('slug field', () => {
  it('generates the slug from the title and suffixes it on a clash', async () => {
    // Two different names (tag names are unique) that slugify to the same thing.
    const a = await payload.create({ collection: 'tags', data: { name: `${RUN} Same Name` } as never })
    created.push({ collection: 'tags', id: a.id })
    const b = await payload.create({ collection: 'tags', data: { name: `${RUN} same-name!` } as never })
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
    expect((renamed.previousSlugs ?? []).map((s: { slug?: string | null }) => s.slug)).toEqual([`${RUN}-old`])
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
