/*
 * Averna service worker: routing decisions (idea 7, "Instant and offline").
 *
 * Plain ES2017 with no imports, so the worker loads it with importScripts("/sw-routes.js")
 * and the tests (tests/sw-routes.test.ts, tests/offline-privacy.test.ts) run the very same
 * file. Pure functions only: no fetch, no caches, no clocks.
 *
 * Privacy rule: the worker never stores authenticated HTML, RSC responses or API data. The
 * only HTML page it keeps is /offline, a static client shell with no personal data in it
 * (it reads the student's packs from IndexedDB / Cache Storage on the device).
 */
(function (root) {
  "use strict";

  var CACHES = {
    /** Precached offline screen, logo and manifest. */
    shell: "averna-public-v4",
    /** Hashed, immutable /_next/static/** files and fonts: cache-first. */
    static: "averna-static-v4",
    /** Public images and icons from /public: stale-while-revalidate. */
    assets: "averna-assets-v4",
    /** The /offline page HTML and the static files it needs, saved with the first pack. */
    offlineShell: "averna-offline-shell-v1",
    /** Pack files written by the page (lesson HTML, recordings). Wiped on sign-out. */
    packs: "averna-offline-packs-v1",
  };

  var PRECACHE = ["/offline.html", "/logo.png", "/manifest.webmanifest"];
  var OFFLINE_PATH = "/offline";
  var LIMITS = { staticEntries: 400, assetEntries: 80, shellAssets: 250 };
  /** Network-first for /offline gives up after this long when a cached copy exists (slow phone connections). */
  var OFFLINE_PAGE_TIMEOUT_MS = 4000;

  var FONT_RE = /\.(?:woff2?|ttf|otf)$/i;
  var IMAGE_RE = /\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/i;

  function lower(value) {
    return typeof value === "string" ? value.toLowerCase() : "";
  }

  /** Caches the worker owns. Anything else starting with "averna-" is an old version and is deleted. */
  function keptCaches() {
    return [CACHES.shell, CACHES.static, CACHES.assets, CACHES.offlineShell, CACHES.packs];
  }

  /** Old caches to delete on activate: Averna's only, never another app's. */
  function staleCaches(keys) {
    var keep = keptCaches();
    return keys.filter(function (key) {
      return typeof key === "string" && key.indexOf("averna-") === 0 && keep.indexOf(key) < 0;
    });
  }

  /** Caches to delete on sign-out (CLEAR_PRIVATE_CACHE): the packs, the offline shell and any old version. Static files stay. */
  function privateCaches(keys) {
    var publicOnes = [CACHES.shell, CACHES.static, CACHES.assets];
    return keys.filter(function (key) {
      return typeof key === "string" && key.indexOf("averna-") === 0 && publicOnes.indexOf(key) < 0;
    });
  }

  /**
   * How the worker answers one request.
   *   req: { method, url, mode, destination?, origin (the worker's origin), range?: boolean, rsc?: boolean }
   * Returns { strategy, cache? } where strategy is one of
   *   "none"          not handled: the browser goes to the network as if there were no worker
   *   "navigate"      network only; offline → the saved-packs shell when cached, else /offline.html
   *   "offline-page"  /offline: network first (refreshing the cached shell), cache when offline or slow
   *   "precache"      cache first from the precached shell files
   *   "static"        cache first, then network (hashed /_next/static/** and fonts)
   *   "asset"         stale-while-revalidate (public images and icons)
   */
  function routeFor(req) {
    var none = { strategy: "none" };
    if (!req || lower(req.method) !== "get") return none;
    var url;
    try {
      url = new URL(req.url);
    } catch (e) {
      return none;
    }
    if (url.origin !== req.origin) return none; // cross-origin: never touched
    if (req.range) return none; // media range requests go straight to the network
    var path = url.pathname;
    if (path === "/api" || path.indexOf("/api/") === 0) return none; // API data is never cached
    if (req.rsc || url.searchParams.has("_rsc")) return none; // RSC payloads are never cached

    if (req.mode === "navigate") {
      // Frames (lesson documents, embeds) are left alone.
      if (req.destination && req.destination !== "document") return none;
      if (path === OFFLINE_PATH) return { strategy: "offline-page", cache: CACHES.offlineShell };
      return { strategy: "navigate" };
    }

    if (path.indexOf("/_next/static/") === 0) return { strategy: "static", cache: CACHES.static };
    if (path.indexOf("/_next/") === 0) return none; // image optimiser, data routes: never cached
    if (url.search) return none;
    if (PRECACHE.indexOf(path) >= 0) return { strategy: "precache", cache: CACHES.shell };
    if (FONT_RE.test(path)) return { strategy: "static", cache: CACHES.static };
    if (IMAGE_RE.test(path)) return { strategy: "asset", cache: CACHES.assets };
    return none;
  }

  /**
   * Whether a network response may be stored: a plain 200 from this origin, not redirected,
   * and not marked no-store or private (personal pages are "private, no-store").
   *   res: { status, type?, redirected?, cacheControl? }
   */
  function cacheableResponse(res) {
    if (!res || res.status !== 200 || res.redirected) return false;
    if (res.type && res.type !== "basic" && res.type !== "default") return false;
    var cc = lower(res.cacheControl);
    return cc.indexOf("no-store") < 0 && cc.indexOf("private") < 0;
  }

  /** The offline shell is stored only when it is cacheable HTML. */
  function cacheableShell(res) {
    return cacheableResponse(res) && lower(res.contentType).indexOf("text/html") === 0;
  }

  /** Where a failed navigation goes: the saved-packs shell (with the page that needed a connection) or the plain offline screen. */
  function offlineFallback(path, shellCached) {
    if (!shellCached) return "/offline.html";
    return path && path !== OFFLINE_PATH && path.charAt(0) === "/" && path.indexOf("//") !== 0
      ? OFFLINE_PATH + "?from=" + encodeURIComponent(path)
      : OFFLINE_PATH;
  }

  /**
   * The same-origin static files a cached copy of the /offline page needs: script and style
   * URLs in the HTML and the chunk paths named in its inline RSC payload. Unique, in order.
   */
  function shellAssetUrls(html) {
    var out = [];
    var seen = Object.create(null);
    function add(path) {
      var clean = path.replace(/\\+$/, "").split(/[?#]/)[0];
      if (!/^\/_next\/static\/[\w\-./~%@]+$/.test(clean) || clean.indexOf("..") >= 0 || seen[clean]) return;
      seen[clean] = true;
      out.push(clean);
    }
    var text = String(html || "");
    // Root-relative URLs only (not ".../_next/static/..." inside another site's URL).
    var direct = /(^|[^\w.:/-])(\/_next\/static\/[^"'\s<>()\\]+)/g;
    var m;
    while ((m = direct.exec(text))) add(m[2]);
    // Chunk paths in the inline RSC payload ("static/chunks/…").
    var payload = /(^|[^\w./-])(static\/(?:chunks|css|media)\/[^"'\s<>()\\]+)/g;
    while ((m = payload.exec(text))) add("/_next/" + m[2]);
    return out.slice(0, LIMITS.shellAssets);
  }

  /** Entries to delete so a cache keeps at most `max` (the oldest first: Cache Storage keeps insertion order). */
  function overflow(keys, max) {
    return keys.length > max ? keys.slice(0, keys.length - max) : [];
  }

  root.AvernaSwRoutes = {
    CACHES: CACHES,
    PRECACHE: PRECACHE,
    OFFLINE_PATH: OFFLINE_PATH,
    LIMITS: LIMITS,
    OFFLINE_PAGE_TIMEOUT_MS: OFFLINE_PAGE_TIMEOUT_MS,
    keptCaches: keptCaches,
    staleCaches: staleCaches,
    privateCaches: privateCaches,
    routeFor: routeFor,
    cacheableResponse: cacheableResponse,
    cacheableShell: cacheableShell,
    offlineFallback: offlineFallback,
    shellAssetUrls: shellAssetUrls,
    overflow: overflow,
  };
})(typeof self !== "undefined" ? self : globalThis);
