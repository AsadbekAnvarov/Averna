/**
 * Compact Settings (docs/elegance-roadmap.md, idea 8): every group is a
 * disclosure (components/settings/settings-group.tsx) whose collapsed header
 * summarises the current values; only Display starts open on phones, all
 * groups on desktop; a hash opens its group; sessionStorage remembers.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { SettingsGroup, SETTINGS_GROUP_KEY } from "@/components/settings/settings-group";
import { primeStudentLevel } from "@/components/l1/use-l1";

const header = (name: string) => screen.getByRole("button", { name });
const expanded = (name: string) => header(name).getAttribute("aria-expanded");
/** The header's second line (its accessible description). */
const line = (name: string) => document.getElementById(header(name).getAttribute("aria-describedby") ?? "")?.textContent;

/** A stand-in for the page's Account group: an id inside it (#offline) opens it. */
const account = (
  <SettingsGroup id="account" icon={<span />} title="Account" summary="student@example.test" accent="text-averna-neon">
    <a id="offline" href="/offline">Offline library</a>
  </SettingsGroup>
);

function desktop(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: matches && query.includes("min-width: 1024px"), media: query, addEventListener() {}, removeEventListener() {} }));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.className = "dark";
  primeStudentLevel(null);
  history.replaceState(null, "", "/settings");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  history.replaceState(null, "", "/");
});

describe("Settings groups on a phone", () => {
  it("opens only Display; each header is a ≥ 44 px button with aria-expanded / aria-controls under a heading named by the title", () => {
    render(<SettingsPanel student={{ level: null, nativeLanguage: null }} account={account} />);
    expect(expanded("Display")).toBe("true");
    for (const name of ["Reading comfort", "Native-language hints", "Account", "Comfort & effects", "Sound"]) {
      expect(expanded(name), name).toBe("false");
      const button = header(name);
      expect(button.className.split(/\s+/)).toContain("min-h-11");
      const panel = document.getElementById(button.getAttribute("aria-controls") ?? "");
      expect(panel?.hidden, name).toBe(true);
      expect(screen.getByRole("heading", { name }).contains(button)).toBe(true);
    }
    // Collapsed rows are out of the accessibility tree until opened.
    expect(screen.queryByRole("switch", { name: /Readable font/ })).toBeNull();
    fireEvent.click(header("Reading comfort"));
    expect(expanded("Reading comfort")).toBe("true");
    expect(screen.getByRole("switch", { name: /Readable font/ })).toBeTruthy();
  });

  it("summarises the current values in a collapsed header", () => {
    localStorage.setItem("averna_text_scale", "lg");
    localStorage.setItem("averna_font", "readable");
    localStorage.setItem("averna_line_spacing", "loose");
    localStorage.setItem("averna_ruler", "on");
    localStorage.setItem("averna_seasonal", "0");
    render(<SettingsPanel student={{ level: null, nativeLanguage: null }} account={account} />);
    expect(line("Reading comfort")).toBe("Readable font · Loose spacing · Ruler on");
    expect(line("Native-language hints")).toBe("Hints off");
    expect(line("Comfort & effects")).toBe("Focus off · Seasonal off · Ambiance on");
    expect(line("Sound")).toBe("Sounds off");
    expect(line("Account")).toBe("student@example.test");

    // Open, Display shows its subtitle; closed, its values — and they follow changes.
    expect(line("Display")).toBe("How Averna looks on this device");
    fireEvent.click(screen.getByRole("button", { name: "Small" }));
    fireEvent.click(header("Display"));
    expect(line("Display")).toBe("Dark · Small text");
  });

  it("remembers open and closed groups in sessionStorage", () => {
    const { unmount } = render(<SettingsPanel />);
    fireEvent.click(header("Sound"));
    fireEvent.click(header("Display"));
    expect(sessionStorage.getItem(`${SETTINGS_GROUP_KEY}sound`)).toBe("open");
    expect(sessionStorage.getItem(`${SETTINGS_GROUP_KEY}display`)).toBe("closed");
    unmount();

    render(<SettingsPanel />);
    expect(expanded("Sound")).toBe("true");
    expect(expanded("Display")).toBe("false");
    expect(expanded("Reading comfort")).toBe("false");
  });

  it("opens the group named by the hash, or holding the hash's element, and scrolls to it", () => {
    const scrolled: string[] = [];
    const scrollIntoView = vi.fn(function (this: HTMLElement) {
      scrolled.push(this.id);
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: scrollIntoView, configurable: true, writable: true });
    try {
      sessionStorage.setItem(`${SETTINGS_GROUP_KEY}reading-comfort`, "closed");
      history.replaceState(null, "", "/settings#reading-comfort");
      render(<SettingsPanel account={account} />);
      expect(expanded("Reading comfort")).toBe("true");
      expect(expanded("Account")).toBe("false");
      expect(scrolled).toEqual(["reading-comfort"]);

      // #offline sits inside Account: a later hash change opens Account.
      act(() => {
        history.replaceState(null, "", "/settings#offline");
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });
      expect(expanded("Account")).toBe("true");
      expect(screen.getByRole("link", { name: "Offline library" })).toBeTruthy();
      expect(scrolled).toEqual(["reading-comfort", "account"]);
    } finally {
      delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });
});

describe("Settings groups on a desktop", () => {
  it("open every group by default", () => {
    desktop(true);
    render(<SettingsPanel student={{ level: null, nativeLanguage: null }} account={account} />);
    for (const name of ["Display", "Reading comfort", "Native-language hints", "Account", "Comfort & effects", "Sound"]) {
      expect(expanded(name), name).toBe("true");
    }
    expect(screen.getByRole("switch", { name: /Reading ruler/ })).toBeTruthy();
  });

  it("keeps hints out of the staff layout and puts the device groups before the account column", () => {
    desktop(true);
    const { container } = render(<SettingsPanel account={account} />);
    expect(screen.queryByRole("heading", { name: "Native-language hints" })).toBeNull();
    const ids = [...container.querySelectorAll("section[id]")].map((s) => s.id);
    expect(ids).toEqual(["display", "reading-comfort", "account", "effects", "sound"]);
    const [first, second] = [...(container.firstElementChild?.children ?? [])];
    expect(first.querySelector("#display") && first.querySelector("#reading-comfort")).toBeTruthy();
    expect(second.querySelector("#account") && second.querySelector("#sound")).toBeTruthy();
    expect(container.firstElementChild?.className).toContain("lg:grid-cols-2");
  });
});
