/**
 * Reading comfort prefs (docs/elegance-roadmap.md, idea 8): lib/comfort/prefs.ts
 * and the pre-paint COMFORT_SCRIPT (components/comfort/comfort-script.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import {
  CLASS_MAP,
  COMFORT_EVENT,
  DEFAULT_PREFS,
  PREF_KEYS,
  PREF_NAMES,
  PREF_VALUES,
  ROOT_CLASSES,
  applyPrefs,
  parsePrefs,
  readPrefs,
  rootClasses,
  savePrefs,
  serializePrefs,
  type ComfortPrefs,
} from "@/lib/comfort/prefs";
import { COMFORT_SCRIPT } from "@/components/comfort/comfort-script";

const prefsArb: fc.Arbitrary<ComfortPrefs> = fc.record({
  textScale: fc.constantFrom(...PREF_VALUES.textScale),
  font: fc.constantFrom(...PREF_VALUES.font),
  lineSpacing: fc.constantFrom(...PREF_VALUES.lineSpacing),
  contrast: fc.constantFrom(...PREF_VALUES.contrast),
  ruler: fc.constantFrom(...PREF_VALUES.ruler),
  l1: fc.constantFrom(...PREF_VALUES.l1),
  l1When: fc.constantFrom(...PREF_VALUES.l1When),
});

/** Anything a stale build, a user or an extension could leave in storage. */
const junk = fc.oneof(
  fc.string(),
  fc.constant(null),
  fc.constant(undefined),
  fc.integer(),
  fc.boolean(),
  fc.constantFrom("LG", " lg", "true", "1", "readable ", "toString", "__proto__", "constructor", "high!", "UZ")
);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "dark";
});
afterEach(() => vi.restoreAllMocks());

describe("parse / serialize", () => {
  it("round-trips every valid combination", () => {
    fc.assert(
      fc.property(prefsArb, (p) => {
        expect(parsePrefs(serializePrefs(p))).toEqual(p);
      })
    );
  });

  it("serializes to exactly the storage keys, keeping the existing averna_text_scale", () => {
    expect(PREF_KEYS.textScale).toBe("averna_text_scale");
    fc.assert(
      fc.property(prefsArb, (p) => {
        const out = serializePrefs(p);
        expect(Object.keys(out).sort()).toEqual(Object.values(PREF_KEYS).sort());
        for (const v of Object.values(out)) expect(typeof v).toBe("string");
      })
    );
  });

  it("garbage values fall back to the default for that field only", () => {
    fc.assert(
      fc.property(prefsArb, fc.dictionary(fc.constantFrom(...PREF_NAMES), junk), (valid, bad) => {
        const stored: Record<string, unknown> = serializePrefs(valid);
        for (const [name, value] of Object.entries(bad)) stored[PREF_KEYS[name as keyof ComfortPrefs]] = value;
        const parsed = parsePrefs(stored);
        for (const name of PREF_NAMES) {
          const raw = stored[PREF_KEYS[name]];
          const ok = (PREF_VALUES[name] as readonly unknown[]).includes(raw);
          expect(parsed[name]).toBe(ok ? raw : DEFAULT_PREFS[name]);
        }
      })
    );
  });

  it("no storage, null or a non-object → the defaults", () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("lg" as unknown as Record<string, unknown>)).toEqual(DEFAULT_PREFS);
    expect(readPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS).toMatchObject({ textScale: "md", font: "default", lineSpacing: "normal", contrast: "normal", ruler: "off", l1: "off", l1When: "level" });
  });
});

describe("prefs → <html> classes", () => {
  it("is deterministic and only ever uses known classes", () => {
    fc.assert(
      fc.property(prefsArb, (p) => {
        const a = rootClasses(p);
        expect(rootClasses({ ...p })).toEqual(a);
        for (const c of a) expect(ROOT_CLASSES).toContain(c);
        expect(new Set(a).size).toBe(a.length);
      })
    );
  });

  it("maps each setting to its class", () => {
    expect(rootClasses(DEFAULT_PREFS)).toEqual([]);
    expect(rootClasses({ ...DEFAULT_PREFS, textScale: "lg", font: "readable", lineSpacing: "loose", contrast: "high" })).toEqual([
      "text-scale-lg",
      "font-readable",
      "leading-loose-ui",
      "contrast-high",
    ]);
    expect(rootClasses({ ...DEFAULT_PREFS, textScale: "sm", lineSpacing: "relaxed" })).toEqual(["text-scale-sm", "leading-relaxed-ui"]);
    // The ruler and the hints are not root classes.
    expect(rootClasses({ ...DEFAULT_PREFS, ruler: "on", l1: "uz", l1When: "always" })).toEqual([]);
  });

  it("applyPrefs sets exactly the classes for the prefs and leaves the rest of <html> alone", () => {
    fc.assert(
      fc.property(prefsArb, prefsArb, (before, after) => {
        const root = document.createElement("html");
        root.className = "dark __variable_x";
        applyPrefs(before, root);
        applyPrefs(after, root);
        const managed = [...root.classList].filter((c) => ROOT_CLASSES.includes(c));
        expect(managed.sort()).toEqual(rootClasses(after).sort());
        expect(root.classList.contains("dark")).toBe(true);
        expect(root.classList.contains("__variable_x")).toBe(true);
      })
    );
  });
});

describe("savePrefs", () => {
  it("writes only the changed keys, applies the classes and announces the change", () => {
    const seen: ComfortPrefs[] = [];
    const on = (e: Event) => seen.push((e as CustomEvent<ComfortPrefs>).detail);
    window.addEventListener(COMFORT_EVENT, on);
    const next = savePrefs({ textScale: "lg", font: "readable" });
    window.removeEventListener(COMFORT_EVENT, on);

    expect(next).toEqual({ ...DEFAULT_PREFS, textScale: "lg", font: "readable" });
    expect(localStorage.getItem("averna_text_scale")).toBe("lg");
    expect(localStorage.getItem("averna_font")).toBe("readable");
    expect(localStorage.getItem("averna_contrast")).toBeNull(); // untouched: may still follow the system on a first visit
    expect(document.documentElement.classList.contains("text-scale-lg")).toBe(true);
    expect(document.documentElement.classList.contains("font-readable")).toBe(true);
    expect(seen).toEqual([next]);
    expect(readPrefs()).toEqual(next);
  });

  it("ignores an invalid value in the patch", () => {
    const next = savePrefs({ lineSpacing: "huge" as never });
    expect(next.lineSpacing).toBe("normal");
    expect(localStorage.getItem("averna_line_spacing")).toBe("normal");
  });
});

// ---------------------------------------------------------------------------
// COMFORT_SCRIPT — the inline <head> script
// ---------------------------------------------------------------------------

function runScript(stored: Record<string, string>, opts: { moreContrast?: boolean; throwOnRead?: boolean; noMatchMedia?: boolean } = {}) {
  const classes = new Set<string>(["dark"]);
  const store = new Map(Object.entries(stored));
  const fakeDocument = { documentElement: { classList: { add: (c: string) => classes.add(c) } } };
  const fakeStorage = {
    getItem: (k: string) => {
      if (opts.throwOnRead) throw new Error("SecurityError");
      return store.has(k) ? store.get(k)! : null;
    },
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  const fakeWindow = opts.noMatchMedia ? {} : { matchMedia: (q: string) => ({ matches: !!opts.moreContrast && q === "(prefers-contrast: more)" }) };
  // The script only reads these three globals.
  new Function("document", "localStorage", "window", COMFORT_SCRIPT)(fakeDocument, fakeStorage, fakeWindow);
  return { classes, store };
}

describe("COMFORT_SCRIPT", () => {
  it("is valid JavaScript wrapped in try/catch", () => {
    expect(() => new Function(COMFORT_SCRIPT)).not.toThrow();
    expect(COMFORT_SCRIPT.startsWith("try{")).toBe(true);
    expect(COMFORT_SCRIPT.endsWith("}catch(_){}")).toBe(true);
    // Every class it can add comes from the same map as the app.
    for (const map of Object.values(CLASS_MAP)) for (const c of Object.values(map ?? {})) expect(COMFORT_SCRIPT).toContain(JSON.stringify(c));
  });

  it("applies the same classes as rootClasses for any saved prefs (garbage ignored)", () => {
    fc.assert(
      fc.property(prefsArb, fc.dictionary(fc.constantFrom(...PREF_NAMES), fc.string()), (p, bad) => {
        const stored: Record<string, string> = serializePrefs(p);
        for (const [name, v] of Object.entries(bad)) stored[PREF_KEYS[name as keyof ComfortPrefs]] = v;
        const { classes } = runScript(stored);
        const expected = rootClasses(parsePrefs(stored));
        expect([...classes].filter((c) => c !== "dark").sort()).toEqual(expected.sort());
      })
    );
  });

  it("restores a saved Large text size on any page (the old bug)", () => {
    expect(runScript({ averna_text_scale: "lg" }).classes.has("text-scale-lg")).toBe(true);
    expect(runScript({ averna_text_scale: "md" }).classes.has("text-scale-lg")).toBe(false);
  });

  it("starts at high contrast on a first visit with the system's more-contrast setting, and saves it", () => {
    const first = runScript({}, { moreContrast: true });
    expect(first.classes.has("contrast-high")).toBe(true);
    expect(first.store.get("averna_contrast")).toBe("high");
    // An explicit choice wins over the system setting.
    const chosen = runScript({ averna_contrast: "normal" }, { moreContrast: true });
    expect(chosen.classes.has("contrast-high")).toBe(false);
    expect(runScript({}, { moreContrast: false }).classes.has("contrast-high")).toBe(false);
    expect(runScript({}, { noMatchMedia: true }).classes.has("contrast-high")).toBe(false);
  });

  it("never throws, even when storage does", () => {
    expect(() => runScript({}, { throwOnRead: true, moreContrast: true })).not.toThrow();
    expect(() => new Function("document", "localStorage", "window", COMFORT_SCRIPT)(undefined, undefined, undefined)).not.toThrow();
  });
});
