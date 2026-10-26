/**
 * Fair XP for peer speaking (docs/peer-speaking.md, Phase C). Pure and client-safe.
 * A finished session pays XP only when:
 *   (a) the pair really spent ≥ 50% of the plan's timed duration in timed phases,
 *   (b) this student hasn't already earned peer XP with the same partner today (Tashkent),
 *   (c) this student has fewer than 3 peer-speaking awards today.
 */
import { plannedTimedMs, type PeerSessionState } from "./session";

export const MIN_TIMED_SHARE = 0.5;
export const PAIR_AWARDS_PER_DAY = 1;
export const PEER_AWARDS_PER_DAY = 3;

export type PeerXpHold = "unfinished" | "pair" | "daily";

export const XP_HOLD_TEXT: Record<PeerXpHold, string> = {
  unfinished: "Finish both rounds to earn XP",
  pair: "XP is limited to one session per partner per day",
  daily: "Daily peer-speaking XP limit reached",
};

export interface PeerXpInput {
  /** Both rounds finished (not ended early). */
  natural: boolean;
  timedMs: number;
  plannedMs: number;
  /** Peer awards this student already got today with the same partner. */
  pairAwardsToday: number;
  /** Peer awards this student already got today (any partner). */
  awardsToday: number;
}

/** Why no XP is paid, or null when it is. Checked in order: unfinished → pair → daily. */
export function peerXpHold(i: PeerXpInput): PeerXpHold | null {
  if (!i.natural) return "unfinished";
  if (!(i.plannedMs > 0) || !(i.timedMs >= i.plannedMs * MIN_TIMED_SHARE)) return "unfinished";
  if (i.pairAwardsToday >= PAIR_AWARDS_PER_DAY) return "pair";
  if (i.awardsToday >= PEER_AWARDS_PER_DAY) return "daily";
  return null;
}

/** Did the pair spend enough time in timed phases? (rule a, state only) */
export const enoughTimed = (state: PeerSessionState): boolean =>
  (state.timedMs ?? 0) >= plannedTimedMs(state) * MIN_TIMED_SHARE;
