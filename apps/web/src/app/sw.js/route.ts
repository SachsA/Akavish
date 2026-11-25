// /sw.js: the service worker behind push notifications (components/PushToggle).
// It only shows what the CMS pushes (lib/web-push.ts there: { title, body,
// url, tag }) and opens the page on click; no caching, no offline mode.
// Served from the root so its scope is the whole site.

const SW = `
self.addEventListener('push', (event) => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(d.title || 'Akavish', {
      body: d.body || '',
      icon: '/icon.png',
      badge: '/icon.png',
      tag: d.tag || undefined,
      data: { url: d.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url === url && 'focus' in c) return c.focus()
      return self.clients.openWindow(url)
    })
  )
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
`

// Built once: the same file for everyone.
export const dynamic = 'force-static'

export function GET() {
  return new Response(SW, {
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      // A new version is picked up at the next visit.
      'cache-control': 'no-cache',
    },
  })
}
