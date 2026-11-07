import { beforeEach, describe, expect, it } from 'vitest'
import { clientIp, rateLimit, resetRateLimits } from './rate-limit'

beforeEach(() => resetRateLimits())

describe('rateLimit', () => {
  it('lets `limit` requests through per window, then refuses with Retry-After', () => {
    const t = 1_000_000
    for (let i = 0; i < 3; i++) expect(rateLimit('ip', 3, 60_000, t).ok).toBe(true)
    const blocked = rateLimit('ip', 3, 60_000, t + 1_000)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfter).toBe(59)
  })

  it('opens again once the window is over', () => {
    const t = 1_000_000
    for (let i = 0; i < 4; i++) rateLimit('ip', 3, 60_000, t)
    expect(rateLimit('ip', 3, 60_000, t + 60_000).ok).toBe(true)
  })

  it('counts each key separately', () => {
    const t = 1_000_000
    for (let i = 0; i < 4; i++) rateLimit('a', 3, 60_000, t)
    expect(rateLimit('b', 3, 60_000, t).ok).toBe(true)
  })
})

describe('clientIp', () => {
  it('prefers x-real-ip, then the first x-forwarded-for hop', () => {
    expect(clientIp(new Request('http://x', { headers: { 'x-real-ip': '1.2.3.4' } }))).toBe('1.2.3.4')
    expect(clientIp(new Request('http://x', { headers: { 'x-forwarded-for': '5.6.7.8, 10.0.0.1' } }))).toBe('5.6.7.8')
    expect(clientIp(new Request('http://x'))).toBe('unknown')
  })
})
