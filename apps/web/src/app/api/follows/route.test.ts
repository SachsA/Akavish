import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Who Clerk says is signed in, and what the CMS answers.
const state = vi.hoisted(() => ({ userId: null as string | null, saved: [] as string[], fail: '' }))

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: state.userId }),
  currentUser: async () => (state.userId ? { id: state.userId } : null),
}))
vi.mock('@/lib/readers', async () => {
  class ReadersUnavailable extends Error {}
  class ReaderApiError extends Error {
    constructor(
      public code: string,
      public status: number
    ) {
      super(code)
    }
  }
  class NotFound extends ReaderApiError {
    constructor() {
      super('not-found', 404)
    }
  }
  const guard = () => {
    if (state.fail === 'down') throw new ReadersUnavailable()
    if (state.fail === 'missing') throw new NotFound()
    if (state.fail === 'unverified') throw new ReaderApiError('unverified', 403)
  }
  return {
    ReadersUnavailable,
    ReaderApiError,
    NotFound,
    profileFromUser: (u: { id: string }) => ({ clerkId: u.id }),
    followedGameIds: async (_c: string, ids: string[]) => (guard(), ids.filter((i) => state.saved.includes(i))),
    followGame: async (_p: unknown, id: string) => (guard(), void state.saved.push(id)),
    unfollowGame: async (_c: string, id: string) => (guard(), void (state.saved = state.saved.filter((s) => s !== id))),
  }
})

const { GET, POST, DELETE } = await import('./route')
const { resetRateLimits } = await import('@/lib/rate-limit')

const url = (q = '') => `https://akavish.gg/api/follows${q}`
const post = (body: unknown, origin = 'https://akavish.gg') =>
  new NextRequest(url(), { method: 'POST', body: JSON.stringify(body), headers: { origin } })

beforeEach(() => {
  state.userId = 'user_abc'
  state.saved = []
  state.fail = ''
  resetRateLimits()
})

describe('/api/follows', () => {
  it('needs a signed-in reader', async () => {
    state.userId = null
    expect((await GET(new NextRequest(url('?game=1')))).status).toBe(401)
    expect((await POST(post({ gameId: '1' }))).status).toBe(401)
  })

  it('follows, reports and unfollows', async () => {
    const saved = await POST(post({ gameId: '12' }))
    expect(await saved.json()).toEqual({ following: true })
    expect(saved.headers.get('cache-control')).toContain('no-store')
    expect(await (await GET(new NextRequest(url('?game=12')))).json()).toEqual({ following: true })
    const gone = await DELETE(new NextRequest(url('?game=12'), { method: 'DELETE' }))
    expect(await gone.json()).toEqual({ following: false })
    expect(await (await GET(new NextRequest(url('?game=12')))).json()).toEqual({ following: false })
  })

  it('refuses bad ids and other sites', async () => {
    expect((await POST(post({ gameId: 'abc' }))).status).toBe(400)
    expect((await POST(post({ gameId: '0' }))).status).toBe(400)
    expect((await POST(post({ gameId: '1' }, 'https://evil.example'))).status).toBe(403)
    expect((await POST(post({ gameId: '1' }, 'null'))).status).toBe(403)
  })

  it('says when the game is gone or following is down', async () => {
    state.fail = 'missing'
    expect((await POST(post({ gameId: '5' }))).status).toBe(404)
    state.fail = 'down'
    expect((await POST(post({ gameId: '5' }))).status).toBe(503)
    // The reader hears why: { code, message }.
    state.fail = 'unverified'
    const res = await POST(post({ gameId: '5' }))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'unverified', message: expect.stringMatching(/Verify/) })
  })

  it('limits each reader to 60 calls a minute', async () => {
    for (let i = 0; i < 60; i++) await GET(new NextRequest(url('?game=1')))
    expect((await GET(new NextRequest(url('?game=1')))).status).toBe(429)
  })
})
