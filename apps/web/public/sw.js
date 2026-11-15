/* One More Brain service worker:
 * - keeps the app shell cached so the app opens offline (data comes from the client's own cache/outbox),
 * - shows reminder notifications and handles their buttons (payload: PushPayload in packages/shared/src/dto.ts).
 * Bump SHELL when the caching rules change; old caches are dropped on activate. */

const SHELL = 'omb-shell-v1'
/** Registered as /sw.js?dev during development: no caching, so hot reload keeps working. */
const DEV = new URL(self.location.href).searchParams.has('dev')

self.addEventListener('install', (event) => {
  if (DEV) return void self.skipWaiting()
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(['/', '/manifest.webmanifest', '/icons/icon.svg']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => DEV || k !== SHELL).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

// The page loaded its assets before this worker took control; it sends their URLs so they get cached
// right away and the app opens offline even after a single visit.
self.addEventListener('message', (event) => {
  const data = event.data || {}
  if (DEV || data.type !== 'cache-assets' || !Array.isArray(data.urls)) return
  const urls = data.urls.filter((u) => {
    try {
      const url = new URL(u, self.location.origin)
      return url.origin === self.location.origin && url.pathname.startsWith('/_nuxt/')
    } catch {
      return false
    }
  })
  event.waitUntil(
    caches
      .open(SHELL)
      // addAll rejects the whole batch on a duplicate, so dedupe first.
      .then((cache) => cache.addAll([...new Set(urls)]))
      .catch(() => undefined),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (DEV || req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // API data and auth are never cached here; the app keeps its own offline copy.
  if (url.pathname.startsWith('/api/')) return

  // Pages: network first, fall back to the cached shell (the app is a SPA, so '/' renders any route).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(SHELL).then((c) => c.put('/', res.clone()))
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // Built assets are content-hashed: cache first. Icons and the manifest: cache, refresh in background.
  if (
    url.pathname.startsWith('/_nuxt/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req).then((res) => {
          if (res.ok) caches.open(SHELL).then((c) => c.put(req, res.clone()))
          return res
        })
        return cached || network
      }),
    )
  }
})

self.addEventListener('push', (event) => {
  let data
  try {
    data = event.data ? event.data.json() : null
  } catch {
    data = null
  }
  if (!data || data.type !== 'reminder') return
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      renotify: true,
      requireInteraction: true,
      data,
      actions: data.actions,
    }),
  )
})

function api(path, method, body) {
  return fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function openApp(url) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const existing = windows.find((w) => new URL(w.url).origin === self.location.origin)
  if (existing) {
    await existing.focus()
    return existing.navigate(url)
  }
  return self.clients.openWindow(url)
}

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {}
  event.notification.close()
  const actions = {
    done: () => api(`/api/v1/items/${data.itemId}`, 'PATCH', { status: 'DONE' }),
    'snooze-1h': () => api(`/api/v1/reminders/${data.reminderId}/snooze`, 'POST', { preset: '1h' }),
    'snooze-tomorrow': () =>
      api(`/api/v1/reminders/${data.reminderId}/snooze`, 'POST', { preset: 'tomorrow' }),
  }
  const run = actions[event.action]
  event.waitUntil(
    run
      ? run().then((res) => (res.ok ? undefined : openApp(data.url || '/')))
      : openApp(data.url || '/'),
  )
})
