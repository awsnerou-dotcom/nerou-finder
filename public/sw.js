const CACHE_NAME = "nerou-finder-v2";
const APP_SHELL = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Network-first for static/navigation requests, cache only as an offline fallback. API
// calls always go straight to the network so leads, auth, and listing data are never
// served stale.
//
// Previously this was stale-while-revalidate (return cached || networkFetch), which always
// served whatever was cached FIRST and only refreshed the cache in the background for the
// *next* load. Combined with Vite's content-hashed JS/CSS filenames, that meant a visitor
// could stay stuck on an old deployed version for multiple releases in a row - every new
// deploy references a new hashed bundle URL, but the cached index.html (which is what
// decides which bundle URL to request) itself only ever updated one load behind. Given how
// frequently this app ships fixes, "network-first, cache is purely an offline fallback" is
// the correct behavior - it matches what the offline-fallback code below was already trying
// to express, it just wasn't actually the request's primary path before.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          // A first-time offline visit to a deep link (e.g. a shared /properties/:id URL)
          // has nothing precached for that exact URL - fall back to the cached app shell so
          // the SPA can at least boot and show something, instead of failing outright.
          if (cached) return cached;
          if (request.mode === "navigate") return caches.match("/");
          return undefined;
        })
      )
  );
});
