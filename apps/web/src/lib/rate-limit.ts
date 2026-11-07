// Per-IP rate limiting for the public API routes (/api/search, /api/articles).
//
// Fixed window kept in memory, so it's per server instance: on Vercel each
// warm function instance counts on its own, which makes the limit approximate
// (a burst spread over several instances gets more through). Good enough to
// stop one client hammering search, which is the realistic abuse at this
// size; a shared store (Upstash/Vercel KV) or a Vercel Firewall rule is the
// upgrade if it's ever needed — DEPLOYMENT.md §4e.
import { NextResponse } from 'next/server'

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export type RateLimitResult = { ok: boolean; remaining: number; retryAfter: number }

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    if (buckets.size > 10_000) sweep(now)
    return { ok: true, remaining: limit - 1, retryAfter: 0 }
  }
  bucket.count += 1
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  return { ok: true, remaining: limit - bucket.count, retryAfter: 0 }
}

/** Drop expired windows so the map can't grow without bound. */
function sweep(now: number) {
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key)
}

/** For tests. */
export function resetRateLimits() {
  buckets.clear()
}

/** The visitor's IP as Vercel reports it (falls back to the proxy chain). */
export function clientIp(req: Request): string {
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

export function tooManyRequests(retryAfter: number) {
  return NextResponse.json(
    { message: 'Too many requests, slow down.', status: 429 },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store' },
    }
  )
}

/**
 * Cache-Control for public JSON: Vercel's CDN keeps it for `seconds`, then
 * serves the stale copy for up to 5 more minutes while refreshing it. Cached
 * hits never reach the function, so they don't count against the rate limit.
 */
export function publicCache(seconds: number) {
  return { 'Cache-Control': `public, s-maxage=${seconds}, stale-while-revalidate=300` }
}
