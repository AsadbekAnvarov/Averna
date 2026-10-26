// @vitest-environment node
/**
 * public/sw.js run as-is (with its routing module public/sw-routes.js) against a fake
 * Cache Storage and network: what it stores, what it never stores, what it serves offline.
 */
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const ORIGIN = "https://averna.example";

type FakeResponse = { status: number; type: string; redirected: boolean; headers: Headers; clone: () => FakeResponse; text: () => Promise<string>; body?: string };
function response(body: string, init: { status?: number; cacheControl?: string; contentType?: string; type?: string } = {}): FakeResponse {
  const headers = new Headers();
  if (init.cacheControl !== undefined) headers.set("cache-control", init.cacheControl);
  if (init.contentType) headers.set("content-type", init.contentType);
  const r: FakeResponse = {
    status: init.status ?? 200,
    type: init.type ?? "basic",
    redirected: false,
    headers,
    body,
    clone: () => r,
    text: async () => body,
  };
  return r;
}

function worker(options: { keys?: string[]; network?: (url: string) => Promise<FakeResponse> } = {}) {
  const handlers: Record<string, (event: any) => void> = {};
  const stores = new Map<string, Map<string, FakeResponse>>();
  const keyOf = (r: unknown) => new URL(typeof r === "string" ? r : (r as { url: string }).url, ORIGIN).href;
  const strip = (href: string) => href.split("?")[0];
  const open = vi.fn(async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      addAll: vi.fn(async (urls: string[]) => urls.forEach((u) => store.set(keyOf(u), response(`precached ${u}`)))),
      put: vi.fn(async (r: unknown, res: FakeResponse) => void store.set(keyOf(r), res)),
      match: vi.fn(async (r: unknown, o?: { ignoreSearch?: boolean }) => {
        const k = keyOf(r);
        if (store.has(k)) return store.get(k);
        if (o?.ignoreSearch) for (const [key, v] of store) if (strip(key) === strip(k)) return v;
        return undefined;
      }),
      keys: vi.fn(async () => Array.from(store.keys(), (url) => ({ url }))),
      delete: vi.fn(async (r: unknown) => store.delete(keyOf(r))),
    };
  });
  const match = vi.fn(async (r: unknown, o?: { cacheName?: string; ignoreSearch?: boolean }) => {
    const k = keyOf(r);
    for (const [name, store] of stores) {
      if (o?.cacheName && name !== o.cacheName) continue;
      if (store.has(k)) return store.get(k);
      if (o?.ignoreSearch) for (const [key, v] of store) if (strip(key) === strip(k)) return v;
    }
    return undefined;
  });
  const remove = vi.fn(async (name: string) => stores.delete(name));
  const network = vi.fn(options.network ?? (async () => response("private page", { cacheControl: "private, no-cache, no-store, max-age=0, must-revalidate", contentType: "text/html" })));
  const context = createContext({
    URL,
    Promise,
    Set,
    Headers,
    setTimeout,
    Response: { redirect: (url: string, status: number) => ({ redirect: url, status }) },
    self: {
      location: { origin: ORIGIN },
      addEventListener: (name: string, fn: (event: any) => void) => {
        handlers[name] = fn;
      },
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() },
    },
    caches: { open, match, keys: vi.fn(async () => options.keys ?? Array.from(stores.keys())), delete: remove },
    fetch: (r: unknown) => network(keyOf(r)),
  });
  const contextObject = context as { importScripts?: (path: string) => void };
  contextObject.importScripts = (path: string) => runInContext(readFileSync(`public${path}`, "utf8"), context);
  runInContext(readFileSync("public/sw.js", "utf8"), context);
  const fetchEvent = async (request: Record<string, unknown>) => {
    let responded: Promise<unknown> | undefined;
    const waits: Promise<unknown>[] = [];
    handlers.fetch({
      request: { method: "GET", mode: "cors", headers: new Headers(), ...request },
      respondWith: (p: Promise<unknown>) => {
        responded = p;
      },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    });
    const value = responded ? await responded : undefined;
    await Promise.all(waits);
    await new Promise((r) => setTimeout(r, 0));
    return { responded: !!responded, value };
  };
  const stored = (name: string) => Array.from(stores.get(name)?.keys() ?? []);
  return { handlers, stores, stored, open, match, network, remove, fetchEvent };
}

describe("offline privacy", () => {
  it("never caches authenticated navigation", async () => {
    const w = worker();
    const { value } = await w.fetchEvent({ mode: "navigate", destination: "document", url: `${ORIGIN}/dashboard` });
    expect((value as FakeResponse).body).toBe("private page");
    expect([...w.stores.values()].every((s) => s.size === 0)).toBe(true);
  });

  it("returns only the neutral offline screen when navigation fails and nothing was saved", async () => {
    const w = worker({ network: async () => Promise.reject(new Error("offline")) });
    const { value } = await w.fetchEvent({ mode: "navigate", destination: "document", url: `${ORIGIN}/teacher/students` });
    expect(w.match).toHaveBeenCalledWith("/offline.html");
    expect(value).toBeUndefined(); // nothing precached in this fake: the browser's own error page
  });

  it("sends a failed navigation to the saved-packs page once the student saved one", async () => {
    const w = worker({ network: async () => Promise.reject(new Error("offline")) });
    const shell = await w.open("averna-offline-shell-v1");
    await shell.put("/offline", response("<html>shell</html>", { contentType: "text/html" }));
    const { value } = await w.fetchEvent({ mode: "navigate", destination: "document", url: `${ORIGIN}/learning/reading` });
    expect(value).toEqual({ redirect: `${ORIGIN}/offline?from=%2Flearning%2Freading`, status: 302 });
    const page = await w.fetchEvent({ mode: "navigate", destination: "document", url: `${ORIGIN}/offline?from=%2Flearning%2Freading` });
    expect((page.value as FakeResponse).body).toBe("<html>shell</html>");
  });

  it("does not intercept API or RSC requests", async () => {
    const w = worker();
    for (const url of [`${ORIGIN}/api/profile`, `${ORIGIN}/dashboard?_rsc=a`]) {
      expect((await w.fetchEvent({ url })).responded).toBe(false);
    }
    const rsc = new Headers({ rsc: "1" });
    expect((await w.fetchEvent({ url: `${ORIGIN}/dashboard`, headers: rsc })).responded).toBe(false);
    expect(w.network).not.toHaveBeenCalled();
  });

  it("keeps hashed static files cache-first, and never stores a no-store response", async () => {
    let body = "chunk v1";
    const w = worker({
      network: async (url) =>
        url.includes("/_next/static/")
          ? response(body, { cacheControl: "public, max-age=31536000, immutable" })
          : response("dev chunk", { cacheControl: "no-store, must-revalidate" }),
    });
    const url = `${ORIGIN}/_next/static/chunks/app-1a2b.js`;
    expect(((await w.fetchEvent({ url })).value as FakeResponse).body).toBe("chunk v1");
    body = "chunk v2";
    expect(((await w.fetchEvent({ url })).value as FakeResponse).body).toBe("chunk v1"); // from the cache
    expect(w.network).toHaveBeenCalledTimes(1);
    expect(w.stored("averna-static-v4")).toEqual([url]);

    await w.fetchEvent({ url: `${ORIGIN}/fonts/inter.woff2` });
    expect(w.stored("averna-static-v4")).toEqual([url]);
  });

  it("purges Averna's legacy caches, not the packs or other apps", async () => {
    const w = worker({ keys: ["averna-v2", "averna-public-v3", "averna-public-v4", "averna-offline-packs-v1", "averna-offline-shell-v1", "another-app"] });
    let pending: Promise<unknown> | undefined;
    w.handlers.activate({
      waitUntil: (p: Promise<unknown>) => {
        pending = p;
      },
    });
    await pending;
    expect(w.remove.mock.calls.map((c) => c[0]).sort()).toEqual(["averna-public-v3", "averna-v2"]);
  });

  it("CLEAR_PRIVATE_CACHE (sign-out) wipes the offline packs and the saved shell, not the static files", async () => {
    const w = worker({ keys: ["averna-public-v4", "averna-static-v4", "averna-assets-v4", "averna-offline-packs-v1", "averna-offline-shell-v1", "another-app"] });
    let pending: Promise<unknown> | undefined;
    const reply = vi.fn();
    w.handlers.message({
      data: { type: "CLEAR_PRIVATE_CACHE" },
      ports: [{ postMessage: reply }],
      waitUntil: (p: Promise<unknown>) => {
        pending = p;
      },
    });
    await pending;
    expect(w.remove.mock.calls.map((c) => c[0]).sort()).toEqual(["averna-offline-packs-v1", "averna-offline-shell-v1"]);
    expect(reply).toHaveBeenCalledWith({ ok: true });
  });

  it("CACHE_OFFLINE_SHELL keeps the static /offline page and the files it names, but refuses a private one", async () => {
    const shellHtml = '<script src="/_next/static/chunks/main-1.js"></script><link href="/_next/static/css/a.css">';
    let shellCache = "s-maxage=31536000";
    const w = worker({
      network: async (url) =>
        url.endsWith("/offline")
          ? response(shellHtml, { cacheControl: shellCache, contentType: "text/html; charset=utf-8" })
          : response(`file ${url}`, { cacheControl: "public, max-age=31536000, immutable" }),
    });
    const send = async () => {
      let pending: Promise<unknown> | undefined;
      const reply = vi.fn();
      w.handlers.message({ data: { type: "CACHE_OFFLINE_SHELL" }, ports: [{ postMessage: reply }], waitUntil: (p: Promise<unknown>) => (pending = p) });
      await pending;
      return reply.mock.calls[0]?.[0];
    };
    expect(await send()).toEqual({ ok: true, assets: 2 });
    expect(w.stored("averna-offline-shell-v1").sort()).toEqual([`${ORIGIN}/_next/static/chunks/main-1.js`, `${ORIGIN}/_next/static/css/a.css`, `${ORIGIN}/offline`].sort());

    w.stores.delete("averna-offline-shell-v1");
    shellCache = "private, no-cache, no-store, max-age=0, must-revalidate";
    expect(await send()).toEqual({ ok: false, assets: 0 });
    expect(w.stored("averna-offline-shell-v1")).toEqual([]);
  });

  it("keeps the previous shell when a file of the new one can't be fetched (all or nothing)", async () => {
    let html = '<script src="/_next/static/chunks/old-1.js"></script>';
    const w = worker({
      network: async (url) => {
        if (url.endsWith("/offline")) return response(html, { cacheControl: "s-maxage=1", contentType: "text/html" });
        if (url.includes("new-2")) throw new Error("offline");
        return response(`file ${url}`, { cacheControl: "public, immutable" });
      },
    });
    const send = async () => {
      let pending: Promise<unknown> | undefined;
      const reply = vi.fn();
      w.handlers.message({ data: { type: "CACHE_OFFLINE_SHELL" }, ports: [{ postMessage: reply }], waitUntil: (p: Promise<unknown>) => (pending = p) });
      await pending;
      return reply.mock.calls[0]?.[0];
    };
    expect(await send()).toEqual({ ok: true, assets: 1 });
    html = '<script src="/_next/static/chunks/new-2.js"></script>';
    expect(await send()).toEqual({ ok: false, assets: 0 });
    const shell = w.stores.get("averna-offline-shell-v1")!;
    expect([...shell.keys()].sort()).toEqual([`${ORIGIN}/_next/static/chunks/old-1.js`, `${ORIGIN}/offline`]);
    expect(shell.get(`${ORIGIN}/offline`)?.body).toContain("old-1.js");
  });
});
