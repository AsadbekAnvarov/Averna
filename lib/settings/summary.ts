/**
 * One-line summaries of the current values of each Settings group, shown in a
 * collapsed group's header (components/settings/settings-group.tsx), e.g.
 * "Dark · Medium text" or "Readable font · Loose spacing · Ruler on".
 * Pure: the same values always give the same line.
 */
import type { ComfortPrefs, L1Choice, L1When } from "@/lib/comfort/prefs";

const SEP = " · ";

const TEXT_SIZE: Record<ComfortPrefs["textScale"], string> = { sm: "Small", md: "Medium", lg: "Large" };
const SPACING: Record<ComfortPrefs["lineSpacing"], string> = { normal: "Normal", relaxed: "Relaxed", loose: "Loose" };
const HINT_LANGUAGE: Record<Exclude<L1Choice, "off">, string> = { uz: "Uzbek", ru: "Russian" };

/** Display: "Dark · Medium text". */
export function displaySummary(mode: "dark" | "light", textScale: ComfortPrefs["textScale"]): string {
  return `${mode === "light" ? "Light" : "Dark"}${SEP}${TEXT_SIZE[textScale]} text`;
}

/** Reading comfort: font and spacing always, contrast and ruler when on ("Standard font · Normal spacing"). */
export function readingSummary(p: Pick<ComfortPrefs, "font" | "lineSpacing" | "contrast" | "ruler">): string {
  return [
    p.font === "readable" ? "Readable font" : "Standard font",
    `${SPACING[p.lineSpacing]} spacing`,
    p.contrast === "high" ? "High contrast" : null,
    p.ruler === "on" ? "Ruler on" : null,
  ]
    .filter(Boolean)
    .join(SEP);
}

/** Native-language hints: "Hints off" or "Uzbek hints · At my level" / "Russian hints · Always". */
export function hintsSummary(l1: L1Choice, l1When: L1When): string {
  if (l1 === "off") return "Hints off";
  return `${HINT_LANGUAGE[l1]} hints${SEP}${l1When === "always" ? "Always" : "At my level"}`;
}

/** Comfort & effects: "Focus off · Seasonal on · Ambiance on". */
export function effectsSummary(v: { focus: boolean; seasonal: boolean; ambiance: boolean }): string {
  const onOff = (on: boolean) => (on ? "on" : "off");
  return [`Focus ${onOff(v.focus)}`, `Seasonal ${onOff(v.seasonal)}`, `Ambiance ${onOff(v.ambiance)}`].join(SEP);
}

/** Sound: "Sounds off", or what plays ("Interface: Soft · Ambient: Soft Rain"). */
export function soundSummary(v: { ui: boolean; uiPackLabel?: string; ambient: boolean; sceneLabel?: string }): string {
  const parts = [
    v.ui ? `Interface: ${v.uiPackLabel ?? "on"}` : null,
    v.ambient ? `Ambient: ${v.sceneLabel ?? "on"}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(SEP) : "Sounds off";
}
