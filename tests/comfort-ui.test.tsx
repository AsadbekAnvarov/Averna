/**
 * Reading comfort + native-language hints in the UI (docs/elegance-roadmap.md,
 * idea 8): Settings, <L1Hint>, "Explain in …" and the reading ruler.
 */
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionContext } from "next-auth/react";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { L1Hint } from "@/components/l1/l1-hint";
import { ExplainInL1 } from "@/components/l1/explain-in-l1";
import { primeStudentLevel } from "@/components/l1/use-l1";
import { ReadingRuler } from "@/components/comfort/reading-ruler";

type Role = "STUDENT" | "TEACHER";
function withSession(role: Role, children: ReactNode) {
  const value = { data: { user: { id: "u-1", role }, expires: "2099-01-01" }, status: "authenticated", update: async () => null } as never;
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

const html = () => document.documentElement;

beforeEach(() => {
  localStorage.clear();
  html().className = "dark";
  primeStudentLevel(null);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Settings → Reading comfort", () => {
  it("switches the readable font, line spacing, contrast and ruler on <html> and in storage", () => {
    render(<SettingsPanel />);
    expect(screen.getByRole("heading", { name: "Reading comfort" })).toBeTruthy();

    fireEvent.click(screen.getByRole("switch", { name: /Readable font/ }));
    expect(html().classList.contains("font-readable")).toBe(true);
    expect(localStorage.getItem("averna_font")).toBe("readable");

    fireEvent.click(screen.getByRole("button", { name: "Loose" }));
    expect(html().classList.contains("leading-loose-ui")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Relaxed" }));
    expect(html().classList.contains("leading-relaxed-ui")).toBe(true);
    expect(html().classList.contains("leading-loose-ui")).toBe(false);

    fireEvent.click(screen.getByRole("switch", { name: /High contrast/ }));
    expect(html().classList.contains("contrast-high")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    expect(html().classList.contains("text-scale-lg")).toBe(true);
    expect(localStorage.getItem("averna_text_scale")).toBe("lg");

    const ruler = screen.getByRole("switch", { name: /Reading ruler/ });
    expect(ruler.textContent).toContain("Alt+R");
    fireEvent.click(ruler);
    expect(localStorage.getItem("averna_ruler")).toBe("on");
    expect(ruler.getAttribute("aria-checked")).toBe("true");
  });

  it("segmented buttons are 44 px tall on phones", () => {
    render(<SettingsPanel />);
    const loose = screen.getByRole("button", { name: "Loose" });
    expect(loose.className.split(/\s+/)).toEqual(expect.arrayContaining(["min-h-11", "sm:min-h-9"]));
  });

  it("shows native-language hints to students only, suggests the profile language and never switches it on", () => {
    const { unmount } = render(<SettingsPanel />);
    expect(screen.queryByRole("heading", { name: "Native-language hints" })).toBeNull();
    unmount();

    render(<SettingsPanel student={{ level: "B2", nativeLanguage: "Uzbek" }} />);
    expect(screen.getByRole("heading", { name: "Native-language hints" })).toBeTruthy();
    expect(screen.getByText(/Your profile says Uzbek/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Off" }).getAttribute("aria-pressed")).toBe("true");
    expect(localStorage.getItem("averna_l1")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Oʻzbekcha" }));
    expect(localStorage.getItem("averna_l1")).toBe("uz");
    expect(screen.getByText(/Your level is B2, so hints are hidden/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Always" }));
    expect(localStorage.getItem("averna_l1_when")).toBe("always");
    expect(screen.getByText("Hints show on every exam screen and result.")).toBeTruthy();
    // The live sample: one real instruction and its Uzbek hint.
    expect([...document.querySelectorAll('[lang="uz"]')].some((el) => el.textContent?.includes("IKKI"))).toBe(true);
  });
});

describe("<L1Hint>", () => {
  const TEXT = "Complete the notes below.";

  it("renders nothing with hints off, for staff, or without a session", () => {
    const { container, rerender } = render(withSession("STUDENT", <L1Hint text={TEXT} />));
    expect(container.innerHTML).toBe("");
    localStorage.setItem("averna_l1", "uz");
    localStorage.setItem("averna_l1_when", "always");
    rerender(withSession("TEACHER", <L1Hint text={TEXT} />));
    expect(container.innerHTML).toBe("");
    cleanup();
    expect(render(<L1Hint text={TEXT} />).container.innerHTML).toBe("");
  });

  it("shows the hint under the English text with lang and an accessible tag", async () => {
    localStorage.setItem("averna_l1", "ru");
    localStorage.setItem("averna_l1_when", "always");
    render(withSession("STUDENT", <L1Hint text={TEXT} />));
    const note = await screen.findByRole("note", { name: "Hint in Russian" });
    expect(note.querySelector('[lang="ru"]')?.textContent).toBe("Заполните пропуски в заметках ниже.");
    expect(note.querySelector('[aria-hidden="true"]')?.textContent).toBe("RU");
  });

  it("follows the student's level with 'At my level' and renders nothing for unknown text", async () => {
    localStorage.setItem("averna_l1", "uz");
    primeStudentLevel("C1");
    const { container } = render(withSession("STUDENT", <L1Hint text={TEXT} />));
    await act(async () => {});
    expect(container.innerHTML).toBe("");
    cleanup();

    primeStudentLevel("A2");
    render(withSession("STUDENT", <><L1Hint text={TEXT} /><L1Hint text="An unknown sentence about bees." /><L1Hint kind="tfng" part="tip" /></>));
    const notes = await screen.findAllByRole("note", { name: "Hint in Uzbek" });
    expect(notes).toHaveLength(2);
    expect(notes[0].textContent).toContain("qaydlardagi");
    expect(notes[1].textContent).toContain("NOT GIVEN");
  });
});

describe("Explain in Oʻzbekcha", () => {
  it("asks the API on demand and shows the translation (or the error) inline", async () => {
    localStorage.setItem("averna_l1", "uz");
    localStorage.setItem("averna_l1_when", "always");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "You've used today's translations (40 a day)." }), { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ translation: "Javob FALSE, chunki matnda aksi aytilgan.", lang: "uz" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(withSession("STUDENT", <ExplainInL1 text="The passage says the opposite, so the answer is FALSE." />));

    const button = await screen.findByRole("button", { name: "Explain in Oʻzbekcha" });
    expect(button.className).toContain("min-h-[44px]");
    fireEvent.click(button);
    expect((await screen.findByRole("alert")).textContent).toContain("40 a day");

    fireEvent.click(screen.getByRole("button", { name: "Explain in Oʻzbekcha" }));
    const note = await screen.findByRole("note", { name: "Explanation in Uzbek" });
    expect(note.querySelector('[lang="uz"]')?.textContent).toBe("Javob FALSE, chunki matnda aksi aytilgan.");
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/l1/explain");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ text: "The passage says the opposite, so the answer is FALSE.", lang: "uz" });
  });

  it("is absent with hints off", () => {
    const { container } = render(withSession("STUDENT", <ExplainInL1 text="Some explanation." />));
    expect(container.innerHTML).toBe("");
  });
});

describe("Reading ruler", () => {
  it("Alt+R toggles an aria-hidden, click-through overlay and announces it", async () => {
    render(<ReadingRuler />);
    expect(document.querySelector("[data-reading-ruler]")).toBeNull();

    fireEvent.keyDown(window, { key: "r", code: "KeyR", altKey: true });
    await waitFor(() => expect(document.querySelector("[data-reading-ruler]")).not.toBeNull());
    const overlay = document.querySelector<HTMLElement>("[data-reading-ruler]")!;
    expect(overlay.getAttribute("aria-hidden")).toBe("true");
    expect(overlay.className).toContain("reading-ruler");
    expect(localStorage.getItem("averna_ruler")).toBe("on");
    expect(screen.getByRole("status").textContent).toBe("Reading ruler on");

    // Plain R (typing) does nothing.
    fireEvent.keyDown(window, { key: "r", code: "KeyR" });
    expect(localStorage.getItem("averna_ruler")).toBe("on");

    fireEvent.keyDown(window, { key: "®", code: "KeyR", altKey: true });
    await waitFor(() => expect(document.querySelector("[data-reading-ruler]")).toBeNull());
    expect(localStorage.getItem("averna_ruler")).toBe("off");
    expect(screen.getByRole("status").textContent).toBe("Reading ruler off");
  });

  it("follows the pointer with transforms only", async () => {
    localStorage.setItem("averna_ruler", "on");
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    render(<ReadingRuler />);
    await waitFor(() => expect(document.querySelector("[data-reading-ruler]")).not.toBeNull());
    // jsdom has no PointerEvent: a MouseEvent of that type carries clientY.
    const move = new MouseEvent("pointermove", { clientY: 300 });
    Object.defineProperty(move, "pointerType", { value: "mouse" });
    act(() => {
      window.dispatchEvent(move);
    });
    act(() => frames.splice(0).forEach((f) => f(0)));
    const band = document.querySelector<HTMLElement>(".reading-ruler__band")!;
    expect(band.style.transform).toMatch(/^translateY\(\d+(\.\d+)?px\)$/);
    expect(document.querySelector<HTMLElement>("[data-reading-ruler]")!.style.opacity).toBe("1");
    // Leaving the window hides it.
    fireEvent.mouseOut(document, { relatedTarget: null });
    act(() => frames.splice(0).forEach((f) => f(0)));
    expect(document.querySelector<HTMLElement>("[data-reading-ruler]")!.style.opacity).toBe("0");
  });
});
