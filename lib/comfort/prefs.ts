/**
 * Reading-comfort and native-language-hint preferences, saved per device in
 * localStorage. Pure helpers (parse, serialize, prefs → root classes) run
 * anywhere; readPrefs / applyPrefs / savePrefs touch the browser and are no-ops
 * on the server.
 *
 * The same class map drives the inline <head> script (COMFORT_SCRIPT in
 * components/comfort/comfort-script.ts), so a saved text size, font, line
 * spacing or contrast is on <html> before the first paint on every page.
 *
 *   averna_text_scale   sm | md | lg            → html.text-scale-sm / .text-scale-lg
 *   averna_font         default | readable      → html.font-readable (Atkinson Hyperlegible)
 *   averna_line_spacing normal | relaxed | loose→ html.leading-relaxed-ui / .leading-loose-ui
 *   averna_contrast     normal | high           → html.contrast-high
 *   averna_ruler        off | on                → the reading ruler (components/comfort/reading-ruler.tsx)
 *   averna_l1           off | uz | ru           → native-language hints (lib/l1/hints.ts)
 *   averna_l1_when      level | always          → hints only at A1–B1 / band ≤ 5, or always
 */

export type TextScale = "sm" | "md" | "lg";
export type ComfortFont = "default" | "readable";
export type LineSpacing = "normal" | "relaxed" | "loose";
export type Contrast = "normal" | "high";
export type Ruler = "off" | "on";
export type L1Choice = "off" | "uz" | "ru";
export type L1When = "level" | "always";

export interface ComfortPrefs {
  textScale: TextScale;
  font: ComfortFont;
  lineSpacing: LineSpacing;
  contrast: Contrast;
  ruler: Ruler;
  l1: L1Choice;
  l1When: L1When;
}

export type PrefName = keyof ComfortPrefs;

/** Allowed values; the first one is the default. */
export const PREF_VALUES = {
  textScale: ["md", "sm", "lg"],
  font: ["default", "readable"],
  lineSpacing: ["normal", "relaxed", "loose"],
  contrast: ["normal", "high"],
  ruler: ["off", "on"],
  l1: ["off", "uz", "ru"],
  l1When: ["level", "always"],
} as const satisfies { [K in PrefName]: readonly ComfortPrefs[K][] };

export const PREF_KEYS = {
  textScale: "averna_text_scale",
  font: "averna_font",
  lineSpacing: "averna_line_spacing",
  contrast: "averna_contrast",
  ruler: "averna_ruler",
  l1: "averna_l1",
  l1When: "averna_l1_when",
} as const satisfies Record<PrefName, string>;

export const PREF_NAMES = Object.keys(PREF_KEYS) as PrefName[];

export const DEFAULT_PREFS: ComfortPrefs = {
  textScale: "md",
  font: "default",
  lineSpacing: "normal",
  contrast: "normal",
  ruler: "off",
  l1: "off",
  l1When: "level",
};

/** Root <html> class for each (pref, value); values without a class add none. */
export const CLASS_MAP: { [K in PrefName]?: Partial<Record<ComfortPrefs[K], string>> } = {
  textScale: { sm: "text-scale-sm", lg: "text-scale-lg" },
  font: { readable: "font-readable" },
  lineSpacing: { relaxed: "leading-relaxed-ui", loose: "leading-loose-ui" },
  contrast: { high: "contrast-high" },
};

/** Every class this module may put on <html> (and removes before re-applying). */
export const ROOT_CLASSES: string[] = Object.values(CLASS_MAP).flatMap((m) => Object.values(m ?? {}) as string[]);

/** Fired on window after any change, so open components update live. */
export const COMFORT_EVENT = "averna-comfort";

function pick<K extends PrefName>(name: K, raw: unknown): ComfortPrefs[K] {
  const allowed = PREF_VALUES[name] as readonly string[];
  return (typeof raw === "string" && allowed.includes(raw) ? raw : DEFAULT_PREFS[name]) as ComfortPrefs[K];
}

/** Stored strings (by storage key) → prefs. Missing or unknown values fall back to the defaults. */
export function parsePrefs(stored: Record<string, unknown> | null | undefined): ComfortPrefs {
  const src = stored && typeof stored === "object" ? stored : {};
  const out = { ...DEFAULT_PREFS };
  for (const name of PREF_NAMES) (out as Record<PrefName, string>)[name] = pick(name, src[PREF_KEYS[name]]);
  return out;
}

/** Prefs → strings by storage key (inverse of parsePrefs). */
export function serializePrefs(prefs: ComfortPrefs): Record<string, string> {
  const clean = parsePrefs(Object.fromEntries(PREF_NAMES.map((n) => [PREF_KEYS[n], prefs[n]])));
  return Object.fromEntries(PREF_NAMES.map((n) => [PREF_KEYS[n], clean[n]]));
}

/** The <html> classes for these prefs, in a fixed order. */
export function rootClasses(prefs: ComfortPrefs): string[] {
  const out: string[] = [];
  for (const name of PREF_NAMES) {
    const map = CLASS_MAP[name] as Record<string, string> | undefined;
    const cls = map?.[pick(name, prefs[name])];
    if (cls) out.push(cls);
  }
  return out;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function storage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Saved prefs on this device (defaults on the server or without storage). */
export function readPrefs(store: StorageLike | null = storage()): ComfortPrefs {
  if (!store) return { ...DEFAULT_PREFS };
  try {
    return parsePrefs(Object.fromEntries(PREF_NAMES.map((n) => [PREF_KEYS[n], store.getItem(PREF_KEYS[n])])));
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/** Put exactly the classes for `prefs` on <html> (other classes untouched). */
export function applyPrefs(prefs: ComfortPrefs, root: HTMLElement | null = typeof document !== "undefined" ? document.documentElement : null): void {
  if (!root) return;
  const want = new Set(rootClasses(prefs));
  for (const cls of ROOT_CLASSES) root.classList.toggle(cls, want.has(cls));
}

/**
 * Merge, persist, apply and announce a change. Returns the new prefs. Only the
 * changed keys are written, so an untouched contrast setting can still follow
 * the system's "more contrast" preference on a first visit (COMFORT_SCRIPT).
 */
export function savePrefs(patch: Partial<ComfortPrefs>, store: StorageLike | null = storage()): ComfortPrefs {
  const next = parsePrefs(serializePrefs({ ...readPrefs(store), ...patch } as ComfortPrefs));
  if (store) {
    try {
      for (const name of PREF_NAMES) if (name in patch) store.setItem(PREF_KEYS[name], next[name]);
    } catch {
      /* private mode / quota: still apply for this page */
    }
  }
  applyPrefs(next);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(COMFORT_EVENT, { detail: next }));
  return next;
}
