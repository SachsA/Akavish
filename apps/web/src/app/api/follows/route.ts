import { NextRequest } from 'next/server'
import { followGame, followedGameIds, unfollowGame } from '@/lib/readers'
import { asReader, idFrom, refuse, reply } from '@/lib/reader-route'

// The signed-in reader's followed games, for the Follow button on game pages.
//
//   GET    /api/follows?game=12    → { following: boolean }
//   POST   /api/follows { gameId }  → { following: true }   (verified email only)
//   DELETE /api/follows?game=12    → { following: false }
//
// Same rules as /api/bookmarks: the reader is whoever Clerk says is signed in,
// private answers, never cached. The list and its news are on /account.

export async function GET(req: NextRequest) {
  return asReader(req, { bucket: 'follows', limit: 60, needProfile: false }, async ({ clerkId }) => {
    const id = idFrom(req.nextUrl.searchParams.get('game'))
    if (!id) return refuse('not-found', 400)
    return reply({ following: (await followedGameIds(clerkId, [id])).includes(id) })
  })
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { gameId?: unknown }
  return asReader(req, { bucket: 'follows', limit: 60 }, async ({ profile }) => {
    const id = idFrom(body.gameId)
    if (!id) return refuse('not-found', 400)
    await followGame(profile!, id)
    return reply({ following: true })
  })
}

export async function DELETE(req: NextRequest) {
  return asReader(req, { bucket: 'follows', limit: 60, needProfile: false }, async ({ clerkId }) => {
    const id = idFrom(req.nextUrl.searchParams.get('game'))
    if (!id) return refuse('not-found', 400)
    await unfollowGame(clerkId, id)
    return reply({ following: false })
  })
}
