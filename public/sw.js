// Averna service worker v4 (idea 7, "Instant and offline").
// Privacy rule: never store authenticated HTML, RSC responses or API data. The one page kept is
// /offline, a static client shell with no personal data in it; the student's packs live in
// IndexedDB and in the packs cache, written by the page, and are wiped on sign-out.
// Routing decisions live in /sw-routes.js (pure, shared with the tests).
importScripts("/sw-routes.js");
const R = self.AvernaSwRoutes;
const C = R.CACHES;

const headerOf = (response, name) => (response && response.headers && response.headers.get ? response.headers.get(name) || "" : "");
const responseFacts = (response) => ({
  status: response.status,
  type: response.type,
  redirected: response.redirected,
  cacheControl: headerOf(response, "cache-control"),
  contentType: headerOf(response, "content-type"),
});
const canStore = (response) => !!response && R.cacheableResponse(responseFacts(response));

// Keep a cache under its entry cap: oldest entries go first. One trim at a time per cache.
const trimming = {};
function trim(name, max) {
  if (trimming[name]) return trimming[name];
  trimming[name] = caches
    .open(name)
    .then((cache) => cache.keys().then((keys) => Promise.all(R.overflow(keys, max).map((key) => cache.delete(key)))))
    .catch(() => undefined)
    .then(() => {
      trimming[name] = null;
    });
  return trimming[name];
}

function store(name, request, response, max) {
  if (!canStore(response)) return Promise.resolve();
  return caches
    .open(name)
    .then((cache) => cache.put(request, response))
    .then(() => (max ? trim(name, max) : undefined))
    .catch(() => undefined);
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(C.shell).then((cache) => cache.addAll(R.PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(R.staleCaches(keys).map((key) => caches.delete(key)))));
  self.clients.claim();
});

// Stores a fresh copy of the /offline page with every static file it references, so the saved
// packs open with no network. All or nothing: if a file can't be fetched, the previous copy stays.
function storeShell(response) {
  if (!response || !R.cacheableShell(responseFacts(response))) return Promise.resolve({ ok: false, assets: 0 });
  return response
    .clone()
    .text()
    .then((html) => {
      const urls = R.shellAssetUrls(html);
      return Promise.all(
        urls.map((url) =>
          caches
            .match(url)
            .then((hit) => hit || fetch(url).then((res) => (canStore(res) ? res : null)))
            .catch(() => null)
        )
      ).then((files) => {
        if (files.some((res) => !res)) return { ok: false, assets: 0 };
        return caches.open(C.offlineShell).then((cache) =>
          Promise.all(files.map((res, i) => cache.put(urls[i], res.clone())))
            .then(() => cache.put(R.OFFLINE_PATH, response))
            .then(() => cache.keys())
            .then((old) => {
              // Files of an older build go once the new copy is complete.
              const keep = new Set(urls.concat(R.OFFLINE_PATH).map((u) => new URL(u, self.location.origin).href));
              return Promise.all(old.filter((req) => !keep.has(req.url.split("?")[0])).map((req) => cache.delete(req)));
            })
            .then(() => ({ ok: true, assets: urls.length }))
        );
      });
    });
}

function cacheOfflineShell() {
  return fetch(R.OFFLINE_PATH, { credentials: "same-origin", cache: "no-cache" }).then(storeShell);
}

self.addEventListener("message", (event) => {
  const type = event.data && event.data.type;
  const reply = (value) => {
    const port = event.ports && event.ports[0];
    if (port) port.postMessage(value);
  };
  if (type === "CLEAR_PRIVATE_CACHE") {
    // Sign-out: the offline packs and the saved shell go; public static files stay.
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(R.privateCaches(keys).map((key) => caches.delete(key))))
        .then(() => reply({ ok: true }), () => reply({ ok: false }))
    );
    return;
  }
  if (type === "CACHE_OFFLINE_SHELL") {
    event.waitUntil(cacheOfflineShell().then(reply, () => reply({ ok: false, assets: 0 })));
  }
});

// caches.match with cacheName never creates the cache (caches.open would leave an empty one behind).
function shellResponse() {
  return caches.match(R.OFFLINE_PATH, { cacheName: C.offlineShell, ignoreSearch: true });
}

function offlinePage(request) {
  const network = fetch(request).then((response) => {
    if (response && R.cacheableShell(responseFacts(response))) {
      const copy = response.clone();
      // Refresh the stored shell (and its files, e.g. after a deploy) only once one exists: the first pack creates it.
      shellResponse().then((had) => (had ? storeShell(copy) : undefined)).catch(() => undefined);
    }
    return response;
  });
  return shellResponse().then((cached) => {
    if (!cached) return network.catch(() => caches.match("/offline.html"));
    // A cached shell exists: use the network when it answers quickly, else the cache.
    const slow = new Promise((resolve) => setTimeout(() => resolve(cached), R.OFFLINE_PAGE_TIMEOUT_MS));
    return Promise.race([network.catch(() => cached), slow]);
  });
}

function navigate(request) {
  // Network only: personal pages are never stored.
  return fetch(request).catch(() =>
    shellResponse()
      .then((shell) => {
        const target = R.offlineFallback(new URL(request.url).pathname, !!shell);
        return target === "/offline.html" ? caches.match("/offline.html") : Response.redirect(new URL(target, self.location.origin).href, 302);
      })
      .catch(() => caches.match("/offline.html"))
  );
}

function cacheFirst(request, name, max) {
  return caches.match(request).then(
    (cached) =>
      cached ||
      fetch(request).then((response) => {
        if (canStore(response)) {
          const copy = response.clone();
          store(name, request, copy, max);
        }
        return response;
      })
  );
}

function staleWhileRevalidate(event, request, name, max) {
  return caches.match(request).then((cached) => {
    const network = fetch(request)
      .then((response) => {
        if (canStore(response)) store(name, request, response.clone(), max);
        return response;
      })
      .catch(() => cached);
    if (cached) {
      event.waitUntil(network.then(() => undefined, () => undefined));
      return cached;
    }
    return network;
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const headers = request.headers;
  const route = R.routeFor({
    method: request.method,
    url: request.url,
    mode: request.mode,
    destination: request.destination,
    origin: self.location.origin,
    range: !!(headers && headers.get && headers.get("range")),
    rsc: !!(headers && headers.get && headers.get("rsc")),
  });
  switch (route.strategy) {
    case "navigate":
      event.respondWith(navigate(request));
      return;
    case "offline-page":
      event.respondWith(offlinePage(request));
      return;
    case "precache":
      event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
      return;
    case "static":
      event.respondWith(cacheFirst(request, route.cache, R.LIMITS.staticEntries));
      return;
    case "asset":
      event.respondWith(staleWhileRevalidate(event, request, route.cache, R.LIMITS.assetEntries));
      return;
    default:
      return; // not handled: API data, RSC payloads, cross-origin and everything else
  }
});
