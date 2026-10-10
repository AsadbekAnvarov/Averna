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
  it("retains the admin finance navigation and command", () => {
    m.role = "ADMIN"; m.pathname = "/admin/dashboard";
    const { container } = render(<><AppSidebar /><CommandPalette /></>);
    expect(container.querySelector('a[href="/admin/finance"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open command palette" }));
    expect(screen.getByRole("button", { name: "Moliya" })).toBeTruthy();
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
