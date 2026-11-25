// ─── Web push (2026-11-25) ────────────────────────────────────────────────────
// Every notification of the bell (lib/esport-follows.ts) is also pushed to the
// browsers the reader turned push on in (collection push-subscriptions), so it
// shows even with the site closed. Standard Web Push with VAPID keys
// (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT on Railway; the public
// key also as NEXT_PUBLIC_VAPID_PUBLIC_KEY on Vercel). Off without them.
//
// The text is written here, in the subscription's language; a result leaves
// the score out for a reader who hides scores (notify.hideScores).

import type { Payload } from 'payload'
import webpush from 'web-push'

export type PushKind = 'match_start' | 'match_end' | 'article'

let configured: boolean | null = null

/** VAPID keys set (and loaded once). */
export function pushReady(): boolean {
  if (configured !== null) return configured
  const pub = process.env.VAPID_PUBLIC_KEY?.trim()
  const priv = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:hello@akavish.gg'
  if (!pub || !priv) return (configured = false)
  try {
    webpush.setVapidDetails(subject, pub, priv)
    configured = true
  } catch {
    configured = false
  }
  return configured
}

type Team = { name?: string }
const name = (t: unknown) => (t as Team)?.name || '?'

/** The notification's title and body, in English or French (pure, tested). */
export function pushText(
  kind: PushKind,
  data: Record<string, unknown>,
  locale: 'en' | 'fr',
  hideScores: boolean,
): { title: string; body: string } {
  const fr = locale === 'fr'
  const a = name(data.t1)
  const b = name(data.t2)
  const where = [data.event, data.stage].filter(Boolean).join(' · ')
  if (kind === 'match_start') {
    return { title: fr ? `${a} contre ${b} a commencé` : `${a} vs ${b} has started`, body: where }
  }
  if (kind === 'match_end') {
    const score =
      !hideScores && data.s1 != null && data.s2 != null ? `${a} ${data.s1} – ${data.s2} ${b}` : null
    return {
      title: fr ? `${a} contre ${b} est terminé` : `${a} vs ${b} is over`,
      body: [score ?? (fr ? 'Score masqué' : 'Score hidden'), where].filter(Boolean).join(' · '),
    }
  }
  const teams = Array.isArray(data.teams) ? data.teams.join(', ') : ''
  return { title: fr ? `Actu sur ${teams}` : `News about ${teams}`, body: String(data.title ?? '') }
}

/** How long a push service keeps trying: a match start is stale fast. */
const TTL: Record<PushKind, number> = { match_start: 1800, match_end: 6 * 3600, article: 24 * 3600 }

const webUrl = () => (process.env.WEB_URL || 'http://localhost:3000').replace(/\/+$/, '')

/** Push one notification to every browser of the reader. Best-effort: never throws. */
export async function sendPush(
  payload: Payload,
  readerId: number | string,
  n: { kind: PushKind; data: Record<string, unknown>; url: string; tag: string },
  hideScores: boolean,
): Promise<number> {
  if (!pushReady()) return 0
  const { docs } = await payload.find({
    collection: 'push-subscriptions' as never,
    where: { reader: { equals: readerId } },
    limit: 20,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  let sent = 0
  for (const s of docs as unknown as Array<{
    id: number
    endpoint: string
    p256dh: string
    auth: string
    locale?: string
  }>) {
    const locale = s.locale === 'fr' ? 'fr' : 'en'
    const text = pushText(n.kind, n.data, locale, hideScores)
    const url = `${webUrl()}${locale === 'fr' ? '/fr' : ''}${n.url}`
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ ...text, url, tag: n.tag }),
        { TTL: TTL[n.kind], timeout: 10_000 },
      )
      sent++
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        // The browser dropped it (unsubscribed, data cleared): forget it.
        await payload
          .delete({ collection: 'push-subscriptions' as never, id: s.id, overrideAccess: true })
          .catch(() => undefined)
      } else {
        payload.logger.warn({ msg: '[push] send failed', status, error: String(err) })
      }
    }
  }
  return sent
}
