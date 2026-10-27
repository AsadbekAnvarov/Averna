/**
 * Idempotent spaced-repetition reviews (idea 7, "Instant and offline").
 *
 * A grade made offline (or whose save failed) waits in a queue on the device and is sent
 * later with its client id and the moment it was made (`reviewedAt`). The server keeps no
 * extra column for this: the card's `lastReviewedAt` is set to exactly that moment, so
 *   - the same grade sent twice finds `lastReviewedAt === reviewedAt` → duplicate, ignored;
 *   - a grade older than the card's last review → stale: the server state wins (the card was
 *     reviewed online, on this or another device, after the grade was made);
 *   - otherwise it is scheduled with the same SM-2 maths as the client (lib/srs.ts), as of
 *     `reviewedAt` — so a card studied offline ends up exactly where the device put it.
 * Grades without `reviewedAt` (older clients, the recall games) behave as before: scheduled now.
 *
 * Pure: shared by POST /api/srs/review and the offline study view.
 */
import { schedule, type Rating, type SrsCardState } from "@/lib/srs";

/** A device clock may run a little fast; later than this is refused. */
export const REVIEW_CLOCK_SKEW_MS = 10 * 60_000;
/** Queued grades older than this are refused (the device was offline for too long to trust them). */
export const REVIEW_MAX_AGE_MS = 60 * 86_400_000;
/** Client ids: UUIDs or similar, nothing else. */
export const CLIENT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export type ReviewStatus = "applied" | "duplicate" | "stale" | "invalid";

export interface ExistingReview {
  state: SrsCardState;
  /** Epoch ms of the card's last recorded review. */
  lastReviewedAt: number;
}

export type ReviewDecision =
  | { status: "applied"; at: number; next: SrsCardState; wasDue: boolean }
  | { status: "duplicate" | "stale"; at: number }
  | { status: "invalid" };

/** A usable `reviewedAt`: a whole number of ms inside [now − max age, now + skew]. */
export function validReviewedAt(reviewedAt: unknown, now: number): reviewedAt is number {
  return (
    typeof reviewedAt === "number" &&
    Number.isInteger(reviewedAt) &&
    reviewedAt <= now + REVIEW_CLOCK_SKEW_MS &&
    reviewedAt >= now - REVIEW_MAX_AGE_MS
  );
}

/**
 * What to do with one review of a card.
 * @param existing the card's server row (null: never reviewed)
 * @param reviewedAt when the grade was made on the device (undefined: an online review, now)
 * @param now the server's clock
 */
export function decideReview(
  existing: ExistingReview | null,
  rating: Rating,
  reviewedAt: number | undefined,
  now: number,
): ReviewDecision {
  if (reviewedAt === undefined) {
    return { status: "applied", at: now, next: schedule(existing?.state, rating, now), wasDue: !existing || existing.state.due <= now };
  }
  if (!validReviewedAt(reviewedAt, now)) return { status: "invalid" };
  if (existing && existing.lastReviewedAt === reviewedAt) return { status: "duplicate", at: reviewedAt };
  if (existing && existing.lastReviewedAt > reviewedAt) return { status: "stale", at: reviewedAt };
  return {
    status: "applied",
    at: reviewedAt,
    next: schedule(existing?.state, rating, reviewedAt),
    wasDue: !existing || existing.state.due <= reviewedAt,
  };
}

/** One grade as the device keeps it and sends it. */
export interface GradeInput {
  itemKey: string;
  rating: Rating;
  reviewedAt: number;
}

/**
 * The server's ledger after a list of grades (in order), using decideReview for each —
 * a model of POST /api/srs/review for the tests and for reasoning about replays.
 */
export function replayGrades(
  ledger: Record<string, ExistingReview>,
  grades: GradeInput[],
  now: number,
): Record<string, ExistingReview> {
  const out: Record<string, ExistingReview> = { ...ledger };
  for (const g of grades) {
    const d = decideReview(out[g.itemKey] ?? null, g.rating, g.reviewedAt, now);
    if (d.status === "applied") out[g.itemKey] = { state: d.next, lastReviewedAt: d.at };
  }
  return out;
}
