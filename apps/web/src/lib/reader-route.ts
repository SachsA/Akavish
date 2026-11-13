// The shape of every route that acts as the signed-in reader (/api/bookmarks,
// /api/comments…): same-origin check, Clerk session, per-reader rate limit,
// the CMS's refusals turned into { code, message } for the page. Server only.

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { profileFromUser, ReaderApiError, ReadersUnavailable, type ReaderProfile } from './readers'
import { readerMessage } from './reader-messages'
import { rateLimit } from './rate-limit'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

export function refuse(code: string, status: number) {
  return reply({ code, message: readerMessage(code) }, status)
}

function sameHost(origin: string, host: string): boolean {
  try {
    return new URL(origin).host === host
  } catch {
    return false // "null" and other opaque origins
  }
}

/**
 * Run `fn` as the signed-in reader. Writes (`needProfile`) also fetch the
 * Clerk profile, so the CMS can check the email is verified and keep the
 * public name current.
 */
export async function asReader(
  req: NextRequest,
  { bucket, limit = 30, needProfile = true }: { bucket: string; limit?: number; needProfile?: boolean },
  fn: (ctx: { clerkId: string; profile: ReaderProfile | null }) => Promise<NextResponse>
): Promise<NextResponse> {
  // Changes only from our own pages (Clerk's cookie is SameSite=Lax already;
  // this is the belt to those braces).
  const origin = req.headers.get('origin')
  if (req.method !== 'GET' && origin && !sameHost(origin, req.nextUrl.host)) {
    return refuse('forbidden', 403)
  }
  const { userId } = await auth()
  if (!userId) return refuse('signed-out', 401)
  const limited = rateLimit(`${bucket}:${userId}`, limit, 60_000)
  if (!limited.ok) {
    return reply({ code: 'rate-limited', message: readerMessage('rate-limited') }, 429)
  }
  try {
    let profile: ReaderProfile | null = null
    if (needProfile) {
      const user = await currentUser()
      if (!user) return refuse('signed-out', 401)
      profile = profileFromUser(user)
    }
    return await fn({ clerkId: userId, profile })
  } catch (error) {
    if (error instanceof ReaderApiError) return refuse(error.code, error.status)
    if (error instanceof ReadersUnavailable) return refuse('unavailable', 503)
    throw error
  }
}

/** A positive whole number from a query or body value, as a string. */
export function idFrom(value: unknown): string | null {
  const s = String(value ?? '')
  return /^[1-9]\d{0,9}$/.test(s) ? s : null
}
