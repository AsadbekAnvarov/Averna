/**
 * What GET /api/speaking/session/[roomId] returns (docs/peer-speaking.md §4) — also used
 * by the room page for its first render. Pure and client-safe.
 */
import { isDone, isPeerSessionState, type PeerSessionState, type Seat } from "./session";
import type { PeerXpHold } from "./xp-rules";

export interface SessionPerson {
  seat: Seat;
  firstName: string;
  level: number | null;
}

export interface SessionView {
  roomId: string;
  status: string;
  format: string;
  topic: string;
  state: PeerSessionState | null;
  version: number;
  serverNow: number;
  /** When the pair was matched (epoch ms), for the session length on the done screen. */
  createdAt: number | null;
  me: SessionPerson;
  partner: SessionPerson;
  /** XP the caller got for a naturally finished session; null otherwise. */
  xp: number | null;
  /** Once done: why the caller got no XP (lib/speaking/xp-rules.ts), else null. */
  xpHold: PeerXpHold | null;
}

/** Why the caller's seat earned no XP: stored by the finishing POST, or "unfinished" for an early end. */
export function xpHoldFor(state: PeerSessionState | null, seat: Seat): PeerXpHold | null {
  if (!state || !isDone(state)) return null;
  if (state.endedBy !== null) return "unfinished";
  return state.xpHold?.[seat] ?? null;
}

export interface SessionRoomRow {
  id: string;
  topic: string;
  format: string;
  status: string;
  state: unknown;
  version: number;
  studentAId: string;
  studentAName: string;
  studentBId: string;
  studentBName: string;
  createdAt?: Date | null;
}

export function sessionView(room: SessionRoomRow, seat: Seat, now: number, xp: number | null = null): SessionView {
  const state = isPeerSessionState(room.state) ? room.state : null;
  const person = (s: Seat): SessionPerson => ({
    seat: s,
    firstName: s === "A" ? room.studentAName : room.studentBName,
    level: state ? state.levels[s] : null,
  });
  return {
    roomId: room.id,
    status: room.status,
    format: room.format,
    topic: room.topic,
    state,
    version: room.version,
    serverNow: now,
    createdAt: room.createdAt instanceof Date ? room.createdAt.getTime() : null,
    me: person(seat),
    partner: person(seat === "A" ? "B" : "A"),
    xp,
    xpHold: xpHoldFor(state, seat),
  };
}

/**
 * Peer feedback is open once the room has ENDED, if the first timed phase was reached
 * (a natural finish, or time was spent in a timed phase before an early end).
 */
export function feedbackAllowed(status: string, state: PeerSessionState | null): boolean {
  if (status !== "ENDED" || !state || !isDone(state)) return false;
  return state.endedBy === null || (state.timedMs ?? 0) > 0;
}

/** A session that finished naturally (both rounds), the only kind that earns XP. */
export const finishedNaturally = (state: PeerSessionState | null): boolean =>
  !!state && isDone(state) && state.endedBy === null;
