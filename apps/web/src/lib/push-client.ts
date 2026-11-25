// Web push in the browser (components/PushToggle.tsx): what this browser can
// do, and turning push on or off for it. The server side is the CMS
// (lib/web-push.ts there); the service worker is /sw.js.

/** The VAPID public key (Vercel: NEXT_PUBLIC_VAPID_PUBLIC_KEY). Empty: push is off. */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

export type PushSupport = 'ok' | 'ios-home-screen' | 'unsupported' | 'off'

/**
 * Can this browser get push? iPhones and iPads only can from the site added
 * to the home screen (iOS 16.4+), so they get a hint instead of "unsupported".
 */
export function pushSupport(nav: Navigator = navigator, win: typeof window = window): PushSupport {
  if (!VAPID_PUBLIC_KEY) return 'off'
  const ok = 'serviceWorker' in nav && 'PushManager' in win && 'Notification' in win
  if (ok) return 'ok'
  const ios = /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
  return ios ? 'ios-home-screen' : 'unsupported'
}

/** The VAPID key as PushManager wants it. */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration('/')) ?? navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

/** This browser's subscription, if push is on here. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration('/')
  return reg ? reg.pushManager.getSubscription() : null
}

/** Ask permission, subscribe, tell the site. Returns the outcome. */
export async function enablePush(locale: string): Promise<'on' | 'denied' | 'failed'> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'
  try {
    const reg = await registration()
    await navigator.serviceWorker.ready
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }))
    const res = await fetch('/api/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), locale }),
    })
    return res.ok ? 'on' : 'failed'
  } catch {
    return 'failed'
  }
}

/** Unsubscribe this browser and tell the site. */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription()
  if (!sub) return
  await fetch('/api/push', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => undefined)
  await sub.unsubscribe().catch(() => undefined)
}
