import { readFileSync } from "node:fs";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ role: "STUDENT", pathname: "/dashboard", auth: vi.fn(), redirect: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => m.pathname,
  useRouter: () => ({ push: m.push }),
  redirect: (path: string) => { m.redirect(path); throw new Error(`redirect:${path}`); },
}));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "authenticated", data: { user: { id: "demo", role: m.role, name: "Demo user", email: "demo@example.test" } } }), signOut: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/components/theme/theme-provider", () => ({ useTheme: () => ({ mode: "dark", toggleMode: vi.fn() }) }));
vi.mock("@/components/settings/settings-panel", () => ({ SettingsPanel: () => <p>Display settings</p> }));
vi.mock("@/components/settings/telegram-connect", () => ({ TelegramConnect: () => <p>Telegram settings</p> }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) => <a href={href} {...rest}>{children}</a> }));
import { AdventuresEntry } from "@/components/dashboard/adventures-entry";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import SettingsPage from "@/app/settings/page";
import BillingPage from "@/app/billing/page";

beforeEach(() => {
  vi.clearAllMocks(); m.role = "STUDENT"; m.pathname = "/dashboard";
  m.auth.mockResolvedValue({ user: { id: "demo", role: "STUDENT", email: "demo@example.test" } });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);
describe("student account without Billing", () => {
  it("removes Billing from the shared desktop/mobile navigation, retaining account links", () => {
    const { container } = render(<AppSidebar />);
    expect(container.querySelector('a[href="/billing"]')).toBeNull();
    expect(screen.queryByText("Billing")).toBeNull();
    expect(container.querySelector('a[href="/settings"]')).toBeTruthy();
    expect(container.querySelector('a[href="/profile"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(container.querySelector('a[href="/billing"]')).toBeNull();
  });
  it("removes Billing and payment/balance shortcuts from command search", () => {
    render(<CommandPalette />);
    fireEvent.click(screen.getByRole("button", { name: "Open command palette" }));
    expect(screen.queryByRole("button", { name: "Billing" })).toBeNull();
    const input = screen.getByPlaceholderText("Search pages & actions…");
    for (const term of ["billing", "payment", "topup"]) {
      fireEvent.change(input, { target: { value: term } });
      expect(screen.queryByRole("button", { name: "Billing" })).toBeNull();
      expect(screen.getByText(`No matches for “${term}”`)).toBeTruthy();
    }
  });
  it("keeps profile and notifications, without a payments card in settings", async () => {
    const { container } = render(await SettingsPage());
    expect(container.querySelector('a[href="/billing"]')).toBeNull();
    expect(screen.getByRole("link", { name: /Edit profile/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Notifications/ })).toBeTruthy();
  });
  it("removes retired admin finance navigation and command", () => {
    m.role = "ADMIN"; m.pathname = "/admin/dashboard";
    const { container } = render(<><AppSidebar /><CommandPalette /></>);
    expect(container.querySelector('a[href="/admin/finance"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open command palette" }));
    expect(screen.queryByRole("button", { name: "Moliya" })).toBeNull();
    expect(screen.getByRole("button", { name: "Oʻqituvchilar" })).toBeTruthy();
  });
  it.each([["STUDENT", "/dashboard"], ["TEACHER", "/teacher/dashboard"], ["ADMIN", "/admin/dashboard"]])("redirects the legacy Billing URL for %s", async (role, destination) => {
    m.auth.mockResolvedValue({ user: { id: "demo", role } });
    await expect(BillingPage()).rejects.toThrow(`redirect:${destination}`);
  });
  it("still requires sign-in for a legacy Billing bookmark", async () => {
    m.auth.mockResolvedValue(null);
    await expect(BillingPage()).rejects.toThrow("redirect:/auth/signin");
  });
});


describe("discoverable student Adventures", () => {
  it("keeps Adventures off the dashboard while leaving the Studio entry available", () => {
    const source = readFileSync("components/dashboard/tab-panels.tsx", "utf8");
    expect(source).not.toContain("<AdventuresEntry");
    expect(source).toContain('group="practice" exclude="adventures"');
    render(<AdventuresEntry />);
    expect(screen.getByRole("link", {name: "Explore Adventures"}).getAttribute("href")).toBe("/studio/adventures");
  });
  it("shows a direct student menu entry on desktop and in the phone drawer", () => {
    const { container } = render(<AppSidebar />);
    expect(container.querySelector('a[href="/studio/adventures"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    fireEvent.click(screen.getByRole("button", { name: "Practice & games" }));
    expect(screen.getByRole("link", { name: /Adventures/ }).getAttribute("href")).toBe("/studio/adventures");
  });
  it("highlights Adventures on child routes, not its parent Studio", () => {
    m.pathname = "/studio/adventures/series";
    const { container } = render(<AppSidebar />);
    expect(container.querySelector('a[href="/studio/adventures"]')?.getAttribute("aria-current")).toBe("page");
    expect(container.querySelector('a[href="/studio"]')?.getAttribute("aria-current")).toBeNull();
  });
  it("does not add the student menu shortcut to staff navigation", () => {
    m.role = "TEACHER"; const { container } = render(<AppSidebar />);
    expect(container.querySelector('a[href="/studio/adventures"]')).toBeNull();
  });
});
