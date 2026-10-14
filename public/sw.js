// EventHub service worker. Deliberately conservative: it only caches content-hashed build
// assets and the PWA icons. Pages, RSC payloads, Server Actions (attendance, certificates,
// auth), API routes and every Supabase request (another origin) always go to the network.
// Nothing is queued or replayed offline. Bump VERSION to drop every cache on the next visit.
const VERSION = "v1";
const STATIC_CACHE = `eventhub-static-${VERSION}`;
const PAGES_CACHE = `eventhub-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const OFFLINE_ICON = "/icons/icon-192.png";
// Hashed chunks from old deployments are never requested again; keep the cache bounded.
const MAX_STATIC_ENTRIES = 200;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    // The offline page is static HTML and its only asset is the icon; cache both up front.
    await (await caches.open(PAGES_CACHE)).add(new Request(OFFLINE_URL, { cache: "reload" }));
    await (await caches.open(STATIC_CACHE)).add(new Request(OFFLINE_ICON, { cache: "reload" }));
    // Safe to activate immediately: pages are never cached and hashed assets never change.
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC_CACHE, PAGES_CACHE]);
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("eventhub-") && !keep.has(key)).map(key => caches.delete(key)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkWithOfflineFallback(event));
    return;
  }

  // Content-hashed, immutable build output: safe to serve from cache forever.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Icons can be regenerated without a rename, so refresh them in the background.
  if (url.pathname.startsWith("/icons/")) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
  // Everything else (RSC requests, /api, /auth, images, the manifest) uses the browser default.
});

/** Pages are never cached. The offline page is only shown when the network is unreachable. */
async function networkWithOfflineFallback(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch {
    const offline = await caches.match(OFFLINE_URL, { cacheName: PAGES_CACHE });
    return offline ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response)) {
    await cache.put(request, response.clone());
    await trim(cache);
  }
  return response;
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request).then(async response => {
    if (isCacheable(response)) await cache.put(request, response.clone());
    return response;
  });
  if (cached) {
    event.waitUntil(refresh.catch(() => undefined));
    return cached;
  }
  return refresh;
}

function isCacheable(response) {
  return response.ok && response.type === "basic" && !response.headers.get("Cache-Control")?.includes("no-store");
}

async function trim(cache) {
  const keys = await cache.keys();
  // Cache keys come back in insertion order, so the oldest entries go first.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_STATIC_ENTRIES)).map(key => cache.delete(key)));
}
