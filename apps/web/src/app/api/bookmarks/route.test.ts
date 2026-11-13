import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Who Clerk says is signed in, and what the CMS answers.
const state = vi.hoisted(() => ({ userId: null as string | null, saved: [] as string[], fail: '' }))

vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: state.userId }) }))
vi.mock('@/lib/readers', async () => {
  class ReadersUnavailable extends Error {}
  class NotFound extends Error {}
  const guard = () => {
    if (state.fail === 'down') throw new ReadersUnavailable()
    if (state.fail === 'missing') throw new NotFound()
  }
  return {
    ReadersUnavailable,
    NotFound,
    savedArticleIds: async (_c: string, ids: string[]) => (guard(), ids.filter((i) => state.saved.includes(i))),
    saveArticle: async (_c: string, id: string) => (guard(), void state.saved.push(id)),
    unsaveArticle: async (_c: string, id: string) => (guard(), void (state.saved = state.saved.filter((s) => s !== id))),
  }
})

const { GET, POST, DELETE } = await import('./route')
const { resetRateLimits } = await import('@/lib/rate-limit')

const url = (q = '') => `https://akavish.gg/api/bookmarks${q}`
const post = (body: unknown, origin = 'https://akavish.gg') =>
  new NextRequest(url(), { method: 'POST', body: JSON.stringify(body), headers: { origin } })

beforeEach(() => {
  state.userId = 'user_abc'
  state.saved = []
  state.fail = ''
  resetRateLimits()
})

describe('/api/bookmarks', () => {
  it('needs a signed-in reader', async () => {
    state.userId = null
    expect((await GET(new NextRequest(url('?article=1')))).status).toBe(401)
    expect((await POST(post({ articleId: '1' }))).status).toBe(401)
  })

  it('saves, reports and unsaves', async () => {
    const saved = await POST(post({ articleId: '12' }))
    expect(await saved.json()).toEqual({ saved: true })
    expect(saved.headers.get('cache-control')).toContain('no-store')
    expect(await (await GET(new NextRequest(url('?article=12')))).json()).toEqual({ saved: true })
    const gone = await DELETE(new NextRequest(url('?article=12'), { method: 'DELETE' }))
    expect(await gone.json()).toEqual({ saved: false })
    expect(await (await GET(new NextRequest(url('?article=12')))).json()).toEqual({ saved: false })
  })

  it('refuses bad ids and other sites', async () => {
    expect((await POST(post({ articleId: 'abc' }))).status).toBe(400)
    expect((await POST(post({ articleId: '0' }))).status).toBe(400)
    expect((await POST(post({ articleId: '1' }, 'https://evil.example'))).status).toBe(403)
    expect((await POST(post({ articleId: '1' }, 'null'))).status).toBe(403)
  })

  it('says when the article is gone or saving is down', async () => {
    state.fail = 'missing'
    expect((await POST(post({ articleId: '5' }))).status).toBe(404)
    state.fail = 'down'
    expect((await POST(post({ articleId: '5' }))).status).toBe(503)
  })

  it('limits each reader to 60 calls a minute', async () => {
    for (let i = 0; i < 60; i++) await GET(new NextRequest(url('?article=1')))
    expect((await GET(new NextRequest(url('?article=1')))).status).toBe(429)
  })
})
