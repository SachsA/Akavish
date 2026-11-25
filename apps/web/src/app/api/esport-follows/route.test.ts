import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Who Clerk says is signed in, and what the CMS holds.
const state = vi.hoisted(() => ({
  userId: null as string | null,
  follows: [] as Array<{ kind: string; pandaId: number; label: string }>,
  read: null as unknown,
}))

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: state.userId }),
  currentUser: async () => (state.userId ? { id: state.userId } : null),
}))
vi.mock('@/lib/readers', async () => {
  class ReadersUnavailable extends Error {}
  class ReaderApiError extends Error {}
  return {
    ReadersUnavailable,
    ReaderApiError,
    profileFromUser: (u: { id: string }) => ({ clerkId: u.id }),
    fetchEsportFollows: async () => state.follows,
    followEsport: async (_p: unknown, f: { kind: string; pandaId: number; label: string }) => void state.follows.push(f),
    unfollowEsport: async (_c: string, kind: string, id: number) =>
      void (state.follows = state.follows.filter((f) => !(f.kind === kind && f.pandaId === id))),
    fetchNotifications: async () => ({ docs: [], unread: 3 }),
    markNotificationsRead: async (_c: string, read: unknown) => ((state.read = read), { unread: 0 }),
  }
})

const follows = await import('./route')
const notifications = await import('../notifications/route')
const { resetRateLimits } = await import('@/lib/rate-limit')

const post = (path: string, body: unknown, origin = 'https://akavish.gg') =>
  new NextRequest(`https://akavish.gg${path}`, { method: 'POST', body: JSON.stringify(body), headers: { origin } })

beforeEach(() => {
  state.userId = 'user_abc'
  state.follows = []
  state.read = null
  resetRateLimits()
})

describe('/api/esport-follows', () => {
  it('needs a signed-in reader', async () => {
    state.userId = null
    expect((await follows.GET(new NextRequest('https://akavish.gg/api/esport-follows'))).status).toBe(401)
  })

  it('follows a team, lists it, unfollows it', async () => {
    const res = await follows.POST(post('/api/esport-follows', { follow: { kind: 'team', pandaId: 3216, label: 'Vitality' } }))
    expect(await res.json()).toEqual({ following: true })
    const list = await (await follows.GET(new NextRequest('https://akavish.gg/api/esport-follows'))).json()
    expect(list.follows).toMatchObject([{ kind: 'team', pandaId: 3216, label: 'Vitality' }])
    await follows.DELETE(new NextRequest('https://akavish.gg/api/esport-follows?kind=team&id=3216', { method: 'DELETE' }))
    expect(state.follows).toEqual([])
  })

  it('refuses an unknown kind, a bad id, another site', async () => {
    expect((await follows.POST(post('/api/esport-follows', { follow: { kind: 'player', pandaId: 1, label: 'x' } }))).status).toBe(400)
    expect((await follows.POST(post('/api/esport-follows', { follow: { kind: 'team', pandaId: 'abc', label: 'x' } }))).status).toBe(400)
    expect(
      (await follows.POST(post('/api/esport-follows', { follow: { kind: 'team', pandaId: 1, label: 'x' } }, 'https://evil.example'))).status
    ).toBe(403)
    expect((await follows.DELETE(new NextRequest('https://akavish.gg/api/esport-follows?kind=x&id=1', { method: 'DELETE' }))).status).toBe(400)
  })
})

describe('/api/notifications', () => {
  it('gives the unread count, marks all or some read', async () => {
    const got = await (await notifications.GET(new NextRequest('https://akavish.gg/api/notifications?limit=0'))).json()
    expect(got).toEqual({ docs: [], unread: 3 })
    await notifications.POST(post('/api/notifications', { read: 'all' }))
    expect(state.read).toBe('all')
    await notifications.POST(post('/api/notifications', { read: [4, '5', -1, 'x'] }))
    expect(state.read).toEqual([4, 5])
    expect((await notifications.POST(post('/api/notifications', { read: [] }))).status).toBe(400)
  })
})
