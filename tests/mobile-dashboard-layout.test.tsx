import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardPreferences } from "@/components/dashboard/dashboard-preferences";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { HubNav } from "@/components/ui/hub-nav";
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }));
afterEach(() => { cleanup(); localStorage.clear(); document.body.className = ""; document.documentElement.className = ""; });
describe("compact mobile dashboard", () => {
  it("portals comfort settings out of transformed dashboard ancestors", () => {
    const { container } = render(<div style={{ transform: "translateY(0)", position: "relative", zIndex: 10 }}><DashboardPreferences /></div>);
    fireEvent.click(screen.getByTitle("Comfort settings"));
    const dialog = screen.getByRole("dialog", { name: "Comfort settings" });
    expect(container.contains(dialog)).toBe(false);
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog.className).toContain("z-[101]");
    expect(dialog.style.maxHeight).toContain("100dvh");
    expect(screen.getByRole("link", { name: /all settings/ }).getAttribute("href")).toBe("/settings");
  });
  it("keeps settings interactive and persisted, and closes by its named close button", async () => {
    render(<DashboardPreferences />);
    fireEvent.click(screen.getByTitle("Comfort settings"));
    const focus = screen.getByRole("button", { name: "Focus mode" });
    fireEvent.click(focus);
    expect(focus.getAttribute("aria-pressed")).toBe("true");
    expect(localStorage.getItem("averna_focus_mode")).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    expect(document.documentElement.classList.contains("text-scale-lg")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close comfort settings" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("closes on Escape and restores focus to Customize", async () => {
    render(<DashboardPreferences />);
    const trigger = screen.getByTitle("Comfort settings"); trigger.focus(); fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
  it.each(["STUDENT", "TEACHER", "ADMIN"] as const)("keeps all five %s destinations in equal-width columns", (role) => {
    render(<MobileNav role={role} />);
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("navigation").firstElementChild?.className).toContain("grid-cols-5");
  });
  it.each(["progress", "rankings"] as const)("keeps every %s section in a wrapping phone grid", (hub) => {
    render(<HubNav hub={hub} label="Sections" />);
    const firstLink = screen.getAllByRole("link")[0];
    expect(firstLink.parentElement?.className).toContain(hub === "progress" ? "grid-cols-2" : "grid-cols-3");
  });
});
