/**
 * Property 2: Preservation — tests for .kiro/specs/mobile-ui-exam-light-theme-fix (task 3).
 *
 * Observation first: everything below was recorded on the UNFIXED code (commit 7bfd1c6) and
 * passes there. The fix (tasks 4–5) must keep it passing unchanged (task 6.3). Scope: inputs where
 * isBugCondition(X) is false — the theme mechanism, the dark (and non-exam light) token values,
 * the desktop exam controls and exam logic, and the Uzbek admin texts.
 * The computed-style side (dark theme on every screen, light non-exam pages, desktop layout,
 * phone navigation, 16 px fields) is e2e/preservation-checks.mjs (CI, base commit vs HEAD).
 *
 * Kept independent of what the fix changes on purpose: no class names of the exam header,
 * panes or navigator (they get new mobile classes), no `.exam-shell` selector in the token block,
 * no theme-color meta (the fix starts writing it), only the tokens that exist today.
 *
 *   3.4  ThemeProvider / THEME_SCRIPT: localStorage `averna_theme`, <html> classes, dark default.
 *   3.1–3.3  tests/fixtures/theme-tokens.baseline.json: every token keeps its dark value under
 *        :root and its light value under html.light; keepWhiteInk keeps white ink.
 *   3.5  ExamShell: the `hidden sm:flex` text-size group (Smaller / Larger, FONT_STEPS, limits).
 *   3.6  ExamShell: navigator jumps (numbers, previous / next, parts), answered / flagged labels,
 *        ReviewDialog counts, chips, Escape and submit.
 *   3.9  ExamShell: no exit link without exitHref (mock), the given href in practice.
 *   3.14 Command palette and sidebar texts of the admin portal (Uzbek, Latin script).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { act, fireEvent, render } from "@testing-library/react";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExamShell, FONT_STEPS, type ExamPartNav } from "@/components/exam/exam-shell";
import { ThemeProvider, useTheme, type ThemeMode } from "@/components/theme/theme-provider";
import { THEME_SCRIPT } from "@/components/theme/theme-script";
import { CommandPalette } from "@/components/command-palette";
import { AppSidebar } from "@/components/layout/app-sidebar";

// ---------------------------------------------------------------------------------------------
// Next.js / NextAuth plumbing (same next/link stand-in as tests/bug-condition.test.tsx)
// ---------------------------------------------------------------------------------------------

const nav = vi.hoisted(() => ({ pathname: "/dashboard" }));
const auth = vi.hoisted(() => ({ role: null as string | null }));

vi.mock("next/link", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode };
  return {
    default: function Link({ href, children, ...rest }: LinkProps) {
      return React.createElement("a", { href, ...rest }, children);
    },
  };
});

vi.mock("next/navigation", () => {
  const router = { push: () => {}, replace: () => {}, refresh: () => {}, back: () => {}, forward: () => {}, prefetch: () => {} };
  return { usePathname: () => nav.pathname, useRouter: () => router };
});

vi.mock("next-auth/react", () => ({
  useSession: () =>
    auth.role
      ? { status: "authenticated", data: { user: { name: "Demo User", email: "demo@averna.com", image: null, role: auth.role } } }
      : { status: "unauthenticated", data: null },
  signOut: () => Promise.resolve(),
}));

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

// A string, not `new URL(…)`: under jsdom the global URL is jsdom's, which fileURLToPath rejects.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const text = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------------------------
// 3.4 — theme mechanism
// ---------------------------------------------------------------------------------------------

/** The document as app/layout.tsx serves it: <html class="dark"> and a theme-color meta. */
function resetDocument() {
  document.documentElement.className = "dark";
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = "#04070d";
  document.head.appendChild(meta);
  localStorage.clear();
}

const htmlClasses = () => Array.from(document.documentElement.classList).filter((c) => c === "dark" || c === "light");

function renderTheme() {
  const api: { current: ReturnType<typeof useTheme> | null } = { current: null };
  function Probe() {
    api.current = useTheme();
    return null;
  }
  const utils = render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>
  );
  return { ...utils, api };
}

type ThemeOp = "dark" | "light" | "toggle";

describe("3.4: the theme is stored in localStorage and applied to <html>", () => {
  beforeEach(resetDocument);
  afterEach(() => vi.restoreAllMocks());

  it("without a saved value the dark theme is used (and nothing is written)", () => {
    const { api, unmount } = renderTheme();
    try {
      expect(api.current!.mode).toBe("dark");
      expect(htmlClasses()).toEqual(["dark"]);
      expect(localStorage.getItem("averna_theme")).toBeNull();
    } finally {
      unmount();
    }
  });

  it("PBT: after any sequence of theme changes <html> and averna_theme follow the last choice", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ThemeMode | null>(null, "dark", "light"),
        fc.array(fc.constantFrom<ThemeOp>("dark", "light", "toggle"), { minLength: 1, maxLength: 10 }),
        (saved, ops) => {
          resetDocument();
          if (saved) localStorage.setItem("averna_theme", saved);
          const { api, unmount } = renderTheme();
          try {
            let expected: ThemeMode = saved ?? "dark";
            expect(api.current!.mode, "mode after mount").toBe(expected);
            expect(htmlClasses(), "<html> after mount").toEqual([expected]);
            for (const op of ops) {
              if (op === "toggle") {
                act(() => api.current!.toggleMode());
                expected = expected === "dark" ? "light" : "dark";
              } else {
                act(() => api.current!.setMode(op));
                expected = op;
              }
            }
            const label = `saved=${saved} ops=${ops.join(",")}`;
            expect(api.current!.mode, label).toBe(expected);
            expect(htmlClasses(), label).toEqual([expected]);
            expect(localStorage.getItem("averna_theme"), label).toBe(expected);
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 60 }
    );
  });

  it("PBT: THEME_SCRIPT applies a saved light theme before paint and leaves dark otherwise", () => {
    fc.assert(
      fc.property(fc.constantFrom<string | null>(null, "dark", "light", "", "LIGHT", "sepia"), (saved) => {
        resetDocument();
        if (saved !== null) localStorage.setItem("averna_theme", saved);
        new Function(THEME_SCRIPT)();
        expect(htmlClasses(), `averna_theme=${JSON.stringify(saved)}`).toEqual([saved === "light" ? "light" : "dark"]);
      })
    );
  });

  it("THEME_SCRIPT never throws when storage is unavailable (keeps the dark theme)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => new Function(THEME_SCRIPT)()).not.toThrow();
    expect(htmlClasses()).toEqual(["dark"]);
  });
});

// ---------------------------------------------------------------------------------------------
// 3.1–3.3 — theme tokens (baseline recorded on the unfixed code)
// ---------------------------------------------------------------------------------------------

type Token = [name: string, dark: string, light: string];
const BASELINE = JSON.parse(read("tests/fixtures/theme-tokens.baseline.json")) as { tokens: Token[]; keepWhiteInk: string[] };
const CURRENT = JSON.parse(read("lib/theme-tokens.json")) as { tokens: Token[]; keepWhiteInk: string[] };

const rgbTriplet = (hex: string) =>
  hex
    .replace("#", "")
    .match(/../g)!
    .map((x) => parseInt(x, 16))
    .join(" ");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The generated THEME TOKENS block of app/globals.css as rules (comments stripped). */
function tokenRules() {
  const css = read("app/globals.css");
  const begin = css.indexOf("/* ==== THEME TOKENS");
  const end = css.indexOf("/* ==== END THEME TOKENS ==== */");
  if (begin < 0 || end < begin) return [];
  const block = css.slice(begin, end).replace(/\/\*[\s\S]*?\*\//g, "");
  return Array.from(block.matchAll(/([^{}]+)\{([^{}]*)\}/g)).map((m) => ({
    selectors: m[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    body: m[2],
  }));
}

const declared = (body: string, name: string) => new RegExp(`--c-${escapeRe(name)}:\\s*([^;]+);`).exec(body)?.[1].trim();

describe("3.1–3.3: every existing theme token keeps its dark and light value", () => {
  const rules = tokenRules();
  // The dark rule may list more selectors (today `:root, html.light .exam-shell`, after the fix `:root`).
  const darkRule = rules.find((r) => r.selectors.includes(":root"));
  const lightRule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === "html.light");

  it("the baseline fixture matches the token format and the THEME TOKENS block is present", () => {
    expect(rules.length, "rules between the THEME TOKENS markers of app/globals.css").toBeGreaterThan(0);
    expect(BASELINE.tokens.length).toBeGreaterThan(50);
    for (const t of BASELINE.tokens) expect(t).toEqual([expect.any(String), expect.stringMatching(/^#[0-9a-f]{6}$/i), expect.stringMatching(/^#[0-9a-f]{6}$/i)]);
    expect(darkRule, "rule with :root in the THEME TOKENS block").toBeDefined();
    expect(lightRule, "html.light rule in the THEME TOKENS block").toBeDefined();
  });

  it("PBT: lib/theme-tokens.json still has every baseline token with the same values", () => {
    fc.assert(
      fc.property(fc.constantFrom(...BASELINE.tokens), ([name, dark, light]) => {
        const now = CURRENT.tokens.find(([n]) => n === name);
        expect(now, `token "${name}" in lib/theme-tokens.json`).toBeDefined();
        expect(now, `token "${name}"`).toEqual([name, dark, light]);
      }),
      { numRuns: 200 }
    );
  });

  it("PBT: globals.css declares the dark value under :root and the light value under html.light", () => {
    fc.assert(
      fc.property(fc.constantFrom(...BASELINE.tokens), ([name, dark, light]) => {
        expect(declared(darkRule!.body, name), `--c-${name} under :root`).toBe(rgbTriplet(dark));
        expect(declared(lightRule!.body, name), `--c-${name} under html.light`).toBe(rgbTriplet(light));
      }),
      { numRuns: 200 }
    );
  });

  it("PBT: solid fills in keepWhiteInk keep white ink in the light theme", () => {
    const ink = rules.filter((r) => declared(r.body, "white") === "255 255 255" && r.selectors.every((s) => s.startsWith("html.light .")));
    const selectors = new Set(ink.flatMap((r) => r.selectors));
    fc.assert(
      fc.property(fc.constantFrom(...BASELINE.keepWhiteInk), (cls) => {
        expect(CURRENT.keepWhiteInk, "keepWhiteInk in lib/theme-tokens.json").toContain(cls);
        expect(selectors.has(`html.light .${cls.replace(/\//g, "\\/")}`), `html.light .${cls} keeps --c-white: 255 255 255`).toBe(true);
      })
    );
  });
});

// ---------------------------------------------------------------------------------------------
// 3.5, 3.6, 3.9 — ExamShell (RTL + PBT)
// ---------------------------------------------------------------------------------------------

interface ShellInput {
  mode: "practice" | "mock";
  hasExit: boolean;
  font: number;
  sizes: number[];
  activePart: number;
  answered: boolean[];
  flagged: boolean[];
  current: number | null;
  withLeft: boolean;
  pick: number;
}

/** Parts of 1–6 questions (1–3 parts, numbered from 1), answered / flagged subsets, a current question. */
const shellInput: fc.Arbitrary<ShellInput> = fc
  .array(fc.integer({ min: 1, max: 6 }), { minLength: 1, maxLength: 3 })
  .chain((sizes) => {
    const total = sizes.reduce((a, b) => a + b, 0);
    return fc.record({
      mode: fc.constantFrom<"practice" | "mock">("practice", "mock"),
      hasExit: fc.boolean(),
      font: fc.constantFrom(...FONT_STEPS),
      sizes: fc.constant(sizes),
      activePart: fc.integer({ min: 0, max: sizes.length - 1 }),
      answered: fc.array(fc.boolean(), { minLength: total, maxLength: total }),
      flagged: fc.array(fc.boolean(), { minLength: total, maxLength: total }),
      current: fc.option(fc.integer({ min: 1, max: total }), { nil: null }),
      withLeft: fc.boolean(),
      pick: fc.nat(),
    });
  });

const RUNS = { numRuns: 30 };

function buildParts(sizes: number[]): ExamPartNav[] {
  let n = 0;
  return sizes.map((size, i) => ({ title: `Part ${i + 1}`, numbers: Array.from({ length: size }, () => ++n) }));
}

function renderShell(input: ShellInput) {
  const parts = buildParts(input.sizes);
  const all = parts.flatMap((p) => p.numbers);
  const answered = new Set(all.filter((_, i) => input.answered[i]));
  const flagged = new Set(all.filter((_, i) => input.flagged[i]));
  // Runners pass exitHref only in practice; the mock exam never does (3.9).
  const exitHref = input.mode === "practice" && input.hasExit ? "/learning/reading" : undefined;
  const spies = {
    onJump: vi.fn<(n: number) => void>(),
    onPartChange: vi.fn<(i: number) => void>(),
    onFontScale: vi.fn<(v: number) => void>(),
    onSubmit: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  };
  const utils = render(
    <ExamShell
      title="Reading practice test"
      remainingMs={30 * 60_000}
      parts={parts}
      activePart={input.activePart}
      onPartChange={spies.onPartChange}
      answered={answered}
      flagged={flagged}
      current={input.current}
      onJump={spies.onJump}
      fontScale={input.font}
      onFontScale={spies.onFontScale}
      left={input.withLeft ? <p>Passage text</p> : undefined}
      onSubmit={spies.onSubmit}
      exitHref={exitHref}
    >
      <p>Questions</p>
    </ExamShell>
  );
  const root = utils.container.querySelector<HTMLElement>(".exam-shell")!;
  return {
    ...utils,
    root,
    parts,
    all,
    answered,
    flagged,
    exitHref,
    spies,
    header: root.querySelector("header")!,
    navigator: root.querySelector<HTMLElement>('nav[aria-label="Question navigator"]')!,
  };
}

type Shell = ReturnType<typeof renderShell>;

function withShell(input: ShellInput, check: (s: Shell) => void) {
  const s = renderShell(input);
  try {
    check(s);
  } finally {
    s.unmount();
  }
}

async function withShellAsync(input: ShellInput, check: (s: Shell) => Promise<void>) {
  const s = renderShell(input);
  try {
    await check(s);
  } finally {
    s.unmount();
  }
}

const classList = (el: Element | null) => (el?.getAttribute("class") ?? "").split(/\s+/);
const reviewDialog = (root: HTMLElement) => root.querySelector<HTMLElement>('[role="dialog"][aria-labelledby="review-title"]');

function openReview(s: Shell) {
  const finish = Array.from(s.header.querySelectorAll("button")).find((b) => text(b) === "Finish Test");
  expect(finish, '"Finish Test" in the exam header').toBeDefined();
  fireEvent.click(finish!);
  const dialog = reviewDialog(s.root);
  expect(dialog, "ReviewDialog after Finish Test").not.toBeNull();
  return dialog!;
}

/** Chip numbers of a ReviewDialog section ("Unanswered" / "Flagged for review"), or null when absent. */
function chips(dialog: HTMLElement, heading: string): number[] | null {
  const title = Array.from(dialog.querySelectorAll("p")).find((p) => text(p) === heading);
  if (!title) return null;
  return Array.from(title.nextElementSibling?.querySelectorAll("button") ?? []).map((b) => Number(text(b)));
}

describe("3.9 (PBT): the exit link exists only when exitHref is given — never in the mock exam", () => {
  it("mock: no link; practice: the given href", () => {
    fc.assert(
      fc.property(shellInput, (input) =>
        withShell(input, ({ root, exitHref }) => {
          const exit = root.querySelector('a[aria-label="Leave the test"]');
          if (exitHref) {
            expect(exit, "exit link in practice with exitHref").not.toBeNull();
            expect(exit!.getAttribute("href")).toBe(exitHref);
          } else {
            expect(exit, `exit link without exitHref (${input.mode})`).toBeNull();
          }
        })
      ),
      RUNS
    );
  });
});

describe("3.5 (PBT): the header text-size control on sm+ screens", () => {
  it("the `hidden sm:flex` group steps through FONT_STEPS and stops at both ends", () => {
    fc.assert(
      fc.property(shellInput, (input) =>
        withShell(input, ({ header, root, spies }) => {
          const group = header.querySelector('[role="group"][aria-label="Text size"]');
          expect(group, 'header [role=group][aria-label="Text size"]').not.toBeNull();
          expect(classList(group)).toEqual(expect.arrayContaining(["hidden", "sm:flex"]));
          const smaller = group!.querySelector<HTMLButtonElement>('button[aria-label="Smaller text"]');
          const larger = group!.querySelector<HTMLButtonElement>('button[aria-label="Larger text"]');
          expect(smaller, "Smaller text").not.toBeNull();
          expect(larger, "Larger text").not.toBeNull();

          const i = FONT_STEPS.indexOf(input.font);
          expect(smaller!.disabled, `Smaller disabled at step ${i}`).toBe(i === 0);
          expect(larger!.disabled, `Larger disabled at step ${i}`).toBe(i === FONT_STEPS.length - 1);
          fireEvent.click(smaller!);
          fireEvent.click(larger!);
          const expected = [...(i > 0 ? [FONT_STEPS[i - 1]] : []), ...(i < FONT_STEPS.length - 1 ? [FONT_STEPS[i + 1]] : [])];
          expect(spies.onFontScale.mock.calls.map(([v]) => v)).toEqual(expected);

          // The scale applies to the exam body.
          const body = root.querySelector<HTMLElement>(':scope > div[style*="font-size"]');
          expect(body?.style.fontSize, "exam body font-size").toBe(`${input.font}rem`);
        })
      ),
      RUNS
    );
  });
});

describe("3.6 (PBT): navigator and review dialog logic", () => {
  it("question numbers show answered / flagged and jump to their question", () => {
    fc.assert(
      fc.property(shellInput, (input) =>
        withShell(input, ({ navigator, root, parts, answered, flagged, spies }) => {
          const active = parts[input.activePart];
          const buttons = Array.from(navigator.querySelectorAll<HTMLButtonElement>('button[aria-label^="Question "]'));
          expect(buttons.map((b) => Number(text(b)))).toEqual(active.numbers);
          for (const b of buttons) {
            const n = Number(text(b));
            const label = `Question ${n}${answered.has(n) ? ", answered" : ", not answered"}${flagged.has(n) ? ", flagged" : ""}`;
            expect(b.getAttribute("aria-label")).toBe(label);
            expect(b.getAttribute("aria-current"), `aria-current of question ${n}`).toBe(n === input.current ? "true" : null);
          }
          const target = buttons[input.pick % buttons.length];
          fireEvent.click(target);
          expect(spies.onJump).toHaveBeenLastCalledWith(Number(text(target)));
          if (input.withLeft) {
            // A jump shows the questions pane on phones and tablets.
            const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
            expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "true"]);
          }
        })
      ),
      RUNS
    );
  });

  it("previous / next step through all questions (clamped) and part buttons switch parts", () => {
    fc.assert(
      fc.property(shellInput, (input) =>
        withShell(input, ({ navigator, all, parts, spies }) => {
          const idx = input.current != null ? all.indexOf(input.current) : -1;
          const prev = idx < 0 ? all[0] : all[Math.max(0, idx - 1)];
          const next = idx < 0 ? all[0] : all[Math.min(all.length - 1, idx + 1)];
          fireEvent.click(navigator.querySelector('button[aria-label="Previous question"]')!);
          expect(spies.onJump).toHaveBeenLastCalledWith(prev);
          fireEvent.click(navigator.querySelector('button[aria-label="Next question"]')!);
          expect(spies.onJump).toHaveBeenLastCalledWith(next);

          const partButtons = Array.from(navigator.querySelectorAll("button")).filter((b) => /^Part \d+/.test(text(b)));
          expect(partButtons.map((b) => text(b))).toEqual(
            // "Part 1" + "<answered>/<total>" (two adjacent text runs).
            parts.map((p) => `${p.title}${p.numbers.filter((n) => input.answered[n - 1]).length}/${p.numbers.length}`)
          );
          const target = input.pick % parts.length;
          expect(partButtons[input.activePart].getAttribute("aria-current")).toBe("true");
          fireEvent.click(partButtons[target]);
          expect(spies.onPartChange).toHaveBeenLastCalledWith(target);
        })
      ),
      RUNS
    );
  });

  it("ReviewDialog counts answers, lists unanswered and flagged questions, jumps, closes and submits", async () => {
    await fc.assert(
      fc.asyncProperty(shellInput, (input) =>
        withShellAsync(input, async (s) => {
          const { root, all, answered, flagged, spies } = s;
          let dialog = openReview(s);
          expect(text(dialog)).toContain(`You answered ${all.filter((n) => answered.has(n)).length} of ${all.length} questions.`);
          const unanswered = all.filter((n) => !answered.has(n));
          const flaggedList = all.filter((n) => flagged.has(n));
          expect(chips(dialog, "Unanswered"), "Unanswered chips").toEqual(unanswered.length ? unanswered : null);
          expect(chips(dialog, "Flagged for review"), "Flagged chips").toEqual(flaggedList.length ? flaggedList : null);

          // A chip jumps to its question and closes the dialog.
          const chip = [...unanswered, ...flaggedList][0];
          if (chip != null) {
            const btn = Array.from(dialog.querySelectorAll("button")).find((b) => text(b) === String(chip))!;
            fireEvent.click(btn);
            expect(spies.onJump).toHaveBeenLastCalledWith(chip);
            expect(reviewDialog(root), "dialog after a chip").toBeNull();
            dialog = openReview(s);
          }

          // Escape and "Keep Working" close without submitting.
          fireEvent.keyDown(window, { key: "Escape" });
          expect(reviewDialog(root), "dialog after Escape").toBeNull();
          dialog = openReview(s);
          fireEvent.click(Array.from(dialog.querySelectorAll("button")).find((b) => text(b) === "Keep Working")!);
          expect(reviewDialog(root), "dialog after Keep Working").toBeNull();
          expect(spies.onSubmit).not.toHaveBeenCalled();

          // The confirm button submits once, then the dialog closes.
          dialog = openReview(s);
          const confirm = Array.from(dialog.querySelectorAll("button")).find((b) => text(b) === "Finish Test")!;
          await act(async () => {
            fireEvent.click(confirm);
          });
          expect(spies.onSubmit).toHaveBeenCalledTimes(1);
          expect(reviewDialog(root), "dialog after submit").toBeNull();
        })
      ),
      { numRuns: 25 }
    );
  });
});

// ---------------------------------------------------------------------------------------------
// 3.14 — admin portal texts (Uzbek, Latin script), recorded on the unfixed code
// ---------------------------------------------------------------------------------------------

/** components/command-palette.tsx: ADMIN_COMMANDS + the admin quick actions, in display order. */
const ADMIN_PALETTE: [group: string, label: string][] = [
  ["Umumiy koʻrinish", "Boshqaruv paneli"],
  ["Umumiy koʻrinish", "Tahlil"],
  ["Umumiy koʻrinish", "Oʻquv DNK tahlili"],
  ["Umumiy koʻrinish", "Bildirishnomalar"],
  ["Odamlar", "Oʻqituvchilar"],
  ["Odamlar", "Guruhlar"],
  ["Oʻqitish", "Tekshiruv navbati"],
  ["Oʻqitish", "Mock natijalari"],
  ["Oʻqitish", "Kirish testi"],
  ["Kontent", "Oʻquv kontenti"],
  ["Kontent", "Test generatori"],
  ["Kontent", "Listening audio"],
  ["Kontent", "Eʼlonlar"],
  ["Kontent", "Mukofotlar va soʻrovlar"],
  ["Operatsiyalar", "Moliya"],
  ["Operatsiyalar", "Tizim holati"],
  ["Operatsiyalar", "Audit jurnali"],
  ["Operatsiyalar", "Xabarlar"],
  ["Operatsiyalar", "Telegram bot"],
  ["Operatsiyalar", "Profil va parol"],
  ["Amallar", "Yorugʻ mavzuga oʻtish"],
  ["Amallar", "Chiqish"],
];

/** components/layout/app-sidebar.tsx: ADMIN_NAV (section → [name, href]). */
// Requested staff-navigation reorganization; Uzbek labels and unchanged mobile tabs remain protected.
const ADMIN_SIDEBAR: [section: string, items: [name: string, href: string][]][] = [
  ["Umumiy koʻrinish", [["Boshqaruv paneli", "/admin/dashboard"], ["Tahlil", "/admin/analytics"], ["Bildirishnomalar", "/notifications"]]],
  ["Odamlar", [["Oʻquvchilar va qabul", "/admin/dashboard?tab=people"], ["Oʻqituvchilar", "/admin/teachers"], ["Guruhlar", "/admin/groups"]]],
  ["Markaz boshqaruvi", [["Moliya", "/admin/finance"], ["Kirish testi", "/admin/placement"], ["Mukofotlar", "/admin/rewards"], ["Eʼlonlar", "/admin/announcements"]]],
  ["Tizim va nazorat", [["Audit jurnali", "/admin/logs"], ["Tizim", "/admin/system"]]],
  ["Muloqot", [["Xabarlar", "/messages"], ["Telegram bot", "/admin/telegram"]]],
  ["Hisob", [["Profil va parol", "/admin/profile"]]],
];

/** components/dashboard/mobile-nav.tsx: the admin bottom tab bar. */
const ADMIN_TABS: [name: string, href: string][] = [
  ["Panel", "/admin/dashboard"],
  ["Guruhlar", "/admin/groups"],
  ["Moliya", "/admin/finance"],
  ["Tahlil", "/admin/analytics"],
  ["Xabarlar", "/messages"],
];

describe("3.14: the admin portal stays in Uzbek", () => {
  beforeEach(() => {
    resetDocument();
    nav.pathname = "/admin/dashboard";
    auth.role = "ADMIN";
  });
  afterEach(() => {
    nav.pathname = "/dashboard";
    auth.role = null;
  });

  it("command palette: admin commands, quick actions and chrome texts", () => {
    const { unmount } = render(<CommandPalette />);
    try {
      const fab = document.querySelector('button[aria-label="Open command palette"]');
      expect(Array.from(fab?.children ?? []).map(text).filter(Boolean)).toEqual(["Tezkor oʻtish", "⌘K"]);
      act(() => {
        window.dispatchEvent(new Event("averna-command-palette"));
      });
      const input = document.querySelector<HTMLInputElement>('input[placeholder="Sahifa va amallarni qidirish…"]');
      expect(input, "admin search field").not.toBeNull();
      const items = Array.from(document.querySelectorAll("button"))
        .filter((b) => b.getAttribute("aria-label") !== "Open command palette")
        .map((b) => [text(b.parentElement?.firstElementChild), text(b)]);
      expect(items).toEqual(ADMIN_PALETTE);
      const footer = input!.closest("div")!.parentElement!.lastElementChild;
      expect(Array.from(footer?.children ?? []).map(text)).toEqual(["harakat", "ochish", `${ADMIN_PALETTE.length} natija`]);

      fireEvent.change(input!, { target: { value: "zzz" } });
      expect(document.body.textContent).toContain("«zzz» boʻyicha natija yoʻq");
    } finally {
      unmount();
    }
  });

  it("sidebar: ADMIN_NAV sections and items, portal label, menu and tab bar labels", () => {
    const { container, unmount } = render(<AppSidebar />);
    try {
      const aside = container.querySelector('aside[aria-label="Navigatsiya"]');
      expect(aside, 'aside[aria-label="Navigatsiya"]').not.toBeNull();
      const sections = Array.from(aside!.querySelectorAll("nav > div")).map((section) => [
        text(section.firstElementChild),
        Array.from(section.querySelectorAll("a")).map((a) => [text(a), a.getAttribute("href")]),
      ]);
      expect(sections).toEqual(ADMIN_SIDEBAR);

      expect(container.querySelector('button[aria-label="Menyuni ochish"]'), "Menyuni ochish").not.toBeNull();
      expect(container.querySelector('button[aria-label="Qidirish"]'), "Qidirish").not.toBeNull();
      expect(container.querySelector('button[aria-label="Menyuni yopish"]'), "Menyuni yopish").not.toBeNull();
      expect(text(container.querySelector("header"))).toContain("Admin paneli");
      expect(text(aside)).toContain("Admin paneli");

      const tabBar = container.querySelector('nav[aria-label="Asosiy boʻlimlar"]');
      expect(tabBar, 'nav[aria-label="Asosiy boʻlimlar"]').not.toBeNull();
      expect(Array.from(tabBar!.querySelectorAll("a")).map((a) => [text(a), a.getAttribute("href")])).toEqual(ADMIN_TABS);
    } finally {
      unmount();
    }
  });
});
