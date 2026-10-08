// Offline shell only. Never store authenticated HTML, RSC responses or API data.
const CACHE = "averna-public-v3";
const ASSETS = ["/offline.html", "/logo.png", "/manifest.webmanifest"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith("averna-") && key !== CACHE).map((key) => caches.delete(key))
  )));
  self.clients.claim();
});
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CLEAR_PRIVATE_CACHE") return;
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith("averna-") && key !== CACHE).map((key) => caches.delete(key))
  )));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    // network only: the offline screen contains no student information
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }
  if (!ASSETS.includes(url.pathname) || url.search) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
