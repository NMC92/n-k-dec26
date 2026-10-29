/*
 * Offline cache. The whole point is that this page is opened every day on a
 * phone, often not on wifi, and two of its five images are over a megabyte.
 *
 * Installed on a home screen it opens from the cache with no network at all,
 * which also removes the Google Fonts dependency: the cache-first rule below
 * serves the earlier font response when there is one, and the CSS already falls
 * back to system fonts when there is not.
 *
 * Bump CACHE when any asset changes, or a device will keep serving the old copy
 * until the browser evicts it. Nothing here is hashed, so there is no automatic
 * invalidation to lean on.
 */

const CACHE = "kirsi-1e14127d89c2";

const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "sprites/f-apart.png",
  "sprites/f-walk.png",
  "sprites/f-reach.png",
  "sprites/f-ready.png",
  "sprites/f-run.png",
  "sprites/f-miss.png",
  "sprites/pair.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
];

// Each entry is added on its own. addAll() is atomic, so one 404 would throw
// away the entire cache and leave the page working only online - which is the
// exact failure this file exists to prevent, and the hardest one to notice.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        ASSETS.map((url) =>
          cache.add(url).catch(() => console.warn("[sw] not cached:", url)),
        ),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Never cache the preview query strings separately; they are the same file.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !url.hostname.endsWith("gstatic.com")
      && !url.hostname.endsWith("googleapis.com")) {
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request)
        .then((response) => {
          // Opaque cross-origin font responses are still worth keeping: they
          // render, and they are what makes the page look right offline.
          if (response.ok || response.type === "opaque") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() =>
          // Offline and not cached: for a navigation, hand back the page itself
          // rather than the browser's error, because the page works without a
          // network as long as its own files are cached.
          request.mode === "navigate" ? caches.match("index.html") : undefined,
        );
    }),
  );
});
