const SW_VERSION = self.registration?.scope

const clearAllCaches = async () => {
  const keys = await caches.keys()
  await Promise.all(keys.map((key) => caches.delete(key)))
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    clearAllCaches().then(async () => {
      await self.clients.claim()
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      await Promise.all(
        clients.map((client) =>
          client.postMessage({ type: 'SW_ACTIVATED', version: SW_VERSION }),
        ),
      )
    }),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const requestUrl = new URL(event.request.url)
  if (requestUrl.protocol !== 'http:' && requestUrl.protocol !== 'https:') {
    return
  }

  event.respondWith(fetch(event.request))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            client.focus()
            return
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow('/app')
        }
      }),
  )
})
