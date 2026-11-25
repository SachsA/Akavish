import { NextRequest } from 'next/server'
import { fetchEsportFollows, followEsport, unfollowEsport, type EsportFollow, type EsportFollowKind } from '@/lib/readers'
import { asReader, idFrom, refuse, reply } from '@/lib/reader-route'

// The signed-in reader's followed esport teams, events and matches.
//
//   GET    /api/esport-follows                    → { follows: EsportFollow[] }
//   POST   /api/esport-follows { follow }          → { following: true }  (verified email)
//   DELETE /api/esport-follows?kind=team&id=3216   → { following: false }
//
// Same rules as /api/follows. The CMS checks every field (lib/esport-follows.ts).

const KINDS: EsportFollowKind[] = ['team', 'event', 'match']

export async function GET(req: NextRequest) {
  return asReader(req, { bucket: 'esport-follows', limit: 60, needProfile: false }, async ({ clerkId }) =>
    reply({ follows: await fetchEsportFollows(clerkId) })
  )
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { follow?: Partial<EsportFollow> }
  return asReader(req, { bucket: 'esport-follows', limit: 60 }, async ({ profile }) => {
    const f = body.follow
    if (!f || !KINDS.includes(f.kind as EsportFollowKind) || !idFrom(f.pandaId) || typeof f.label !== 'string') {
      return refuse('not-found', 400)
    }
    await followEsport(profile!, {
      kind: f.kind as EsportFollowKind,
      pandaId: Number(f.pandaId),
      game: typeof f.game === 'string' ? f.game : null,
      label: f.label,
      acronym: typeof f.acronym === 'string' ? f.acronym : null,
      logo: typeof f.logo === 'string' ? f.logo : null,
      slug: typeof f.slug === 'string' ? f.slug : null,
      at: typeof f.at === 'string' ? f.at : null,
    })
    return reply({ following: true })
  })
}

export async function DELETE(req: NextRequest) {
  return asReader(req, { bucket: 'esport-follows', limit: 60, needProfile: false }, async ({ clerkId }) => {
    const kind = req.nextUrl.searchParams.get('kind') as EsportFollowKind
    const id = idFrom(req.nextUrl.searchParams.get('id'))
    if (!KINDS.includes(kind) || !id) return refuse('not-found', 400)
    await unfollowEsport(clerkId, kind, Number(id))
    return reply({ following: false })
  })
}
