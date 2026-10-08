import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/components/settings/settings-panel", () => ({ SettingsPanel: () => null }));
vi.mock("@/components/settings/telegram-connect", () => ({ TelegramConnect: () => null }));
import BillingPage from "@/app/billing/page";
import SettingsPage from "@/app/settings/page";
describe("retired student Billing route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.redirect.mockImplementation((url: string) => { throw new Error(`redirect:${url}`); });
  });
  afterEach(cleanup);
  it.each([
    [null, "/auth/signin"],
    [{ user: { role: "STUDENT" } }, "/dashboard"],
    [{ user: { role: "TEACHER" } }, "/teacher/dashboard"],
    [{ user: { role: "ADMIN" } }, "/admin/dashboard"],
  ])("redirects old links without a checkout", async (session, target) => {
    m.auth.mockResolvedValue(session);
    await expect(BillingPage()).rejects.toThrow(`redirect:${target}`);
    expect(m.redirect).toHaveBeenCalledOnce();
  });
  it("removes the old balance-mutating demo server actions", () => {
    const source = readFileSync("app/billing/page.tsx", "utf8");
    expect(source).not.toMatch(/use server|db\.|topUp\(|payCourse\(|form action=/);
  });
  it("removes Billing from settings but retains the student profile link", async () => {
    m.auth.mockResolvedValue({ user: { role: "STUDENT", email: "s@example.test" } });
    const { container } = render(await SettingsPage());
    expect(container.querySelector('a[href="/billing"]')).toBeNull();
    expect(container.querySelector('a[href="/profile"]')).not.toBeNull();
  });
  it("retains the admin profile link in settings", async () => {
    m.auth.mockResolvedValue({ user: { role: "ADMIN", email: "a@example.test" } });
    const { container } = render(await SettingsPage());
    expect(container.querySelector('a[href="/admin/profile"]')).not.toBeNull();
  });
});
