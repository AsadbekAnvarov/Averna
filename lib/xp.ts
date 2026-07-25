/**
 * XP Engine 2.0 — XP represents genuine growth, not clicks.
 *
 * Pure, dependency-free scoring so it's easy to reason about and test. The DB
 * lookups that feed it (recent average, repeat count, daily total) live in
 * db-helpers' computeTestXpForStudent; this file just turns those signals into
 * a fair number that behaves consistently across every module.
 */

export interface TestXpInputs {
  /** Band achieved on this test (0-9). */
  score: number;
  /** "Easy" | "Medium" | "Hard" — anything else is treated as Medium. */
  difficulty?: string | null;
  /** The student's recent average band in this module (0 = no history yet). */
  recentAvg: number;
  /** How many times the student has already taken this SAME content. */
  repeatCount: number;
  /** XP the student has already earned in the last 24h (for the soft cap). */
  dailyXpSoFar: number;
}

/** Past this much XP in a rolling 24h, further XP is heavily discounted. */
export const DAILY_SOFT_CAP = 300;

/**
 * XP for a completed test:
 *  - base scales with the band (a first attempt stays ~score×10, so existing
 *    XP magnitudes feel familiar — no deflation shock);
 *  - a bonus for beating your own recent average (rewards real improvement);
 *  - harder tests pay a little more, easier a little less;
 *  - repeat-decay: retaking the SAME test earns sharply less each time
 *    (1st ×1, 2nd ×0.5, 3rd ×0.33 …) — this kills answer-memorisation farming;
 *  - diminishing returns once past a daily soft cap.
 */
export function computeTestXp(i: TestXpInputs): number {
  const score = Math.max(0, Math.min(i.score, 9));
  const base = score * 10;
  const diffMult = i.difficulty === "Hard" ? 1.15 : i.difficulty === "Easy" ? 0.9 : 1.0;
  const improvement = i.recentAvg > 0 ? Math.max(0, score - i.recentAvg) * 20 : 0;
  const repeatDecay = 1 / (1 + Math.max(0, i.repeatCount));

  let xp = (base + improvement) * diffMult * repeatDecay;
  if (i.dailyXpSoFar >= DAILY_SOFT_CAP) xp *= 0.25;

  return Math.max(0, Math.round(xp));
}
