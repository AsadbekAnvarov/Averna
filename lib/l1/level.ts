/**
 * Who sees native-language hints. Pure.
 *
 * The student's `level` is free text set at enrollment ("B1", "Pre-Intermediate",
 * "IELTS 5.5", "A2–B1" …). Hints help most up to B1, so with "At my level" they
 * show for A1 / A2 / B1 or a band of 5.0 and below — and when the level is
 * unknown (better a hint too many than a learner left without one).
 */

import type { ComfortPrefs, L1Choice } from "@/lib/comfort/prefs";

export type Cefr = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type ParsedLevel = { cefr: Cefr } | { band: number } | null;

/** Course names → CEFR; the more specific names first ("upper-intermediate" before "intermediate"). */
const NAMED: [RegExp, Cefr][] = [
  [/\bproficien(?:cy|t)\b/, "C2"],
  [/\b(?:upper[\s-]*intermediate|upper[\s-]*int)\b/, "B2"],
  [/\b(?:pre[\s-]*intermediate|pre[\s-]*int)\b/, "A2"],
  [/\badvanced\b/, "C1"],
  [/\bintermediate\b/, "B1"],
  [/\belementary\b/, "A2"],
  [/\b(?:beginners?|starters?)\b/, "A1"],
];

/** "B1" / "a2+" / "Pre-Intermediate" / "IELTS 5.5" / "5" → level; junk → null. The first CEFR code wins ("A2–B1" → A2). */
export function parseLevel(level: string | null | undefined): ParsedLevel {
  if (typeof level !== "string") return null;
  const s = level.trim().toLowerCase();
  if (!s || s.length > 80) return null;
  const code = s.match(/(?:^|[^a-z0-9])([abc])\s*([12])(?![0-9])/);
  if (code) return { cefr: `${code[1].toUpperCase()}${code[2]}` as Cefr };
  for (const [re, cefr] of NAMED) if (re.test(s)) return { cefr };
  const num = s.match(/(?:^|[^0-9a-z.,])(\d(?:[.,]\d)?)(?![0-9a-z])/);
  if (num) {
    const band = Number(num[1].replace(",", "."));
    if (Number.isFinite(band) && band >= 0 && band <= 9) return { band };
  }
  return null;
}

/** Hints are meant for this level: A1–B1, band ≤ 5.0, or unknown. */
export function levelWantsHints(level: string | null | undefined): boolean {
  const p = parseLevel(level);
  if (!p) return true;
  if ("cefr" in p) return p.cefr === "A1" || p.cefr === "A2" || p.cefr === "B1";
  return p.band <= 5;
}

/** Hints on (a language picked) and either "Always" or the student's level calls for them. */
export function shouldShowL1Hints(prefs: Pick<ComfortPrefs, "l1" | "l1When">, level: string | null | undefined): boolean {
  if (prefs.l1 !== "uz" && prefs.l1 !== "ru") return false;
  return prefs.l1When === "always" || levelWantsHints(level);
}

/** The profile's native language, when it looks Uzbek or Russian — a suggestion only, never switched on by itself. */
export function suggestL1(nativeLanguage: string | null | undefined): Exclude<L1Choice, "off"> | null {
  if (typeof nativeLanguage !== "string") return null;
  const s = nativeLanguage.trim().toLowerCase();
  if (!s) return null;
  if (/o[ʻʼ'‘’`]?zbek|uzbek|ўзбек|узбек|^uz$|^uzb$/.test(s)) return "uz";
  if (/russian|русск|^ru$|^rus$|рус$/.test(s)) return "ru";
  return null;
}
