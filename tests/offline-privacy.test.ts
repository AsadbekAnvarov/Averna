// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
function worker() {
  const handlers: Record<string, (event: any) => void> = {};
  const put = vi.fn();
  const match = vi.fn().mockResolvedValue({ offline: true });
  const network = vi.fn().mockResolvedValue({ private: true });
  const remove = vi.fn().mockResolvedValue(true);
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    URL,
    Promise,
    self: {
      location: { origin: "https://averna.example" },
      addEventListener: (name: string, fn: (event: any) => void) => {
        handlers[name] = fn;
      },
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() },
    },
    caches: {
      open: vi.fn().mockResolvedValue({ addAll: vi.fn(), put }),
      match,
      keys: vi
        .fn()
        .mockResolvedValue(["averna-v2", "averna-public-v3", "another-app"]),
      delete: remove,
    },
    fetch: network,
  });
  return { handlers, put, match, network, remove };
}
describe("offline privacy", () => {
  it("never caches authenticated navigation", async () => {
    const w = worker();
    let response: Promise<unknown> | undefined;
    w.handlers.fetch({
      request: {
        method: "GET",
        mode: "navigate",
        url: "https://averna.example/dashboard",
      },
      respondWith: (p: Promise<unknown>) => {
        response = p;
      },
    });
    expect(await response).toEqual({ private: true });
    expect(w.put).not.toHaveBeenCalled();
  });
  it("returns only the neutral offline screen when navigation fails", async () => {
    const w = worker();
    w.network.mockRejectedValue(new Error("offline"));
    let response: Promise<unknown> | undefined;
    w.handlers.fetch({
      request: {
        method: "GET",
        mode: "navigate",
        url: "https://averna.example/teacher/students",
      },
      respondWith: (p: Promise<unknown>) => {
        response = p;
      },
    });
    await response;
    expect(w.match).toHaveBeenCalledWith("/offline.html");
  });
  it("does not intercept API or RSC requests", () => {
    const w = worker();
    const respond = vi.fn();
    for (const url of [
      "https://averna.example/api/profile",
      "https://averna.example/dashboard?_rsc=a",
    ])
      w.handlers.fetch({
        request: { method: "GET", mode: "cors", url },
        respondWith: respond,
      });
    expect(respond).not.toHaveBeenCalled();
  });
  it("purges Averna's legacy caches, not other apps", async () => {
    const w = worker();
    let pending: Promise<unknown> | undefined;
    w.handlers.activate({
      waitUntil: (p: Promise<unknown>) => {
        pending = p;
      },
    });
    await pending;
    expect(w.remove).toHaveBeenCalledWith("averna-v2");
    expect(w.remove).not.toHaveBeenCalledWith("another-app");
    expect(w.remove).not.toHaveBeenCalledWith("averna-public-v3");
  });
});
