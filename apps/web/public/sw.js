/* One More Brain service worker: shows reminder notifications and handles their buttons.
 * Push payload shape: PushPayload in packages/shared/src/dto.ts. */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

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
