import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ path: "/dashboard", role: "STUDENT", push: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => m.path, useRouter: () => ({ push: m.push }) }));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "u", name: "Student", email: "s@example.test", role: m.role } }, status: "authenticated" }),
  signOut: vi.fn(),
}));
vi.mock("@/components/theme/theme-provider", () => ({ useTheme: () => ({ mode: "dark", toggleMode: vi.fn() }) }));
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
describe("student navigation without Billing", () => {
  beforeEach(() => { m.path = "/dashboard"; m.role = "STUDENT"; });
  afterEach(cleanup);
  it("does not expose Billing in the shared desktop/mobile menu", () => {
    const { container } = render(<AppSidebar />);
    expect(container.querySelector('a[href="/billing"]')).toBeNull();
    expect(screen.queryByText("Billing")).toBeNull();
    expect(container.querySelector('a[href="/settings"]')).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(container.querySelector('a[href="/billing"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Open navigation" }).getAttribute("aria-expanded")).toBe("true");
  });
  it("cannot find Billing via student command search", () => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "billing" } });
    expect(screen.queryByRole("button", { name: /Billing/i })).toBeNull();
    expect(screen.queryByText("Billing")).toBeNull();
  });
  it("keeps the admin finance navigation", () => {
    m.path = "/admin/dashboard"; m.role = "ADMIN";
    const { container } = render(<AppSidebar />);
    expect(container.querySelector('a[href="/admin/finance"]')).not.toBeNull();
  });
  it("keeps admin finance in command search", () => {
    m.path = "/admin/dashboard"; m.role = "ADMIN";
    HTMLElement.prototype.scrollIntoView = vi.fn();
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "moliya" } });
    expect(screen.getByRole("button", { name: /Moliya/i })).toBeTruthy();
  });
});
