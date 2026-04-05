const CACHE_NAME = "one-calendar-shell-v3";
const OFFLINE_URLS = ["/app", "/icon.svg"];
const STATIC_PATH_PREFIXES = ["/_next/static/", "/_next/image/", "/icons/"];
const STATIC_FILE_PATTERN =
  /\.(?:js|css|png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|otf|eot|json|txt|xml|webmanifest)$/i;

function shouldCacheRequest(requestUrl) {
  if (requestUrl.origin !== self.location.origin) return false;
  if (OFFLINE_URLS.includes(requestUrl.pathname)) return true;
  if (STATIC_PATH_PREFIXES.some((prefix) => requestUrl.pathname.startsWith(prefix))) {
    return true;
  }
  return STATIC_FILE_PATTERN.test(requestUrl.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.protocol !== "http:" && requestUrl.protocol !== "https:") {
    return;
  }
  if (requestUrl.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (!shouldCacheRequest(requestUrl)) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          if (networkResponse.type !== "basic") {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => undefined);
          });

          return networkResponse;
        })
        .catch(() => caches.match("/app"));
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          return;
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow("/app");
      }
    }),
  );
});
