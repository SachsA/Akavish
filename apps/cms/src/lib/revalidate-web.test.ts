import { describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { isPublicChange, tagsFor } from './revalidate-web'

describe('isPublicChange', () => {
  it('ignores drafts that never were public', () => {
    expect(
      isPublicChange({ _status: 'draft', status: 'draft' }, { _status: 'draft', status: 'draft' }),
    ).toBe(false)
    expect(isPublicChange({ _status: 'draft', status: 'draft' })).toBe(false)
  })

  it('counts a publish, an edit of a live article and an unpublish', () => {
    expect(
      isPublicChange(
        { _status: 'published', status: 'published' },
        { _status: 'draft', status: 'draft' },
      ),
    ).toBe(true)
    expect(
      isPublicChange(
        { _status: 'published', status: 'published' },
        { _status: 'published', status: 'published' },
      ),
    ).toBe(true)
    expect(
      isPublicChange(
        { _status: 'draft', status: 'draft' },
        { _status: 'published', status: 'published' },
      ),
    ).toBe(true)
  })

  it('always counts collections without drafts (games, tags, authors)', () => {
    expect(isPublicChange({}, {})).toBe(true)
  })
})

// A tiny stand-in for payload.find over a few documents.
function fakePayload(db: Record<string, Array<Record<string, unknown>>>): Payload {
  const match = (doc: Record<string, unknown>, where: Record<string, unknown>): boolean => {
    if (Array.isArray(where.or))
      return (where.or as Array<Record<string, unknown>>).some((w) => match(doc, w))
    return Object.entries(where).every(([field, cond]) => {
      const list = (cond as { in: Array<number | string> }).in.map(String)
      return list.includes(String(doc[field]))
    })
  }
  return {
    find: async ({
      collection,
      where,
    }: {
      collection: string
      where: Record<string, unknown>
    }) => ({
      docs: (db[collection] ?? []).filter((d) => match(d, where)),
    }),
  } as unknown as Payload
}

describe('tagsFor', () => {
  const payload = fakePayload({
    games: [
      { id: 1, slug: 'gta-6', developers: [10], publishers: [11], platforms: [20, 21], cover: 40 },
      { id: 2, slug: 'other-game', developers: [], publishers: [], platforms: [] },
    ],
    tags: [
      { id: 5, slug: 'ps5' },
      { id: 6, slug: 'rockstar' },
    ],
    authors: [{ id: 7, slug: 'scout' }],
    articles: [
      { id: 30, slug: 'gta-6-date', coverImage: 40 },
      { id: 31, slug: 'other', coverImage: 41 },
    ],
    companies: [
      { id: 10, slug: 'rockstar-north', tag: null },
      { id: 11, slug: 'take-two', tag: null },
      { id: 12, slug: 'rockstar-games', tag: 6 },
    ],
    platforms: [
      { id: 20, slug: 'ps5', tag: 5 },
      { id: 21, slug: 'xbox-series', tag: null },
      { id: 22, slug: 'switch-2', tag: null },
    ],
  })

  it('drops an article, the lists and every page that lists it', async () => {
    const tags = await tagsFor(
      payload,
      'articles',
      { slug: 'gta-6-date', game: 1, relatedGames: [], tags: [6], author: 7 },
      { slug: 'gta-6-old', game: 1, tags: [5], author: { id: 7 } },
    )
    expect(tags!.sort()).toEqual(
      [
        'articles',
        'article:gta-6-date',
        'article:gta-6-old',
        'game:gta-6',
        'tag:rockstar',
        'tag:ps5',
        'author:scout',
        'company:rockstar-north',
        'company:take-two',
        'company:rockstar-games',
        'platform:ps5',
        'platform:xbox-series',
      ].sort(),
    )
  })

  it('reads related documents whether populated or not', async () => {
    const tags = await tagsFor(payload, 'articles', {
      slug: 'x',
      game: { id: 2, slug: 'other-game' },
      tags: [],
    })
    expect(tags!.sort()).toEqual(['article:x', 'articles', 'game:other-game'])
  })

  it('keeps the other collections to their own page', async () => {
    expect(await tagsFor(payload, 'games', { slug: 'gta-6' })).toEqual(['games', 'game:gta-6'])
    expect(await tagsFor(payload, 'tags', { slug: 'ps5' })).toEqual(['tag:ps5'])
    expect(await tagsFor(payload, 'authors', { slug: 'scout' })).toEqual(['author:scout'])
    expect(await tagsFor(payload, 'companies', { slug: 'a' }, { slug: 'b' })).toEqual([
      'taxonomy',
      'company:a',
      'company:b',
    ])
    expect(await tagsFor(payload, 'platforms', { slug: 'ps6' })).toEqual([
      'taxonomy',
      'platform:ps6',
    ])
  })

  it('drops the pages showing an edited image, nothing for an unused one', async () => {
    expect((await tagsFor(payload, 'media', { id: 40 }))!.sort()).toEqual(
      ['article:gta-6-date', 'articles', 'article-extras', 'game:gta-6', 'games'].sort(),
    )
    expect(await tagsFor(payload, 'media', { id: 99 })).toEqual([])
  })

  it('drops everything when an image gets new files (the old ones are deleted)', async () => {
    const before = { id: 40, filename: 'a.jpg', sizes: { card: { filename: 'a-960x540.jpg' } } }
    const textEdit = { ...before, credit: 'Studio' }
    const newFiles = { id: 40, filename: 'a.jpg', sizes: { card: { filename: 'a-960x540.webp' } } }
    expect(await tagsFor(payload, 'media', textEdit, before)).not.toBeNull()
    expect(await tagsFor(payload, 'media', newFiles, before)).toBeNull()
  })
})
