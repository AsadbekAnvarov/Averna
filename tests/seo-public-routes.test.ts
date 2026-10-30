// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, type NextFetchEvent } from "next/server";

const control = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/auth.config", () => ({ authConfig: {} }));
vi.mock("next-auth", () => ({
  default: () => ({
    auth: (handler: (req: NextRequest & { auth: null }, event: unknown) => unknown) =>
      async (req: NextRequest, event: unknown) => {
        if (control.fail) throw new Error("Session resolver unavailable");
        return handler(Object.assign(req, { auth: null }), event);
      },
  }),
}));
import middleware from "../middleware";

beforeEach(() => {
  control.fail = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

for (const failing of [false, true]) {
  describe(failing ? "SEO files with session resolution failure" : "SEO files without a session", () => {
    for (const pathname of ["/", "/about", "/robots.txt", "/sitemap.xml"]) {
      it(`allows the exact public path ${pathname}`, async () => {
        control.fail = failing;
        const response = await middleware(new NextRequest(`https://averna.uz${pathname}`), {} as NextFetchEvent);
        expect(response?.status).toBe(200);
        expect(response?.headers.get("x-middleware-next")).toBe("1");
      });
    }
    for (const pathname of ["/admin/dashboard", "/teacher/students", "/dashboard", "/article", "/reading", "/listening", "/writing", "/robots.txt/private", "/sitemap.xml/private"]) {
      it(`still protects ${pathname}`, async () => {
        control.fail = failing;
        const response = await middleware(new NextRequest(`https://averna.uz${pathname}`), {} as NextFetchEvent);
        expect(response?.status).toBe(307);
        const location = new URL(response!.headers.get("location")!);
        expect(location.pathname).toBe("/auth/signin");
        expect(location.searchParams.get("callbackUrl")).toBe(pathname);
      });
    }
  });
}
