/**
 * The French version (lib/translate.ts) end to end against the local/CI
 * Postgres, with Claude faked: publishing marks the article "pending" and
 * queues the job, the job fills the `fr` group (structure, bold and links
 * kept), a hand edit sticks until the English changes, tags get a French name.
 */
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import {
  liveArticlesHandler,
  translateArticle,
  translateTaxonomy,
  queueMissingTranslations,
} from '@/lib/translate'
import type { FetchLike } from '@/scout/anthropic'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
const RUN = `tr${Date.now().toString(36)}`
const created: Array<{ collection: 'articles' | 'tags' | 'authors'; id: number | string }> = []
let authorId: number | string

const text = (t: string, format = 0) => ({
  type: 'text',
  text: t,
  format,
  style: '',
  mode: 'normal',
  detail: 0,
  version: 1,
})
const el = (type: string, children: unknown[], extra: Record<string, unknown> = {}) => ({
  type,
  children,
  format: '',
  indent: 0,
  version: 1,
  direction: 'ltr',
  ...extra,
})
const body = (lead: string) => ({
  root: el('root', [
    el('paragraph', [text(lead)], { textFormat: 0 }),
    el('list', [el('listitem', [text('Metro 2039', 1), text(' · Feb 4 (PS5).')], { value: 1 })], {
      listType: 'bullet',
      start: 1,
      tag: 'ul',
    }),
    el('paragraph', [
      text('More on '),
      el('link', [text('HLTV')], {
        version: 3,
        fields: { linkType: 'custom', url: 'https://www.hltv.org/', newTab: true },
      }),
    ]),
  ]),
})

// Claude, faked: "translates" by prefixing FR, and puts the date in French.
const calls: string[] = []
const fakeClaude: FetchLike = async (_url, init) => {
  const req = JSON.parse(String(init.body)) as {
    tools: Array<{ name: string }>
    messages: Array<{ content: string }>
  }
  calls.push(req.tools[0].name)
  const input = JSON.parse(req.messages[0].content)
  const answer =
    req.tools[0].name === 'french_texts'
      ? { texts: (input as string[]).map((t) => (t === 'Release dates' ? 'Dates de sortie' : t)) }
      : {
          title: `FR ${input.title}`,
          excerpt: `FR ${input.excerpt}`,
          seo_title: '',
          seo_description: '',
          cover_alt: '',
          segments: (input.segments as string[]).map((s) =>
            s
              .replace('Feb 4', '4 févr.')
              .replace('More on ', 'Plus sur ')
              .replace(/^([A-Z][a-z]+ [a-z]+)$/, 'FR $1'),
          ),
        }
  return Response.json({
    content: [{ type: 'tool_use', name: req.tools[0].name, input: answer }],
    usage: { input_tokens: 1000, output_tokens: 500 },
  })
}

async function article(id: number | string) {
  return (await payload.findByID({
    collection: 'articles',
    id,
    depth: 0,
    overrideAccess: true,
  })) as unknown as {
    title: string
    fr?: {
      title?: string
      excerpt?: string
      content?: unknown
      status?: string
      sourceHash?: string
    }
  }
}

async function queuedFor(id: number | string) {
  const { docs } = await payload.find({
    collection: 'payload-jobs',
    where: {
      and: [{ taskSlug: { equals: 'translateArticle' } }, { completedAt: { exists: false } }],
    },
    limit: 100,
    overrideAccess: true,
  })
  return docs.filter((j) => (j.input as { articleId?: number })?.articleId === Number(id))
}

beforeAll(async () => {
  payload = await getPayload({ config })
  const author = await payload.create({
    collection: 'authors',
    data: { name: `${RUN} Author` } as never,
  })
  authorId = author.id
  created.push({ collection: 'authors', id: author.id })
})

afterAll(async () => {
  for (const c of created.reverse()) {
    await payload
      .delete({ collection: c.collection, id: c.id, overrideAccess: true })
      .catch(() => {})
  }
  await payload.delete({
    collection: 'payload-jobs',
    where: { taskSlug: { in: ['translateArticle', 'translateTaxonomy'] } },
    overrideAccess: true,
  })
  await payload.delete({
    collection: 'scout-usage',
    where: { purpose: { equals: 'translate' } },
    overrideAccess: true,
  })
})

describe('French version', () => {
  it('a draft is not translated; publishing queues the translation', async () => {
    const doc = await payload.create({
      collection: 'articles',
      data: {
        title: `${RUN} Metro dated`,
        excerpt: 'Metro has a date.',
        content: body('Metro 2039 is dated'),
        category: 'news',
        status: 'draft',
        author: authorId,
      } as never,
      overrideAccess: true,
    })
    created.push({ collection: 'articles', id: doc.id })
    expect((await article(doc.id)).fr?.status ?? null).toBeNull()
    expect(await queuedFor(doc.id)).toHaveLength(0)

    await payload.update({
      collection: 'articles',
      id: doc.id,
      data: { status: 'published', _status: 'published' } as never,
      overrideAccess: true,
    })
    expect((await article(doc.id)).fr?.status).toBe('pending')
    expect(await queuedFor(doc.id)).toHaveLength(1)

    // Another save while pending doesn't queue a second job.
    await payload.update({
      collection: 'articles',
      id: doc.id,
      data: { excerpt: 'Metro has a date now.' } as never,
      overrideAccess: true,
    })
    expect(await queuedFor(doc.id)).toHaveLength(1)
  })

  it('the job fills the French version, keeping bold, lists and links', async () => {
    const id = created.find((c) => c.collection === 'articles')!.id
    expect(await translateArticle(payload, id, { fetchImpl: fakeClaude, apiKey: 'test' })).toBe(
      'translated',
    )
    const doc = await article(id)
    expect(doc.fr?.title).toBe(`FR ${RUN} Metro dated`)
    expect(doc.fr?.excerpt).toBe('FR Metro has a date now.')
    expect(doc.fr?.status).toBe('auto')
    // Still published (the job's save doesn't turn it into a draft).
    const raw = (await payload.findByID({
      collection: 'articles',
      id,
      depth: 0,
      overrideAccess: true,
    })) as unknown as {
      status: string
      _status: string
    }
    expect([raw.status, raw._status]).toEqual(['published', 'published'])
    const json = JSON.stringify(doc.fr?.content)
    const texts: Array<{ text: string; format: number }> = []
    const walk = (n: { type?: string; text?: string; format?: number; children?: unknown[] }) => {
      if (n.type === 'text') texts.push({ text: n.text!, format: n.format! })
      for (const c of n.children ?? []) walk(c as typeof n)
    }
    walk((doc.fr?.content as { root: never }).root)
    expect(texts).toContainEqual({ text: 'Metro 2039', format: 1 })
    expect(texts).toContainEqual({ text: ' · 4 févr. (PS5).', format: 0 })
    expect(texts).toContainEqual({ text: 'Plus sur ', format: 0 })
    expect(json).toContain('https://www.hltv.org/')
    // The English is untouched, and nothing new is queued by the job's own save.
    expect(doc.title).toBe(`${RUN} Metro dated`)
    expect(await translateArticle(payload, id, { fetchImpl: fakeClaude, apiKey: 'test' })).toBe(
      'up-to-date',
    )
  })

  it('a hand edit of the French sticks until the English changes', async () => {
    const id = created.find((c) => c.collection === 'articles')!.id
    const before = await article(id)
    await payload.update({
      collection: 'articles',
      id,
      data: { fr: { ...before.fr, title: 'Metro 2039 a une date' } } as never,
      overrideAccess: true,
    })
    let doc = await article(id)
    expect(doc.fr?.status).toBe('edited')
    expect(doc.fr?.title).toBe('Metro 2039 a une date')

    await payload.update({
      collection: 'articles',
      id,
      data: { title: `${RUN} Metro 2039 dated` } as never,
      overrideAccess: true,
    })
    doc = await article(id)
    expect(doc.fr?.status).toBe('pending')
    expect(await translateArticle(payload, id, { fetchImpl: fakeClaude, apiKey: 'test' })).toBe(
      'translated',
    )
    expect((await article(id)).fr?.title).toBe(`FR ${RUN} Metro 2039 dated`)
  })

  it('a French version written by hand is kept, nothing queued', async () => {
    const doc = await payload.create({
      collection: 'articles',
      data: {
        title: `${RUN} By hand`,
        excerpt: 'Hand.',
        content: body('Hand made'),
        category: 'news',
        status: 'published',
        _status: 'published',
        author: authorId,
      } as never,
      overrideAccess: true,
    })
    created.push({ collection: 'articles', id: doc.id })
    await payload.delete({
      collection: 'payload-jobs',
      where: { taskSlug: { equals: 'translateArticle' } },
      overrideAccess: true,
    })
    // Saved again with the French filled in by hand, and the same English
    // content sent back in another key order (as the admin form does).
    const current = await article(doc.id)
    const reordered = JSON.parse(
      JSON.stringify((current as unknown as { content: unknown }).content),
      (_k, v) =>
        v && typeof v === 'object' && !Array.isArray(v)
          ? Object.fromEntries(Object.entries(v).reverse())
          : v,
    )
    await payload.update({
      collection: 'articles',
      id: doc.id,
      data: {
        content: reordered,
        fr: { ...current.fr, title: 'Fait main', excerpt: 'Main.' },
      } as never,
      overrideAccess: true,
    })
    const after = await article(doc.id)
    expect(after.fr?.status).toBe('edited')
    expect(after.fr?.title).toBe('Fait main')
    expect(await queuedFor(doc.id)).toHaveLength(0)
  })

  it('a live showcase page stays in English until the live ends', async () => {
    const doc = await payload.create({
      collection: 'articles',
      data: {
        title: `${RUN} Live show`,
        excerpt: 'Live.',
        content: body('Live now'),
        category: 'conference',
        status: 'draft',
        author: authorId,
      } as never,
      overrideAccess: true,
    })
    created.push({ collection: 'articles', id: doc.id })
    const ev = await payload.create({
      collection: 'scout-events',
      data: {
        name: `${RUN} Show`,
        status: 'live',
        startedAt: new Date().toISOString(),
        article: doc.id,
      } as never,
      overrideAccess: true,
    })
    try {
      // Published, then updated as the show goes: never queued.
      await payload.update({
        collection: 'articles',
        id: doc.id,
        data: { status: 'published', _status: 'published' } as never,
        overrideAccess: true,
      })
      await payload.update({
        collection: 'articles',
        id: doc.id,
        data: { content: body('Live, later') } as never,
        overrideAccess: true,
      })
      expect((await article(doc.id)).fr?.status ?? null).toBeNull()
      expect(await queuedFor(doc.id)).toHaveLength(0)
      const res = await liveArticlesHandler({ payload } as never)
      expect(((await res.json()) as { ids: number[] }).ids).toContain(Number(doc.id))

      // Once the live has ended, a change is translated as usual.
      await payload.update({
        collection: 'scout-events',
        id: ev.id,
        data: { status: 'ended' } as never,
        overrideAccess: true,
      })
      await payload.update({
        collection: 'articles',
        id: doc.id,
        data: { excerpt: 'Over.' } as never,
        overrideAccess: true,
      })
      expect((await article(doc.id)).fr?.status).toBe('pending')
    } finally {
      await payload.delete({ collection: 'scout-events', id: ev.id, overrideAccess: true })
    }
  })

  it('the backfill queues only what is missing or stale', async () => {
    const id = created.find((c) => c.collection === 'articles')!.id
    await payload.delete({
      collection: 'payload-jobs',
      where: { taskSlug: { equals: 'translateArticle' } },
      overrideAccess: true,
    })
    await queueMissingTranslations(payload)
    expect(await queuedFor(id)).toHaveLength(0)
  })

  it('tags get a French name, proper names stay', async () => {
    for (const name of ['Release dates', `${RUN} Sony`]) {
      const tag = await payload
        .create({ collection: 'tags', data: { name } as never, overrideAccess: true })
        .catch(async () => {
          const { docs } = await payload.find({
            collection: 'tags',
            where: { name: { equals: name } },
            overrideAccess: true,
          })
          return docs[0]
        })
      created.push({ collection: 'tags', id: tag.id })
    }
    await translateTaxonomy(payload, { fetchImpl: fakeClaude, apiKey: 'test' })
    const { docs } = await payload.find({
      collection: 'tags',
      where: { name: { in: ['Release dates', `${RUN} Sony`] } },
      overrideAccess: true,
    })
    const byName = Object.fromEntries(
      docs.map((t) => [t.name, (t as unknown as { nameFr?: string }).nameFr]),
    )
    expect(byName['Release dates']).toBe('Dates de sortie')
    expect(byName[`${RUN} Sony`]).toBe(`${RUN} Sony`)
  })
})
