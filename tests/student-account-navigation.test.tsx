import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
vi.mock("@/components/settings/settings-panel", () => ({ SettingsPanel: ({ account }: { account?: ReactNode }) => <>{account}<p>Display settings</p></> }));
vi.mock("@/components/settings/telegram-connect", () => ({ TelegramConnect: () => <p>Telegram settings</p> }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) => <a href={href} {...rest}>{children}</a> }));
import { STUDIO_TOOLS } from "@/components/studio/studio-tools";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import SettingsPage from "@/app/settings/page";
import BillingPage from "@/app/billing/page";
import CoachPage from "@/app/coach/page";
import { COACH_TOOLS } from "@/components/coach/coach-tools";

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
    // Settings moved into Profile (idea 9, simpler navigation); the sidebar keeps Profile.
    expect(container.querySelector('aside a[href="/profile"]')).toBeTruthy();
    expect(container.querySelector('aside a[href="/settings"]')).toBeNull();
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
    // Account is a collapsed group on phones: its header opens it.
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
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
  it("lists Adventures as a Practice Studio tool (the Learn tab's shelf), not as a Today card", () => {
    const tool = STUDIO_TOOLS.find((t) => t.slug === "adventures");
    expect(tool?.group).toBe("practice");
    expect(tool?.title).toBe("Adventures");
  });
  // Simpler navigation (docs/elegance-roadmap.md, idea 9): Adventures lives inside
  // Practice Studio instead of being its own sidebar entry.
  it("reaches Adventures through Practice Studio in the menu and by name in search", () => {
    const { container } = render(<><AppSidebar /><CommandPalette /></>);
    expect(container.querySelector('aside a[href="/studio"]')).toBeTruthy();
    expect(container.querySelector('aside a[href="/studio/adventures"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open command palette" }));
    fireEvent.change(screen.getByPlaceholderText("Search pages & actions…"), { target: { value: "adventures" } });
    expect(screen.getByRole("button", { name: "Adventures" })).toBeTruthy();
  });
  it("highlights Practice Studio on Adventures child routes", () => {
    m.pathname = "/studio/adventures/series";
    const { container } = render(<AppSidebar />);
    expect(container.querySelector('aside a[href="/studio"]')?.getAttribute("aria-current")).toBe("page");
  });
  it("highlights AI Coach, not Practice Studio, on a coach tool inside /studio", () => {
    m.pathname = "/studio/essay-xray";
    const { container } = render(<AppSidebar />);
    expect(container.querySelector('aside a[href="/coach"]')?.getAttribute("aria-current")).toBe("page");
    expect(container.querySelector('aside a[href="/studio"]')?.getAttribute("aria-current")).toBeNull();
    expect(container.querySelector('nav[aria-label="Primary"] a[href="/coach"]')?.getAttribute("aria-current")).toBe("page");
  });
  it("does not add student hubs to staff navigation", () => {
    m.role = "TEACHER"; const { container } = render(<AppSidebar />);
    expect(container.querySelector('a[href="/studio"]')).toBeNull();
    expect(container.querySelector('a[href="/coach"]')).toBeNull();
  });
});

describe("AI Coach hub (/coach)", () => {
  it("shows every coach tool as a card with its purpose and one primary link", async () => {
    render(await CoachPage());
    expect(screen.getByRole("heading", { level: 1, name: /AI\s*Coach/ })).toBeTruthy();
    for (const tool of COACH_TOOLS) {
      const card = screen.getByRole("article", { name: new RegExp(tool.name.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")) });
      expect(within(card).getByText(tool.useWhen)).toBeTruthy();
      const links = within(card).getAllByRole("link");
      expect(links.map((a) => a.getAttribute("href"))).toEqual([tool.href]);
      expect(links[0].className).toContain("min-h-[44px]");
    }
  });
  it("is linked from the student sidebar and the phone tab bar", () => {
    const { container } = render(<AppSidebar />);
    expect(container.querySelector('aside a[href="/coach"]')?.textContent).toContain("AI Coach");
    expect(container.querySelector('nav[aria-label="Primary"] a[href="/coach"]')?.textContent).toBe("Coach");
  });
  it.each([["TEACHER", "/teacher/dashboard"], ["ADMIN", "/admin/dashboard"]])("sends %s to their own dashboard", async (role, destination) => {
    m.auth.mockResolvedValue({ user: { id: "demo", role } });
    await expect(CoachPage()).rejects.toThrow(`redirect:${destination}`);
  });
});
