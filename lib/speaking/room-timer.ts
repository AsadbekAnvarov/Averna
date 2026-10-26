/**
 * Timer helpers for the peer room (pure, client-safe). The server stores `startAt` and
 * `durationSec` of the current timed phase; clients correct their clock with the
 * `serverNow` of each response.
 */
import type { PeerSessionState, PhaseSpec, SessionAction } from "./session";

/** Server time minus client time, from one request: serverNow vs the request's midpoint. */
export function clockOffset(serverNow: number, sentAt: number, receivedAt: number): number {
  return serverNow - (sentAt + receivedAt) / 2;
}

/** Milliseconds left on the current timer (may be negative), or null outside timed phases. */
export function timeLeftMs(state: Pick<PeerSessionState, "startAt" | "durationSec">, serverNow: number): number | null {
  if (state.startAt == null || state.durationSec == null) return null;
  return state.startAt + state.durationSec * 1000 - serverNow;
}

/** "2:05" (rounded up to the second, never negative). */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The spoken announcement when the timer crosses 1 minute, 30 seconds or zero. */
export function timerMark(prevMs: number | null, nextMs: number | null): string | null {
  if (prevMs == null || nextMs == null || nextMs >= prevMs) return null;
  if (prevMs > 0 && nextMs <= 0) return "Time is up";
  if (prevMs > 30_000 && nextMs <= 30_000) return "30 seconds left";
  if (prevMs > 60_000 && nextMs <= 60_000) return "1 minute left";
  return null;
}

/**
 * What the lead's client sends when the timer hits 0: `next` for a new conversation
 * card (the timer restarts) or on the last prompt; `skip` when a phase with one shared
 * timer (Part 1 / Part 3) still has questions left — time is up for the whole part.
 */
export function timeUpAction(phase: PhaseSpec, prompt: number): SessionAction {
  if (phase.timerPerPrompt || prompt >= phase.prompts - 1) return "next";
  return "skip";
}
