/**
 * Property 1: Bug Condition — exploration test for .kiro/specs/mobile-ui-exam-light-theme-fix (task 2).
 *
 * Encodes the EXPECTED behaviour of design.md ("Correctness Properties", Property 1) for inputs
 * where isBugCondition(X) = A1 ∨ A2 ∨ B1 ∨ … ∨ B11 holds. On the unfixed code these tests FAIL:
 * the failures are the proof that the defects exist. After the fix (task 6.2) the very same tests
 * must pass unchanged. Level 2 (real computed styles in Chromium) is e2e/bugfix-checks.mjs (CI).
 *
 * Counterexamples found on the unfixed code (`npm test -- tests/bug-condition.test.tsx`, 22 of 22 fail):
 *   A1  app/globals.css still has `html.light .exam-shell { … }` (e.g. `.error-surface`) and the
 *       «EXAM SCREENS keep their own colours» block.
 *   A1/A2  32 hard-coded dark fills, exactly the design's replacement list: exam-shell.tsx:298
 *       bg-[#040b09], :300/:350/:406/:409 bg-[#07130f]; speaking-exam-runner.tsx:443 from-[#0e261e]
 *       to-[#06120e], :2607/:2613/:2647/:2670; writing-exam-client.tsx:236/:241/:395/:406;
 *       reading-exam-runner.tsx:112/:263; grammar-runner.tsx:211/:245; placement-orchestrator.tsx:538;
 *       mock-orchestrator.tsx:601; question-group.tsx:151 bg-[#0b1a16] and :115 bg-black/30 on <input>;
 *       writing-exam-runner.tsx:358 bg-black/25 and placement/writing-runner.tsx:342 bg-black/30 on
 *       <textarea>; passage-pane.tsx:769, lookup-area.tsx:247, word-popover.tsx:322 bg-[#0b1a16];
 *       all four exam loading.tsx:6 bg-[#040b09]. (writing-exam-runner.tsx:278 bg-[#f4f7f5] and the
 *       bg-black/70 modal backdrops are correctly not reported.)
 *   A1  passage-pane.tsx <mark> keeps `text-amber-50`.
 *   A1/A2 PBT  ["exam-bg"], ["#ffffff"] (exam-mark), ["white","exam-bg"]: the exam-* / surface-*
 *       tokens do not exist in lib/theme-tokens.json.
 *   B1  {split: 28, withLeft: true}: the pane has inline `flex-basis: 28.000000000000004%` (the
 *       real divider drag set it), which overrides `w-full` below lg; the body has no --exam-left.
 *   B2  {mode: "practice", hasExit: true}: the exit link has class `hidden` (sm:inline-flex only);
 *       no `button[aria-label="Text size"]` (only the `hidden sm:flex` group). Mock: no link (holds).
 *   B3  Previous/Next are `h-10 w-10` (40 px), question numbers `h-8` (32 px).
 *   B4  the exam header / navigator have no env(safe-area-inset-*); app/layout.tsx has no
 *       `viewportFit: "cover"` and a static `themeColor: "#04070d"`.
 *   B9  THEME_COLORS is not exported; THEME_SCRIPT with averna_theme=light leaves theme-color at
 *       #04070d; ThemeProvider PBT counterexample [["light"]]: theme-color stays #04070d.
 *   B6  none of the six modal sources has av-modal-panel, no `.av-modal-panel` rule in globals.css,
 *       the rendered ReviewDialog panel is `av-panel w-full max-w-lg …` only.
 *   B8  ui/toast.tsx and live-notifications.tsx: `fixed top-4 right-4 …` (no safe-area, no lg:top-4).
 *   B10 globals.css has no `@supports not (overflow-x: clip)` fallback.
 * B5, B7, B11 and the computed-style side of A1/A2/B1–B4/B6 are covered by e2e/bugfix-checks.mjs.
 * Real safe-area insets (B4) and iOS < 16 (B10) can't be emulated: manual device check (task 8).
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { act, fireEvent, render } from "@testing-library/react";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { ExamShell } from "@/components/exam/exam-shell";
import { ThemeProvider, useTheme, type ThemeMode } from "@/components/theme/theme-provider";
import * as themeScript from "@/components/theme/theme-script";

// next/link needs the Next.js router at runtime; a plain anchor is enough to inspect the markup.
vi.mock("next/link", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode };
  return {
    default: function Link({ href, children, ...rest }: LinkProps) {
      return React.createElement("a", { href, ...rest }, children);
    },
  };
});

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

// A string, not `new URL(…)`: under jsdom the global URL is jsdom's, which fileURLToPath rejects.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const lineOf = (src: string, index: number) => src.slice(0, index).split("\n").length;

function walk(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = `${dir}/${d.name}`;
    if (d.isDirectory()) return walk(rel);
    return /\.(tsx?|jsx?)$/.test(d.name) ? [rel] : [];
  });
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG 2.x relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = hexRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const css = read("app/globals.css");

// ---------------------------------------------------------------------------------------------
// A1 / A2 — light theme on exam and dictionary surfaces (static)
// ---------------------------------------------------------------------------------------------

/** ExamSurfaces ∪ DictionarySurfaces sources (design, Glossary). */
const EXAM_SOURCES = [
  ...walk("components/exam"),
  ...walk("components/placement"),
  ...walk("components/dictionary"),
  "app/learning/reading/[testId]/loading.tsx",
  "app/learning/listening/[testId]/loading.tsx",
  "app/learning/writing/exam/loading.tsx",
  "app/learning/speaking-test/[setId]/loading.tsx",
];

/** Hard-coded dark fills that ignore the theme: bg-[#0…], from-[#0…], to-[#0…]. */
const HARD_DARK = /\b(?:bg|from|to)-\[#0[0-9a-fA-F]{2,7}\]/g;
const FIELD_TAGS = new Set(["input", "textarea", "select", "Input", "Textarea"]);

/** `bg-black/…` on a form field (the nearest JSX tag opened before the class is a field). */
function blackFieldFills(src: string): { index: number; cls: string; tag: string }[] {
  const out: { index: number; cls: string; tag: string }[] = [];
  for (const m of src.matchAll(/\bbg-black\/[\w.[\]]+/g)) {
    const index = m.index ?? 0;
    const tags = Array.from(src.slice(0, index).matchAll(/<([A-Za-z][\w.]*)\s/g));
    const tag = tags.at(-1)?.[1] ?? "";
    if (FIELD_TAGS.has(tag)) out.push({ index, cls: m[0], tag });
  }
  return out;
}

describe("A1/A2 (static): exam and dictionary surfaces follow the light theme", () => {
  it("globals.css no longer forces the dark palette on .exam-shell under html.light", () => {
    expect(css, "selector `html.light .exam-shell` in app/globals.css").not.toMatch(/html\.light\s+\.exam-shell/);
    expect(css, "block «EXAM SCREENS keep their own colours» in app/globals.css").not.toContain(
      "EXAM SCREENS keep their own colours"
    );
  });

  it("exam, placement, dictionary sources and the exam loading screens have no hard-coded dark fills", () => {
    const found: string[] = [];
    for (const file of EXAM_SOURCES) {
      const src = read(file);
      for (const m of src.matchAll(HARD_DARK)) found.push(`${file}:${lineOf(src, m.index ?? 0)} ${m[0]}`);
      for (const f of blackFieldFills(src)) found.push(`${file}:${lineOf(src, f.index)} ${f.cls} on <${f.tag}>`);
    }
    expect(found).toEqual([]);
  });

  it("the passage highlight <mark> has no text-amber-50 (untokenised, stays #fffbeb in light)", () => {
    const src = read("components/exam/passage-pane.tsx");
    const marks = Array.from(src.matchAll(/<mark\s[^>]*?className="([^"]*)"/g)).map((m) => m[1]);
    expect(marks.length, "<mark> elements in passage-pane.tsx").toBeGreaterThan(0);
    for (const cls of marks) expect(cls.split(/\s+/)).not.toContain("text-amber-50");
  });
});

// ---------------------------------------------------------------------------------------------
// A1 / A2 — light values of the exam-* / surface-* tokens (PBT)
// ---------------------------------------------------------------------------------------------

type Token = [name: string, dark: string, light: string];
const TOKENS = (JSON.parse(read("lib/theme-tokens.json")) as { tokens: Token[] }).tokens;
const lightOf = (name: string) => TOKENS.find(([n]) => n === name)?.[2];

/** Background tokens from the design table (everything but exam-mark). */
const EXAM_BG_TOKENS = [
  "exam-bg",
  "exam-bar",
  "exam-strip",
  "exam-orb-top",
  "exam-orb-bottom",
  "surface-raised",
  "surface-well",
] as const;

describe("A1/A2 (PBT): light values of the exam-* and surface-* tokens", () => {
  it("every exam/surface background token has a light value with luminance ≥ 0.8", () => {
    fc.assert(
      fc.property(fc.constantFrom(...EXAM_BG_TOKENS), (name) => {
        const light = lightOf(name);
        expect(light, `token "${name}" in lib/theme-tokens.json`).toBeDefined();
        expect(luminance(light!), `luminance of ${name} = ${light}`).toBeGreaterThanOrEqual(0.8);
      })
    );
  });

  it("exam-mark (highlight text) contrasts ≥ 4.5:1 with #ffffff and #f5f7fa", () => {
    fc.assert(
      fc.property(fc.constantFrom("#ffffff", "#f5f7fa"), (bg) => {
        const mark = lightOf("exam-mark");
        expect(mark, 'token "exam-mark" in lib/theme-tokens.json').toBeDefined();
        expect(contrast(mark!, bg)).toBeGreaterThanOrEqual(4.5);
      })
    );
  });

  it("main text (white, gray-100) on any light exam background contrasts ≥ 4.5:1", () => {
    fc.assert(
      fc.property(fc.constantFrom("white", "gray-100"), fc.constantFrom(...EXAM_BG_TOKENS), (ink, surface) => {
        const fg = lightOf(ink);
        const bg = lightOf(surface);
        expect(fg, `token "${ink}"`).toBeDefined();
        expect(bg, `token "${surface}" in lib/theme-tokens.json`).toBeDefined();
        expect(contrast(fg!, bg!)).toBeGreaterThanOrEqual(4.5);
      })
    );
  });
});

// ---------------------------------------------------------------------------------------------
// B1–B4 (exam part), B6 — ExamShell (RTL + PBT)
// ---------------------------------------------------------------------------------------------

interface ShellCase {
  split: number;
  mode: "practice" | "mock";
  hasExit: boolean;
  withLeft: boolean;
  questions: number;
}

const shellCase: fc.Arbitrary<ShellCase> = fc.record({
  split: fc.integer({ min: 28, max: 72 }),
  mode: fc.constantFrom<"practice" | "mock">("practice", "mock"),
  hasExit: fc.boolean(),
  withLeft: fc.boolean(),
  questions: fc.integer({ min: 1, max: 13 }),
});

const RUNS = { numRuns: 40 };

/** Renders the shell, sets `split` with the real divider drag, returns the key nodes. */
function renderShell(c: ShellCase) {
  const numbers = Array.from({ length: c.questions }, (_, i) => i + 1);
  const utils = render(
    <ExamShell
      title="Reading practice test"
      remainingMs={30 * 60_000}
      parts={[{ title: "Part 1", numbers }]}
      activePart={0}
      onPartChange={() => {}}
      answered={new Set<number>()}
      flagged={new Set<number>()}
      current={1}
      onJump={() => {}}
      fontScale={1}
      onFontScale={() => {}}
      left={c.withLeft ? <p>Passage text</p> : undefined}
      onSubmit={() => {}}
      exitHref={c.mode === "practice" && c.hasExit ? "/learning/reading" : undefined}
    >
      <p>Questions</p>
    </ExamShell>
  );
  const root = utils.container.querySelector<HTMLElement>(".exam-shell")!;
  const body = root.querySelector<HTMLElement>(':scope > div[style*="font-size"]')!;
  const separator = root.querySelector<HTMLElement>('[role="separator"]');
  if (separator) {
    // jsdom has no layout: give the body a 1000 px box so clientX = split × 10.
    body.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    act(() => {
      separator.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: c.split * 10 }));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("pointerup"));
    });
  }
  const panes = Array.from(body.children).filter((el) => el.getAttribute("role") !== "separator") as HTMLElement[];
  return { ...utils, root, body, panes, header: root.querySelector("header")!, nav: root.querySelector("nav")! };
}

function withShell(c: ShellCase, check: (s: ReturnType<typeof renderShell>) => void) {
  const s = renderShell(c);
  try {
    check(s);
  } finally {
    s.unmount();
  }
}

const classes = (el: Element | null) => (el ? String(el.getAttribute("class") ?? "").split(/\s+/) : []);

describe("B1–B4 (PBT): ExamShell on phones and tablets", () => {
  it("B1: the panes carry no inline flex-basis (it overrides w-full below lg)", () => {
    fc.assert(
      fc.property(shellCase, (c) =>
        withShell(c, ({ panes }) => {
          for (const pane of panes) expect(pane.style.flexBasis, "inline flex-basis on an exam pane").toBe("");
        })
      ),
      RUNS
    );
  });

  it("B1: the body exposes --exam-left / --exam-right from split", () => {
    fc.assert(
      fc.property(shellCase, (c) =>
        withShell(c, ({ body }) => {
          const split = c.withLeft ? c.split : 50;
          const left = body.style.getPropertyValue("--exam-left");
          const right = body.style.getPropertyValue("--exam-right");
          expect(left, "--exam-left on the exam body").toMatch(/%$/);
          expect(right, "--exam-right on the exam body").toMatch(/%$/);
          expect(parseFloat(left)).toBeCloseTo(split, 1);
          expect(parseFloat(right)).toBeCloseTo(100 - split, 1);
        })
      ),
      RUNS
    );
  });

  it("B2: in practice the exit link is always shown (no `hidden`, 44×44); mock has none", () => {
    fc.assert(
      fc.property(shellCase, (c) =>
        withShell(c, ({ root }) => {
          const exit = root.querySelector('a[aria-label="Leave the test"]');
          if (c.mode === "practice" && c.hasExit) {
            expect(exit, "exit link in practice").not.toBeNull();
            expect(classes(exit), "exit link classes").not.toContain("hidden");
            expect(classes(exit), "exit link classes").toContain("h-11");
            expect(classes(exit), "exit link classes").toContain("w-11");
          } else {
            expect(exit, "exit link without exitHref (mock)").toBeNull();
          }
        })
      ),
      RUNS
    );
  });

  it('B2: a phone text-size button (aria-label="Text size") is present', () => {
    fc.assert(
      fc.property(shellCase, (c) =>
        withShell(c, ({ root }) => {
          expect(root.querySelector('button[aria-label="Text size"]'), 'button[aria-label="Text size"]').not.toBeNull();
        })
      ),
      RUNS
    );
  });

  it("B3: previous/next are h-11 w-11 and question numbers h-10", () => {
    fc.assert(
      fc.property(shellCase, (c) =>
        withShell(c, ({ nav }) => {
          for (const name of ["Previous question", "Next question"]) {
            const btn = nav.querySelector(`button[aria-label="${name}"]`);
            expect(btn, name).not.toBeNull();
            expect(classes(btn), `${name} classes`).toContain("h-11");
            expect(classes(btn), `${name} classes`).toContain("w-11");
          }
          const numbers = Array.from(nav.querySelectorAll('button[aria-label^="Question "]'));
          expect(numbers).toHaveLength(c.questions);
          for (const btn of numbers) expect(classes(btn), "question number classes").toContain("h-10");
        })
      ),
      RUNS
    );
  });

  it("B4: the header and the navigator pad for env(safe-area-inset-*)", () => {
    fc.assert(
      fc.property(shellCase, (c) =>
        withShell(c, ({ header, nav }) => {
          expect(header.className, "exam header").toContain("env(safe-area-inset-top)");
          expect(nav.className, "question navigator").toContain("env(safe-area-inset-bottom)");
        })
      ),
      RUNS
    );
  });
});

// ---------------------------------------------------------------------------------------------
// B4 / B9 — viewport-fit and theme-color
// ---------------------------------------------------------------------------------------------

/** design.md: THEME_COLORS = { dark: "#04070d", light: "#ffffff" }. */
const DESIGN_THEME_COLORS: Record<ThemeMode, string> = { dark: "#04070d", light: "#ffffff" };

function resetDocument(): HTMLMetaElement {
  document.documentElement.className = "dark";
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = DESIGN_THEME_COLORS.dark;
  document.head.appendChild(meta);
  localStorage.clear();
  return meta;
}

describe("B4/B9: viewport-fit=cover and a theme-color that follows the theme", () => {
  it('app/layout.tsx: viewport has viewportFit: "cover" and no static themeColor', () => {
    const src = read("app/layout.tsx");
    expect(src).toContain('viewportFit: "cover"');
    expect(src).not.toMatch(/\bthemeColor\s*:/);
  });

  it("theme-script.ts exports THEME_COLORS as in the design", () => {
    const exported = (themeScript as unknown as Record<string, unknown>).THEME_COLORS;
    expect(exported).toEqual(DESIGN_THEME_COLORS);
  });

  it("THEME_SCRIPT with averna_theme=light sets meta[name=theme-color] to #ffffff", () => {
    const meta = resetDocument();
    localStorage.setItem("averna_theme", "light");
    new Function(themeScript.THEME_SCRIPT)();
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(meta.getAttribute("content")).toBe(DESIGN_THEME_COLORS.light);
  });

  it("PBT: after any sequence of theme changes theme-color matches the last choice", () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom<ThemeMode>("dark", "light"), { minLength: 1, maxLength: 8 }), (seq) => {
        const meta = resetDocument();
        const api: { current: ReturnType<typeof useTheme> | null } = { current: null };
        function Probe() {
          api.current = useTheme();
          return null;
        }
        const { unmount } = render(
          <ThemeProvider>
            <Probe />
          </ThemeProvider>
        );
        try {
          for (const m of seq) act(() => api.current!.setMode(m));
          expect(meta.getAttribute("content"), `theme-color after ${seq.join(" → ")}`).toBe(
            DESIGN_THEME_COLORS[seq[seq.length - 1]]
          );
        } finally {
          unmount();
        }
      }),
      { numRuns: 50 }
    );
  });
});

// ---------------------------------------------------------------------------------------------
// B6, B8, B10 — modals, toasts, overflow-x fallback
// ---------------------------------------------------------------------------------------------

const MODAL_SOURCES = [
  "components/onboarding-wizard.tsx",
  "components/onboarding-tour.tsx",
  "components/dashboard/brain-break.tsx",
  "components/dashboard/level-up-celebration.tsx",
  "components/dashboard/dashboard-preferences.tsx",
  "components/exam/exam-shell.tsx",
];

/** Class string of the first `fixed` container in a file. */
function fixedContainer(src: string): string | null {
  for (const m of src.matchAll(/"([^"\n]*)"/g)) if (m[1].split(/\s+/).includes("fixed")) return m[1];
  return null;
}

describe("B6/B8/B10: modals, toasts and the overflow-x fallback", () => {
  it("B6: the panels of all six modals carry av-modal-panel", () => {
    const missing = MODAL_SOURCES.filter((f) => !/\bav-modal-panel\b/.test(read(f)));
    expect(missing, "modal sources without av-modal-panel").toEqual([]);
  });

  it("B6: globals.css has a rule for .av-modal-panel", () => {
    expect(css).toMatch(/\.av-modal-panel\s*\{/);
  });

  it("B6: the rendered ReviewDialog panel has av-modal-panel", () => {
    withShell({ split: 50, mode: "practice", hasExit: true, withLeft: true, questions: 5 }, ({ root }) => {
      const finish = Array.from(root.querySelectorAll("header button")).find((b) => b.textContent?.includes("Finish Test"));
      expect(finish, "Finish Test button").toBeDefined();
      fireEvent.click(finish!);
      const dialog = root.querySelector('[role="dialog"]');
      expect(dialog, "ReviewDialog").not.toBeNull();
      expect(classes(dialog)).toContain("av-modal-panel");
    });
  });

  it.each(["components/ui/toast.tsx", "components/live-notifications.tsx"])(
    "B8: %s starts below the top bar on phones (no base top-4, safe-area top, lg:top-4)",
    (file) => {
      const cls = fixedContainer(read(file));
      expect(cls, `fixed container in ${file}`).not.toBeNull();
      const tokens = cls!.split(/\s+/);
      expect(tokens, "base-level classes").not.toContain("top-4");
      expect(cls).toContain("env(safe-area-inset-top)");
      expect(tokens).toContain("lg:top-4");
    }
  );

  it("B10: globals.css has an @supports not (overflow-x: clip) fallback", () => {
    expect(css).toContain("@supports not (overflow-x: clip)");
  });
});
