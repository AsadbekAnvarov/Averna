/**
 * scripts/theme-tokens.mjs → buildThemeBlock (spec mobile-ui-exam-light-theme-fix, task 4.1).
 * Exam screens follow the selected theme: the dark values live in `:root` only, the light
 * values in `html.light`, and nothing is scoped to `.exam-shell` any more.
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3**
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { BEGIN, END, buildThemeBlock } from "@/scripts/theme-tokens.mjs";
import themeTokens from "@/lib/theme-tokens.json";

type Token = [string, string, string];
const tokens = themeTokens.tokens as Token[];
const keepWhiteInk = themeTokens.keepWhiteInk;

const rgb = (hex: string) =>
  hex
    .replace("#", "")
    .match(/../g)!
    .map((x) => parseInt(x, 16))
    .join(" ");

/** Body of the first rule whose selector list is exactly `selector`. */
function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(`\n${selector} {\n`);
  expect(start, `rule "${selector}"`).toBeGreaterThan(-1);
  const open = css.indexOf("{", start);
  return css.slice(open + 1, css.indexOf("}", open));
}

describe("buildThemeBlock", () => {
  const block = buildThemeBlock({ tokens, keepWhiteInk });

  it("is wrapped in the THEME TOKENS markers and never scopes anything to .exam-shell", () => {
    expect(block.startsWith(BEGIN)).toBe(true);
    expect(block.endsWith(END)).toBe(true);
    expect(block).not.toContain(".exam-shell");
    expect(block).toMatch(/\n:root \{\n/);
  });

  it("declares every token with its dark value in :root and its light value in html.light", () => {
    const dark = ruleBody(block, ":root");
    const light = ruleBody(block, "html.light");
    for (const [name, d, l] of tokens) {
      expect(dark).toContain(`  --c-${name}: ${rgb(d)};`);
      expect(light).toContain(`  --c-${name}: ${rgb(l)};`);
    }
  });

  it("keeps white ink on solid fills in the light theme", () => {
    const selectors = keepWhiteInk.map((c) => `html.light .${c.replace(/\//g, "\\/")}`).join(",\n");
    expect(block).toContain(`${selectors} {\n  --c-white: 255 255 255;\n}`);
  });

  it("app/globals.css holds exactly the generated block (regeneration gives no diff)", () => {
    const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
    expect(css).toContain(block);
  });

  it("the exam-* / surface-* tokens keep the replaced hex values in the dark theme", () => {
    const darkOf = Object.fromEntries(tokens.map(([n, d]) => [n, d]));
    expect(darkOf).toMatchObject({
      "exam-bg": "#040b09",
      "exam-bar": "#07130f",
      "exam-strip": "#06110d",
      "exam-orb-top": "#0e261e",
      "exam-orb-bottom": "#06120e",
      "exam-mark": "#fffbeb",
      "surface-raised": "#0b1a16",
      "surface-well": "#000000",
    });
  });

  it("property: any token list maps each name to :root (dark) and html.light (light)", () => {
    const hex = fc
      .tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }))
      .map((c) => `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`);
    const name = fc.stringMatching(/^[a-z]{1,8}(-[a-z0-9]{1,6})?$/);
    fc.assert(
      fc.property(fc.uniqueArray(fc.tuple(name, hex, hex), { minLength: 1, maxLength: 12, selector: (t) => t[0] }), (list) => {
        const out = buildThemeBlock({ tokens: list, keepWhiteInk: ["bg-white"] });
        expect(out).not.toContain(".exam-shell");
        const dark = ruleBody(out, ":root");
        const light = ruleBody(out, "html.light");
        for (const [n, d, l] of list) {
          expect(dark).toContain(`--c-${n}: ${rgb(d)};`);
          expect(light).toContain(`--c-${n}: ${rgb(l)};`);
        }
      })
    );
  });
});
