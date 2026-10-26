/**
 * A student's level for peer speaking: one IELTS-style band 3.0–9.0.
 *
 * Best available source first (docs/peer-speaking.md §3):
 *   1. "speaking-test" — the latest scored IELTS Speaking test (IELTSTest, module SPEAKING, last 365 days)
 *   2. "placement"     — the latest finished placement test's overall band (PlacementAttempt.band)
 *   3. "profile"       — Student.level as written by an admin or the placement test
 *                        ("Oʻrta (B1)", "B2", "IELTS 6.5" …): a band number or a CEFR code
 *   4. "target"        — Student.targetBand minus 1.0 (a target usually sits about a band above today)
 *   5. "default"       — 5.0
 * The result is clamped to 3.0–9.0 and rounded to the nearest 0.5.
 */

export type PeerLevelSource = "speaking-test" | "placement" | "profile" | "target" | "default";

export interface PeerLevel {
  band: number;
  cefr: string;
  source: PeerLevelSource;
}

export interface PeerLevelInputs {
  speakingBand?: number | null;
  placementBand?: number | null;
  levelText?: string | null;
  targetBand?: string | number | null;
}

export const MIN_PEER_BAND = 3;
export const MAX_PEER_BAND = 9;
export const DEFAULT_PEER_BAND = 5;

/** Middle of each CEFR level's IELTS range (A2 3–3.5, B1 4–5, B2 5.5–6.5, C1 7–8, C2 8.5+). */
const CEFR_BAND: Record<string, number> = { A1: 3, A2: 3.5, B1: 4.5, B2: 6, C1: 7.5, C2: 8.5 };

export function clampBand(band: number): number {
  const b = Math.min(MAX_PEER_BAND, Math.max(MIN_PEER_BAND, band));
  return Math.round(b * 2) / 2;
}

/** IELTS band → CEFR label, following the published alignment used by the placement test. */
export function cefrForBand(band: number): string {
  if (band < 3) return "A1";
  if (band < 4) return "A2";
  if (band < 5.5) return "B1";
  if (band < 7) return "B2";
  if (band < 8.5) return "C1";
  return "C2";
}

const valid = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0 && n <= 9;

/** "IELTS 6.5", "Band 6", "6.0" → 6.5 / 6 / 6; "Oʻrta (B1)", "b2" → CEFR midpoint; otherwise null. */
export function parseLevelText(text: string | null | undefined): number | null {
  if (!text) return null;
  const cefr = text.toUpperCase().match(/\b([ABC][12])\b/);
  if (cefr && CEFR_BAND[cefr[1]] != null) return CEFR_BAND[cefr[1]];
  const num = text.match(/(\d(?:[.,]\d)?)/);
  if (num) {
    const n = Number(num[1].replace(",", "."));
    if (valid(n)) return n;
  }
  return null;
}

export function resolvePeerLevel(s: PeerLevelInputs): PeerLevel {
  const pick = (band: number, source: PeerLevelSource): PeerLevel => {
    const b = clampBand(band);
    return { band: b, cefr: cefrForBand(b), source };
  };
  if (valid(s.speakingBand)) return pick(s.speakingBand, "speaking-test");
  if (valid(s.placementBand)) return pick(s.placementBand, "placement");
  const profile = parseLevelText(s.levelText);
  if (profile != null) return pick(profile, "profile");
  const target = typeof s.targetBand === "number" ? s.targetBand : parseLevelText(s.targetBand ?? null);
  if (valid(target)) return pick(target - 1, "target");
  return pick(DEFAULT_PEER_BAND, "default");
}

/** "Band 6.0 / B2". */
export function levelLabel(level: { band: number; cefr: string }): string {
  return `Band ${level.band.toFixed(1)} / ${level.cefr}`;
}
