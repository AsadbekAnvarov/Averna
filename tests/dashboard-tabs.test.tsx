/**
 * Student dashboard tabs in the URL (lib/dashboard/tabs.ts) and the tab bar
 * (components/dashboard/dashboard-tabs.tsx): `?tab=` selects the tab, every tab
 * is a real link, clicks push the tab's URL, focus mode leaves Play.
 */
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DASHBOARD_TAB_KEYS,
  DEFAULT_DASHBOARD_TAB,
  dashboardTabHref,
  parseDashboardTab,
} from "@/lib/dashboard/tabs";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";

// ---------------------------------------------------------------------------------------------
// Next.js plumbing
// ---------------------------------------------------------------------------------------------

const nav = vi.hoisted(() => ({ search: "" }));
const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => router,
  usePathname: () => "/dashboard",
}));

// next/link needs the Next.js router at runtime; a plain anchor (minus Link-only props) is enough.
vi.mock("next/link", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children?: ReactNode;
    scroll?: boolean;
    prefetch?: boolean;
  };
  return {
    default: function Link({ href, children, scroll: _scroll, prefetch: _prefetch, ...rest }: LinkProps) {
      return React.createElement("a", { href, ...rest }, children);
    },
  };
});

const LABELS = { home: "Today", learn: "Learn", progress: "Progress", class: "Class", fun: "Play" } as const;

function renderTabs(search = "") {
  nav.search = search;
  const utils = render(
    <DashboardTabs>
      <p data-testid="panel">panel content</p>
    </DashboardTabs>
  );
  const links = Array.from(utils.container.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Dashboard sections"] a'));
  const link = (label: string) => links.find((a) => a.textContent?.trim() === label)!;
  return { ...utils, links, link };
}

beforeEach(() => {
  for (const fn of Object.values(router)) fn.mockClear();
});

afterEach(() => {
  cleanup();
  document.body.className = "";
  nav.search = "";
});

// ---------------------------------------------------------------------------------------------
// lib/dashboard/tabs.ts (pure)
// ---------------------------------------------------------------------------------------------

describe("parseDashboardTab / dashboardTabHref", () => {
  it("always returns a known tab key, whatever the param", () => {
    const param = fc.oneof(fc.string(), fc.array(fc.string()), fc.constant(undefined), fc.constant(null));
    fc.assert(
      fc.property(param, (v) => {
        expect(DASHBOARD_TAB_KEYS).toContain(parseDashboardTab(v));
      })
    );
  });

  it("round-trips every tab through its canonical URL", () => {
    fc.assert(
      fc.property(fc.constantFrom(...DASHBOARD_TAB_KEYS), (k) => {
        const tab = new URL(dashboardTabHref(k), "http://x").searchParams.get("tab");
        expect(parseDashboardTab(tab)).toBe(k);
      })
    );
  });

  it("ignores case and surrounding whitespace", () => {
    const ws = fc.string({ unit: fc.constantFrom(" ", "\t", "\n"), maxLength: 3 });
    const variant = fc
      .tuple(fc.constantFrom(...DASHBOARD_TAB_KEYS), fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }), ws, ws)
      .map(([k, upper, before, after]) => ({
        k,
        raw: before + [...k].map((c, i) => (upper[i] ? c.toUpperCase() : c)).join("") + after,
      }));
    fc.assert(
      fc.property(variant, ({ k, raw }) => {
        expect(parseDashboardTab(raw)).toBe(k);
        expect(parseDashboardTab([raw, "home"])).toBe(k);
      })
    );
    expect(parseDashboardTab(" Learn ")).toBe("learn");
  });

  it("falls back to Today, whose URL is plain /dashboard", () => {
    expect(DEFAULT_DASHBOARD_TAB).toBe("home");
    expect(parseDashboardTab(undefined)).toBe("home");
    expect(parseDashboardTab("nope")).toBe("home");
    expect(dashboardTabHref("home")).toBe("/dashboard");
    expect(dashboardTabHref("fun")).toBe("/dashboard?tab=fun");
  });
});

// ---------------------------------------------------------------------------------------------
// components/dashboard/dashboard-tabs.tsx
// ---------------------------------------------------------------------------------------------

describe("DashboardTabs", () => {
  it("renders the five tabs as links inside the labelled nav", () => {
    const { links } = renderTabs();
    expect(links).toHaveLength(5);
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/dashboard",
      "/dashboard?tab=learn",
      "/dashboard?tab=progress",
      "/dashboard?tab=class",
      "/dashboard?tab=fun",
    ]);
    expect(links.map((a) => a.textContent?.trim())).toEqual(["Today", "Learn", "Progress", "Class", "Play"]);
    expect(links[4].hasAttribute("data-gamified")).toBe(true);
  });

  it.each([
    ["tab=progress", "Progress"],
    ["tab=class", "Class"],
    ["tab=fun", "Play"],
    ["", "Today"],
    ["tab=unknown", "Today"],
  ])("marks the tab from ?%s as the current page", (search, label) => {
    const { links } = renderTabs(search);
    const current = links.filter((a) => a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.textContent?.trim())).toEqual([label]);
  });

  it("pushes the tab's URL without scrolling when a tab is clicked", () => {
    const { link } = renderTabs();
    fireEvent.click(link("Progress"));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/dashboard?tab=progress", { scroll: false });
  });

  it("leaves ctrl-click to the browser (open in a new tab)", () => {
    // Stops jsdom from attempting the real navigation after the handler has run.
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener("click", stop);
    try {
      const { link } = renderTabs();
      fireEvent.click(link("Progress"), { ctrlKey: true });
      expect(router.push).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("click", stop);
    }
  });

  it("leaves the Play tab for Today in focus mode", () => {
    document.body.classList.add("focus-mode");
    renderTabs("tab=fun");
    expect(router.replace).toHaveBeenCalledWith("/dashboard", { scroll: false });
  });

  it("jumps to a tab on the averna-goto-tab event", () => {
    renderTabs();
    act(() => {
      window.dispatchEvent(new CustomEvent("averna-goto-tab", { detail: "class" }));
    });
    expect(router.push).toHaveBeenCalledWith("/dashboard?tab=class", { scroll: false });
  });

  it.each(DASHBOARD_TAB_KEYS.map((k) => [k]))("renders the children in a section labelled by the active tab (%s)", (k) => {
    const { container } = renderTabs(k === "home" ? "" : `tab=${k}`);
    const section = container.querySelector(`section[aria-label="${LABELS[k]}"]`);
    expect(section).not.toBeNull();
    expect(section?.querySelector('[data-testid="panel"]')?.textContent).toBe("panel content");
  });
});
