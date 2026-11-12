import { describe, expect, it } from 'vitest'
import { mapArticle, mediaAlt, mediaUrl, toPaginated, type PayloadArticle } from './payload'

const CMS = 'https://cms.test'

function rawArticle(overrides: Partial<PayloadArticle> = {}): PayloadArticle {
  return {
    id: 7,
    slug: 'gta-6-date',
    title: 'GTA 6 date',
    excerpt: 'It is out.',
    content: { root: { children: [] } },
    category: 'leak',
    status: 'published',
    publishedAt: '2026-11-01T10:00:00.000Z',
    createdAt: '2026-11-01T09:00:00.000Z',
    updatedAt: '2026-11-01T11:00:00.000Z',
    ...overrides,
  }
}

describe('mediaUrl', () => {
  it('returns undefined for a missing upload', () => {
    expect(mediaUrl(null, CMS)).toBeUndefined()
    expect(mediaUrl(undefined, CMS)).toBeUndefined()
  })

  it('makes relative paths absolute against the CMS origin', () => {
    expect(mediaUrl({ url: '/api/media/file/a.jpg' }, CMS)).toBe(`${CMS}/api/media/file/a.jpg`)
  })

  it('leaves absolute URLs (R2) untouched', () => {
    expect(mediaUrl({ url: 'https://pub.r2.dev/a.jpg' }, CMS)).toBe('https://pub.r2.dev/a.jpg')
  })

  it('prefers the requested size when it exists', () => {
    const m = { url: '/a.jpg', sizes: { hero: { url: '/a-1920.jpg' } } }
    expect(mediaUrl(m, CMS, 'hero')).toBe(`${CMS}/a-1920.jpg`)
  })

  it('falls back to the original when the size is missing (Sharp never upscales)', () => {
    const m = { url: '/small.jpg', sizes: { hero: { url: undefined } } }
    expect(mediaUrl(m, CMS, 'hero')).toBe(`${CMS}/small.jpg`)
  })
})

describe('mediaAlt', () => {
  it('returns the trimmed alt text of a populated upload', () => {
    expect(mediaAlt({ url: '/a.jpg', alt: '  A cover  ' })).toBe('A cover')
  })

  it('is undefined when the upload is unpopulated, missing or has a blank alt', () => {
    expect(mediaAlt('42')).toBeUndefined()
    expect(mediaAlt(null)).toBeUndefined()
    expect(mediaAlt({ url: '/a.jpg', alt: '   ' })).toBeUndefined()
    expect(mediaAlt({ url: '/a.jpg' })).toBeUndefined()
  })
})

describe('mapArticle', () => {
  it('maps a fully populated article', () => {
    const a = mapArticle(
      rawArticle({
        coverImage: {
          url: '/a.jpg',
          alt: 'Trevor on a jet ski',
          sizes: { hero: { url: '/a-1920.jpg' }, card: { url: '/a-960.jpg' } },
        },
        author: { id: 1, slug: 'akavish', name: 'Akavish', avatar: 'https://cdn.test/me.png' },
        game: { id: 2, name: 'GTA VI', slug: 'gta-vi' },
        tags: [{ slug: 'gta' }, { slug: 'openworld' }, {}],
        seo: { title: null, description: 'Custom description' },
      }),
      CMS,
    )

    expect(a.id).toBe('7')
    expect(a.coverImage).toBe(`${CMS}/a-1920.jpg`)
    expect(a.coverImageCard).toBe(`${CMS}/a-960.jpg`)
    expect(a.coverImageAlt).toBe('Trevor on a jet ski')
    expect(a.featured).toBe(false)
    expect(a.aiAssisted).toBe(false)
    expect(a.score).toBeUndefined()
    expect(mapArticle(rawArticle({ category: 'review', score: 8.5 }), CMS).score).toBe(8.5)
    expect(a.author).toMatchObject({ id: '1', slug: 'akavish', name: 'Akavish' })
    expect(a.author.avatar).toBe('https://cdn.test/me.png')
    expect(a.game).toMatchObject({ id: '2', slug: 'gta-vi', name: 'GTA VI' })
    // Tags without a slug are dropped rather than producing a `/tag/` link.
    expect(a.tags).toEqual(['gta', 'openworld'])
    expect(a.seo).toEqual({ title: undefined, description: 'Custom description' })
  })

  it('serialises Lexical JSON content to a string', () => {
    const a = mapArticle(rawArticle(), CMS)
    expect(typeof a.content).toBe('string')
    expect(JSON.parse(a.content)).toEqual({ root: { children: [] } })
  })

  it('turns a null publishedAt into undefined', () => {
    expect(mapArticle(rawArticle({ publishedAt: null }), CMS).publishedAt).toBeUndefined()
  })

  it('survives unpopulated relationships (depth=0 returns bare IDs)', () => {
    const a = mapArticle(rawArticle({ author: '1', game: '2' }), CMS)
    expect(a.author).toMatchObject({ id: '', name: 'Akavish' })
    expect(a.game).toBeUndefined()
  })
})

describe('toPaginated', () => {
  it("converts Payload's envelope into the shared shape", () => {
    const res = toPaginated(
      { docs: [1, 2], totalDocs: 12, page: 2, limit: 2, totalPages: 6 },
      (n: number) => n * 10,
    )
    expect(res).toEqual({ data: [10, 20], total: 12, page: 2, perPage: 2, totalPages: 6 })
  })
})
