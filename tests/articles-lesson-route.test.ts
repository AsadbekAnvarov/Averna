import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
import { GET } from "@/app/api/articles/lesson/[slug]/route";
import { LESSON_SHIM } from "@/lib/articles/lesson-document";

const call = (slug: string) => GET(new Request(`http://localhost:3000/api/articles/lesson/${slug}`), { params: Promise.resolve({ slug }) });

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
});

describe("interactive lesson document route", () => {
  it("requires a session", async () => {
    m.auth.mockResolvedValue(null);
    const res = await call("food-and-cooking");
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain("<html");
  });

  it("returns 404 for unknown slugs and structured lessons", async () => {
    expect((await call("missing-lesson")).status).toBe(404);
    expect((await call("what-are-they-like")).status).toBe(404);
    expect((await call("..%2F..%2Fpackage.json")).status).toBe(404);
  });

  it("serves the lesson sandboxed, offline and with the shim", async () => {
    const res = await call("food-and-cooking");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("private, max-age=300");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("x-frame-options")).toBeNull();
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("sandbox allow-scripts");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain("allow-same-origin");
    const html = await res.text();
    expect(html).toContain(`<head><script>${LESSON_SHIM}</script>`);
    expect(html).toContain("<title>Around the World in Seven Dinners</title>");
  });
});
