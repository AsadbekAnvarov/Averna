/**
 * Offline flashcard study (idea 7). The same spaced-repetition maths as online (lib/srs.ts):
 * a grade made offline is scheduled on the device as of the moment it was made, and the
 * server schedules the queued grade as of that same moment (lib/srs-sync.ts), so both end
 * up with the same state. Pure.
 */
import { isDue, isNew, schedule, type Rating, type SrsCardState, type SrsMap } from "@/lib/srs";
import { DUE_PACK_MAX } from "./constants";
import type { OfflineCard } from "./packs";

/** New words per study session, as in the online review (components/learning/srs-review.tsx). */
export const NEW_PER_SESSION = 20;

function unique(cards: readonly OfflineCard[]): OfflineCard[] {
  const seen = new Set<string>();
  return cards.filter((c) => (seen.has(c.key) ? false : (seen.add(c.key), true)));
}

/**
 * "Save my due cards": today's review queue as a snapshot — the cards due by `now` (most
 * overdue first), then up to NEW_PER_SESSION new ones, at most `max` in all.
 */
export function dueSnapshot(pool: readonly OfflineCard[], srs: SrsMap, now: number, max = DUE_PACK_MAX): OfflineCard[] {
  const cards = unique(pool);
  const due = cards
    .filter((c) => !isNew(srs[c.key]) && isDue(srs[c.key], now))
    .sort((a, b) => srs[a.key].due - srs[b.key].due);
  const fresh = cards.filter((c) => isNew(srs[c.key])).slice(0, NEW_PER_SESSION);
  return [...due, ...fresh].slice(0, Math.max(0, max));
}

/** The cards to study now in a saved pack: due ones first (most overdue first), then new ones, in pack order. */
export function studyQueue(cards: readonly OfflineCard[], srs: SrsMap, now: number): OfflineCard[] {
  return dueSnapshot(cards, srs, now, Number.MAX_SAFE_INTEGER);
}

/** One offline grade: the card's next state (schedule as of `at`) and the updated map. */
export function gradeOffline(srs: SrsMap, key: string, rating: Rating, at: number): { next: SrsCardState; srs: SrsMap } {
  const next = schedule(srs[key], rating, at);
  return { next, srs: { ...srs, [key]: next } };
}

/** When the next card of a pack is due (null when none has been studied). */
export function nextDueAt(cards: readonly OfflineCard[], srs: SrsMap): number | null {
  let best: number | null = null;
  for (const c of cards) {
    const s = srs[c.key];
    if (s && (best === null || s.due < best)) best = s.due;
  }
  return best;
}
