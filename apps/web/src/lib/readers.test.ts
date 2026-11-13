import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchSavedArticles,
  NotFound,
  profileFromUser,
  ReadersUnavailable,
  saveArticle,
  savedArticleIds,
  syncReader,
  unsaveArticle,
} from './readers'
import { roleBadge } from './roles'

const calls: { url: string; init: RequestInit }[] = []
const profile = {
  clerkId: 'user_x',
  email: 'a@b.c',
  emailVerified: true,
  displayName: 'A B',
  username: 'ab',
  firstName: 'A',
  imageUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}
function answer(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(JSON.stringify(body), { status })
    })
  )
}

beforeEach(() => {
  calls.length = 0
  process.env.READER_API_SECRET = 'web-secret'
})
afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.READER_API_SECRET
})

describe('reader api client', () => {
  it('sends the secret as a Bearer token, never cached', async () => {
    answer(200, { reader: { id: 1, clerkId: 'user_x', role: 'owner' } })
    const reader = await syncReader({
      clerkId: 'user_x',
      email: 'a@b.c',
      emailVerified: true,
      displayName: 'A',
      username: 'a',
      firstName: 'A',
      imageUrl: null,
      createdAt: null,
    })
    expect(reader.role).toBe('owner')
    expect(calls[0].url).toMatch(/\/api\/reader-api\/sync$/)
    expect(calls[0].init.method).toBe('POST')
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer web-secret')
    expect(calls[0].init.cache).toBe('no-store')
  })

  it('maps saved articles like any other list, with the date they were saved', async () => {
    answer(200, {
      docs: [
        {
          savedAt: '2026-11-13T10:00:00.000Z',
          article: {
            id: 7,
            slug: 'x',
            title: 'X',
            excerpt: 'E',
            category: 'review',
            status: 'published',
            author: { id: 1, name: 'Akavish', slug: 'akavish' },
            createdAt: '2026-11-01T00:00:00.000Z',
            updatedAt: '2026-11-01T00:00:00.000Z',
          },
        },
        { savedAt: '2026-11-12T10:00:00.000Z', article: null },
      ],
      total: 1,
      page: 1,
      totalPages: 1,
    })
    const res = await fetchSavedArticles('user_x', { page: 2, limit: 5 })
    expect(calls[0].url).toContain('/api/reader-api/bookmarks?clerkId=user_x&page=2&limit=5')
    expect(res.articles).toHaveLength(1)
    expect(res.articles[0]).toMatchObject({ id: '7', slug: 'x', savedAt: '2026-11-13T10:00:00.000Z' })
  })

  it('saves, unsaves and checks with numeric ids', async () => {
    answer(200, { saved: [7] })
    expect(await savedArticleIds('user_x', ['7', '8'])).toEqual(['7'])
    expect(calls[0].url).toContain('articles=7%2C8')
    await saveArticle(profile, '7')
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ profile, articleId: 7 })
    await unsaveArticle('user_x', '7')
    expect(calls[2].init.method).toBe('DELETE')
  })

  it('tells "no such article" from "unavailable"', async () => {
    answer(404, { error: 'article not found' })
    await expect(saveArticle(profile, '9')).rejects.toBeInstanceOf(NotFound)
    answer(403, { error: 'unverified' })
    await expect(saveArticle(profile, '9')).rejects.toMatchObject({ code: 'unverified', status: 403 })
    answer(500, {})
    await expect(saveArticle(profile, '9')).rejects.toBeInstanceOf(ReadersUnavailable)
    delete process.env.READER_API_SECRET
    await expect(saveArticle(profile, '9')).rejects.toBeInstanceOf(ReadersUnavailable)
  })
})

describe('role badges', () => {
  it('has a badge for every role but plain readers', () => {
    expect(roleBadge('owner')?.label).toBe('Owner')
    expect(roleBadge('moderator')?.label).toBe('Mod')
    expect(roleBadge('author')?.label).toBe('Author')
    expect(roleBadge('reader')).toBeNull()
    expect(roleBadge(undefined)).toBeNull()
    expect(roleBadge('toString')).toBeNull()
  })
})

describe('profileFromUser', () => {
  it('keeps what the CMS needs from a Clerk user', () => {
    expect(
      profileFromUser({
        id: 'user_x',
        fullName: 'Alex S',
        username: 'akavish',
        firstName: 'Alex',
        imageUrl: 'https://img.clerk.com/a',
        createdAt: Date.UTC(2026, 0, 1),
        primaryEmailAddress: { emailAddress: 'a@b.c', verification: { status: 'verified' } },
      })
    ).toEqual({
      clerkId: 'user_x',
      email: 'a@b.c',
      emailVerified: true,
      displayName: 'Alex S',
      username: 'akavish',
      firstName: 'Alex',
      imageUrl: 'https://img.clerk.com/a',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    expect(profileFromUser({ id: 'user_y', primaryEmailAddress: null }).emailVerified).toBe(false)
  })
})
