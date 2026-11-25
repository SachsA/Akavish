import { NextRequest } from 'next/server'
import { fetchNotifications, markNotificationsRead, type ReaderNotification } from '@/lib/readers'
import { asReader, refuse, reply } from '@/lib/reader-route'

// The bell (components/NotificationBell.tsx): the signed-in reader's
// notifications of followed teams, events and matches.
//
//   GET  /api/notifications?limit=20&locale=fr → { docs, unread }  (limit=0: just the count)
//        On /fr an article notification carries the article's French title.
//   POST /api/notifications { read: 'all' | ids } → { unread }

export async function GET(req: NextRequest) {
  return asReader(req, { bucket: 'notifications', limit: 60, needProfile: false }, async ({ clerkId }) => {
    const limit = Math.max(0, Math.min(50, Number(req.nextUrl.searchParams.get('limit') ?? 20) || 0))
    const res = await fetchNotifications(clerkId, limit)
    if (req.nextUrl.searchParams.get('locale') === 'fr') res.docs = await frenchTitles(res.docs)
    return reply(res)
  })
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { read?: unknown }
  return asReader(req, { bucket: 'notifications', limit: 60, needProfile: false }, async ({ clerkId }) => {
    const read =
      body.read === 'all'
        ? ('all' as const)
        : Array.isArray(body.read)
          ? body.read.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 100)
          : []
    if (read !== 'all' && read.length === 0) return refuse('not-found', 400)
    return reply(await markNotificationsRead(clerkId, read))
  })
}

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:3001'

/** The French titles of the articles notified (public API: published ones only). */
async function frenchTitles(docs: ReaderNotification[]): Promise<ReaderNotification[]> {
  const ids = docs.filter((d) => d.kind === 'article').map((d) => Number(d.data.articleId)).filter((n) => n > 0)
  if (!ids.length) return docs
  try {
    const qs = new URLSearchParams({ 'where[id][in]': ids.join(','), depth: '0', limit: String(ids.length) })
    qs.set('select[fr]', 'true')
    const res = await fetch(`${CMS_URL}/api/articles?${qs.toString()}`, { next: { revalidate: 300 } })
    if (!res.ok) return docs
    const json = (await res.json()) as { docs?: Array<{ id: number; fr?: { title?: string | null; status?: string } }> }
    const fr = new Map((json.docs ?? []).flatMap((a) => (a.fr?.title ? [[a.id, a.fr.title] as const] : [])))
    return docs.map((d) =>
      d.kind === 'article' && fr.has(Number(d.data.articleId))
        ? { ...d, data: { ...d.data, title: fr.get(Number(d.data.articleId)) } }
        : d
    )
  } catch {
    return docs
  }
}
