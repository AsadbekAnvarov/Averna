// @vitest-environment node
/**
 * The service worker's routing decisions (public/sw-routes.js, idea 7 "Instant and offline").
 * The worker loads this very file with importScripts, so what is tested here is what runs.
 */
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { OFFLINE_PACKS_CACHE, OFFLINE_SHELL_CACHE } from "@/lib/offline/constants";

type Route = { strategy: string; cache?: string };
type Routes = {
  CACHES: Record<"shell" | "static" | "assets" | "offlineShell" | "packs", string>;
  PRECACHE: string[];
  routeFor: (req: Record<string, unknown>) => Route;
  cacheableResponse: (res: Record<string, unknown>) => boolean;
  cacheableShell: (res: Record<string, unknown>) => boolean;
  offlineFallback: (path: string, shellCached: boolean) => string;
  shellAssetUrls: (html: string) => string[];
  staleCaches: (keys: string[]) => string[];
  privateCaches: (keys: string[]) => string[];
  overflow: <T>(keys: T[], max: number) => T[];
};

function load(): Routes {
  const self: { AvernaSwRoutes?: Routes } = {};
  runInNewContext(readFileSync("public/sw-routes.js", "utf8"), { self, URL });
  return self.AvernaSwRoutes!;
}
const R = load();
const ORIGIN = "https://averna.example";
const req = (path: string, extra: Record<string, unknown> = {}) => ({ method: "GET", url: `${ORIGIN}${path}`, mode: "cors", origin: ORIGIN, ...extra });
const nav = (path: string) => req(path, { mode: "navigate", destination: "document" });
/** Strategies that store or serve stored responses. */
const CACHING = new Set(["static", "asset", "precache", "offline-page"]);

describe("routeFor", () => {
  it("never caches personal pages: navigations are network-only (except the /offline shell)", () => {
    for (const p of ["/dashboard", "/teacher/students", "/progress?tab=skills", "/article/food", "/offline.html", "/settings"]) {
      expect(R.routeFor(nav(p)).strategy, p).toBe("navigate");
    }
    expect(R.routeFor(nav("/offline"))).toEqual({ strategy: "offline-page", cache: R.CACHES.offlineShell });
    expect(R.routeFor(nav("/offline?pack=a")).strategy).toBe("offline-page");
  });

  it("never touches API data, RSC payloads, range requests, other methods or frames", () => {
    expect(R.routeFor(req("/api/profile")).strategy).toBe("none");
    expect(R.routeFor(req("/api/srs/review", { method: "POST" })).strategy).toBe("none");
    expect(R.routeFor(req("/api/articles/lesson/food", { mode: "navigate", destination: "document" })).strategy).toBe("none");
    expect(R.routeFor(req("/dashboard?_rsc=1x2")).strategy).toBe("none");
    expect(R.routeFor(req("/dashboard", { rsc: true })).strategy).toBe("none");
    expect(R.routeFor(req("/_next/static/chunks/a.js", { method: "POST" })).strategy).toBe("none");
    expect(R.routeFor(req("/audio.mp3", { range: true })).strategy).toBe("none");
    expect(R.routeFor(req("/article/food", { mode: "navigate", destination: "iframe" })).strategy).toBe("none");
    expect(R.routeFor(req("/_next/image?url=%2Flogo.png&w=64")).strategy).toBe("none");
  });

  it("serves hashed /_next/static files and fonts cache-first, public images stale-while-revalidate", () => {
    expect(R.routeFor(req("/_next/static/chunks/app/page-1a2b.js"))).toEqual({ strategy: "static", cache: R.CACHES.static });
    expect(R.routeFor(req("/_next/static/css/9f8e.css")).strategy).toBe("static");
    expect(R.routeFor(req("/_next/static/media/inter.3f2a.woff2")).strategy).toBe("static");
    expect(R.routeFor(req("/fonts/x.woff2")).strategy).toBe("static");
    expect(R.routeFor(req("/avatars/cat.png"))).toEqual({ strategy: "asset", cache: R.CACHES.assets });
    expect(R.routeFor(req("/icon.svg?abc")).strategy).toBe("none");
    for (const p of R.PRECACHE) expect(R.routeFor(req(p)).strategy).toBe("precache");
    expect(R.routeFor(req("/robots.txt")).strategy).toBe("none");
  });

  it("ignores other origins entirely", () => {
    expect(R.routeFor({ ...req("/_next/static/chunks/a.js"), url: "https://cdn.example/_next/static/chunks/a.js" }).strategy).toBe("none");
    expect(R.routeFor({ ...nav("/dashboard"), url: "https://evil.example/dashboard" }).strategy).toBe("none");
  });

  const segment = fc.stringMatching(/^[a-z0-9_-]{1,8}$/);
  const pathOf = fc.array(segment, { minLength: 1, maxLength: 4 }).map((s) => "/" + s.join("/"));
  const ext = fc.constantFrom("", ".js", ".css", ".png", ".json", ".html", ".woff2", ".svg");

  it("property: /api/** and RSC requests are never cached, whatever the path, method or mode", () => {
    fc.assert(
      fc.property(pathOf, ext, fc.constantFrom("GET", "POST", "HEAD"), fc.constantFrom("cors", "navigate", "no-cors", "same-origin"), (p, e, method, mode) => {
        const api = R.routeFor(req(`/api${p}${e}`, { method, mode }));
        const flight = R.routeFor(req(`${p}${e}?_rsc=${p.length}`, { method, mode }));
        const header = R.routeFor(req(`${p}${e}`, { method, mode, rsc: true }));
        return api.strategy === "none" && flight.strategy === "none" && header.strategy === "none";
      }),
      { numRuns: 300 },
    );
  });

  it("property: a navigation is only ever served from the cache for /offline", () => {
    fc.assert(
      fc.property(pathOf, (p) => {
        const r = R.routeFor(nav(p));
        return p === "/offline" ? r.strategy === "offline-page" : !CACHING.has(r.strategy);
      }),
      { numRuns: 300 },
    );
  });

  it("property: requests to another origin are never handled", () => {
    fc.assert(
      fc.property(fc.constantFrom("https://cdn.example", "http://averna.example", "https://averna.example:8443"), pathOf, ext, (origin, p, e) => {
        return R.routeFor({ method: "GET", url: `${origin}/_next/static${p}${e}`, mode: "cors", origin: ORIGIN }).strategy === "none";
      }),
      { numRuns: 200 },
    );
  });
});

describe("cacheableResponse", () => {
  it("stores only plain same-origin 200s that aren't no-store or private", () => {
    expect(R.cacheableResponse({ status: 200, type: "basic", cacheControl: "public, max-age=31536000, immutable" })).toBe(true);
    expect(R.cacheableResponse({ status: 200, type: "basic", cacheControl: "" })).toBe(true);
    expect(R.cacheableResponse({ status: 200, type: "basic", cacheControl: "private, no-cache, no-store, max-age=0, must-revalidate" })).toBe(false);
    expect(R.cacheableResponse({ status: 200, type: "basic", cacheControl: "private, max-age=300" })).toBe(false);
    expect(R.cacheableResponse({ status: 200, type: "opaque", cacheControl: "" })).toBe(false);
    expect(R.cacheableResponse({ status: 200, type: "basic", redirected: true })).toBe(false);
    expect(R.cacheableResponse({ status: 206, type: "basic" })).toBe(false);
    expect(R.cacheableResponse({ status: 404, type: "basic" })).toBe(false);
    expect(R.cacheableShell({ status: 200, type: "basic", cacheControl: "s-maxage=31536000", contentType: "text/html; charset=utf-8" })).toBe(true);
    expect(R.cacheableShell({ status: 200, type: "basic", cacheControl: "", contentType: "application/json" })).toBe(false);
  });

  it("property: Cache-Control no-store (any case, anywhere in the header) is never stored", () => {
    const directive = fc.constantFrom("public", "max-age=0", "must-revalidate", "s-maxage=60", "immutable", "no-cache");
    fc.assert(
      fc.property(fc.array(directive, { maxLength: 4 }), fc.nat(4), fc.constantFrom("no-store", "No-Store", "NO-STORE"), (rest, at, noStore) => {
        const parts: string[] = [...rest];
        parts.splice(Math.min(at, parts.length), 0, noStore);
        return !R.cacheableResponse({ status: 200, type: "basic", cacheControl: parts.join(", ") }) && !R.cacheableShell({ status: 200, type: "basic", cacheControl: parts.join(", "), contentType: "text/html" });
      }),
      { numRuns: 200 },
    );
  });
});

describe("offline shell", () => {
  it("falls back to the saved-packs page (with the page that needed a connection) when it is cached", () => {
    expect(R.offlineFallback("/learning/reading", true)).toBe("/offline?from=%2Flearning%2Freading");
    expect(R.offlineFallback("/offline", true)).toBe("/offline");
    expect(R.offlineFallback("//evil.example", true)).toBe("/offline");
    expect(R.offlineFallback("/dashboard", false)).toBe("/offline.html");
  });

  it("finds the static files the shell HTML needs, once each, same-origin only", () => {
    const html = [
      '<link rel="stylesheet" href="/_next/static/css/app.css"/>',
      '<script src="/_next/static/chunks/webpack-1.js" async=""></script>',
      '<script src="/_next/static/chunks/webpack-1.js"></script>',
      '<script>self.__next_f.push([1,"2:I[\\"static/chunks/app/offline/page-9.js\\"]"])</script>',
      '<script src="https://cdn.example/_next/static/x.js"></script>',
      '<a href="/_next/static/../api/profile">x</a>',
    ].join("");
    expect(R.shellAssetUrls(html)).toEqual(["/_next/static/css/app.css", "/_next/static/chunks/webpack-1.js", "/_next/static/chunks/app/offline/page-9.js"]);
  });
});

describe("cache housekeeping", () => {
  const keys = ["averna-v2", "averna-public-v3", R.CACHES.shell, R.CACHES.static, R.CACHES.assets, R.CACHES.offlineShell, R.CACHES.packs, "another-app"];
  it("activate deletes old Averna versions only, never the packs or another app's caches", () => {
    expect(R.staleCaches(keys)).toEqual(["averna-v2", "averna-public-v3"]);
  });
  it("sign-out (CLEAR_PRIVATE_CACHE) deletes the packs and the saved shell, keeps public static files", () => {
    expect(R.privateCaches(keys).sort()).toEqual(["averna-public-v3", "averna-v2", R.CACHES.offlineShell, R.CACHES.packs].sort());
  });
  it("trims the oldest entries beyond the cap", () => {
    expect(R.overflow([1, 2, 3, 4, 5], 3)).toEqual([1, 2]);
    expect(R.overflow([1, 2], 3)).toEqual([]);
  });
});

describe("the worker, the page and the module agree", () => {
  it("uses the same cache names as the page code and offline.html", () => {
    expect(R.CACHES.packs).toBe(OFFLINE_PACKS_CACHE);
    expect(R.CACHES.offlineShell).toBe(OFFLINE_SHELL_CACHE);
    expect(readFileSync("public/offline.html", "utf8")).toContain(`cacheName: "${OFFLINE_SHELL_CACHE}"`);
  });
  it("loads the routing module and keeps no routing table of its own", () => {
    const sw = readFileSync("public/sw.js", "utf8");
    expect(sw).toContain('importScripts("/sw-routes.js")');
    expect(sw).toContain("R.routeFor(");
    expect(sw).not.toMatch(/averna-(public|static|assets|offline)-v\d/);
    // Unauthenticated visitors must be able to install the worker (the middleware lets both files through).
    expect(readFileSync("middleware.ts", "utf8")).toMatch(/pathname === "\/sw-routes\.js"/);
  });
});
