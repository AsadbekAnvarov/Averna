/**
 * Lightweight spaced-repetition engine (SM-2 flavoured) with localStorage
 * persistence. Keeps the flashcards feature backend-free while giving learners
 * a real "review at the right time" schedule — the biggest driver of both
 * retention and daily return.
 */

export type Rating = "again" | "hard" | "good" | "easy";

export interface SrsCardState {
  ease: number; // ease factor (>= 1.3)
  interval: number; // days until next review
  due: number; // epoch ms when the card is next due
  reps: number; // successful reviews in a row
  lapses: number; // times forgotten
}

export type SrsMap = Record<string, SrsCardState>;

const KEY = "averna_srs_v1";
const DAY = 86_400_000;

export function loadSrs(): SrsMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SrsMap) : {};
  } catch {
    return {};
  }
}

export function saveSrs(map: SrsMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — ignore */
  }
}

/** A card is due if it has never been seen, or its due time has passed. */
export function isDue(state: SrsCardState | undefined, now: number = Date.now()): boolean {
  return !state || state.due <= now;
}

/** True for cards the learner has never reviewed. */
export function isNew(state: SrsCardState | undefined): boolean {
  return !state;
}

/**
 * Compute the next SRS state from a rating. "again" relearns within the same
 * session (due in ~1 minute); the others push the card further out based on
 * the ease factor.
 */
export function schedule(prev: SrsCardState | undefined, rating: Rating, now: number = Date.now()): SrsCardState {
  let ease = prev?.ease ?? 2.5;
  let reps = prev?.reps ?? 0;
  let interval = prev?.interval ?? 0;
  let lapses = prev?.lapses ?? 0;

  if (rating === "again") {
    ease = Math.max(1.3, ease - 0.2);
    reps = 0;
    lapses += 1;
    interval = 0;
    return { ease, interval, due: now + 60_000, reps, lapses };
  }

  const q = rating === "hard" ? 3 : rating === "good" ? 4 : 5;
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  reps += 1;

  if (reps === 1) interval = rating === "easy" ? 3 : 1;
  else if (reps === 2) interval = rating === "easy" ? 6 : 3;
  else {
    const mult = rating === "hard" ? 1.2 : rating === "easy" ? ease * 1.3 : ease;
    interval = Math.round(interval * mult);
  }
  interval = Math.max(1, interval);

  return { ease, interval, due: now + interval * DAY, reps, lapses };
}

/** Human-friendly "next review" hint for each rating button. */
export function intervalHint(prev: SrsCardState | undefined, rating: Rating): string {
  if (rating === "again") return "1 min";
  const next = schedule(prev, rating);
  const d = next.interval;
  if (d < 1) return "today";
  if (d === 1) return "1 day";
  if (d < 30) return `${d} days`;
  const months = Math.round(d / 30);
  return months <= 1 ? "1 month" : `${months} months`;
}

/** Count how many of the given card keys are due right now. */
export function countDue(keys: string[], map: SrsMap, now: number = Date.now()): number {
  return keys.reduce((n, k) => n + (isDue(map[k], now) ? 1 : 0), 0);
}
