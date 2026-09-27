/**
 * Raw score → band conversion, using the conversion tables IELTS publishes as a
 * guide for Listening and Academic / General Training Reading (40 questions).
 * Partial tests (one passage / one part) are scaled to 40 first, so a practice
 * band means "this is the band you'd get if you kept this rate for a full test".
 */

type Row = [minRaw: number, band: number];

/** Listening (Academic & General Training). */
export const LISTENING_TABLE: Row[] = [
  [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5],
  [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1], [0, 0],
];

/** Academic Reading. */
export const ACADEMIC_READING_TABLE: Row[] = [
  [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5],
  [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1], [0, 0],
];

/** General Training Reading. */
export const GENERAL_READING_TABLE: Row[] = [
  [40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6], [27, 5.5],
  [23, 5], [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5], [3, 2], [1, 1], [0, 0],
];

export function bandFromTable(raw: number, table: Row[]): number {
  const r = Math.max(0, Math.min(40, Math.round(raw)));
  for (const [min, band] of table) if (r >= min) return band;
  return 0;
}

/** Raw score scaled to a 40-question paper. */
export function scaledRaw(correct: number, total: number): number {
  if (total <= 0) return 0;
  if (total === 40) return correct;
  return Math.round((correct / total) * 40);
}

export function listeningBand(correct: number, total = 40): number {
  return bandFromTable(scaledRaw(correct, total), LISTENING_TABLE);
}

export function readingBand(correct: number, total = 40, module: "academic" | "general" = "academic"): number {
  return bandFromTable(
    scaledRaw(correct, total),
    module === "general" ? GENERAL_READING_TABLE : ACADEMIC_READING_TABLE
  );
}

/**
 * IELTS rounding to the nearest half band: .25 rounds up to .5 and .75 rounds
 * up to the next whole band (e.g. 6.25 → 6.5, 6.75 → 7.0, 6.1 → 6.0).
 */
export function roundBand(x: number): number {
  const v = Math.max(0, Math.min(9, x));
  const whole = Math.floor(v);
  const frac = v - whole;
  if (frac < 0.25) return whole;
  if (frac < 0.75) return whole + 0.5;
  return Math.min(9, whole + 1);
}

/** Overall band = mean of the four skills, IELTS-rounded. */
export function overallBand(bands: number[]): number {
  const valid = bands.filter((b) => Number.isFinite(b));
  if (!valid.length) return 0;
  return roundBand(valid.reduce((a, b) => a + b, 0) / valid.length);
}

/** Writing band: Task 2 carries twice the weight of Task 1. */
export function writingBand(task1: number, task2: number): number {
  return roundBand((task1 + 2 * task2) / 3);
}

/** Correct answers needed on a 40-question paper for a target band (for "you need N more"). */
export function rawNeededFor(band: number, skill: "READING" | "LISTENING"): number | null {
  const table = skill === "LISTENING" ? LISTENING_TABLE : ACADEMIC_READING_TABLE;
  const rows = [...table].reverse();
  const hit = rows.find(([, b]) => b >= band);
  return hit ? hit[0] : null;
}
