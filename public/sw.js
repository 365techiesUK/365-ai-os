/* 365 Techies AI OS — service worker.
   Strategy: NEVER cache /api/* (always live). HTML navigations are network-first
   (so updates show), falling back to the cached shell when offline. Other static
   GETs are cache-first with background refresh. Bump CACHE to invalidate. */
const CACHE = "aios-v1";
const SHELL = ["/", "/index.html", "/os.css", "/os.js", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // don't touch cross-origin (e.g. HubSpot)
  if (url.pathname.startsWith("/api/")) return;            // API: always go to network, never cache

  if (req.mode === "navigate") {                           // HTML: network-first, offline fallback
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r || caches.match("/index.html")))
    );
    return;
  }
  // Static assets: cache-first, refresh in background
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
