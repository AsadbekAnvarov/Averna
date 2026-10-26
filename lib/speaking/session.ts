/**
 * Peer speaking room state machine (docs/peer-speaking.md §4). Pure and client-safe:
 * the session API applies `advance` with optimistic concurrency, the room UI renders
 * `phasePlan` / `currentPhase`.
 *
 *   lobby (both ready) → timed phases of round 1 → swap → timed phases of round 2 → done
 *
 * Every timed phase has a `lead` (examiner, or the speaker whose turn it is) who alone
 * may move it on, and a `speaker` (who is talking or being examined). Either partner
 * may `end` at any time. Invalid actions return the SAME state object (a no-op).
 */
import type { PeerFormat } from "./matching";
import type { PeerContent } from "./peer-content";

export type Seat = "A" | "B";
export const SESSION_ACTIONS = ["ready", "start", "next", "skip", "end"] as const;
export type SessionAction = (typeof SESSION_ACTIONS)[number];

export function isSessionAction(v: unknown): v is SessionAction {
  return typeof v === "string" && (SESSION_ACTIONS as readonly string[]).includes(v);
}

export type PhaseKey =
  | "lobby"
  | "part1"
  | "part2-prep"
  | "part2-talk"
  | "part2-follow"
  | "part3"
  | "card"
  | "opening"
  | "rebuttal"
  | "swap"
  | "done";

export interface PhaseSpec {
  key: PhaseKey;
  kind: "lobby" | "timed" | "swap" | "done";
  /** 0 = first round, 1 = after the swap. */
  round: 0 | 1;
  /** Who may advance this phase (timed phases only). */
  lead: Seat | null;
  /** Who is speaking / being examined. */
  speaker: Seat | null;
  durationSec: number;
  /** Prompts shown one by one with `next` (questions, cards). */
  prompts: number;
  /** Conversation cards: the timer restarts with each new prompt. */
  timerPerPrompt: boolean;
  /** Debate: the side of `speaker`. */
  side?: "for" | "against";
}

export interface PeerSessionState {
  v: 1;
  format: PeerFormat;
  /** Examiner of round 1 (exam, quick), first card lead (conversation), first FOR speaker (debate). */
  starter: Seat;
  phase: number;
  prompt: number;
  ready: { A: boolean; B: boolean };
  /** Epoch ms when the current timer started; null outside timed phases. */
  startAt: number | null;
  durationSec: number | null;
  endedAt: number | null;
  endedBy: Seat | null;
  levels: { A: number; B: number };
  content: PeerContent;
  /**
   * Time actually spent in timed phases (ms), banked whenever a timer stops (next card,
   * next phase, skip, end); each stretch is capped at its timer × TIMED_CAP. States
   * saved before this field existed count as 0. XP needs ≥ 50% of plannedTimedMs.
   */
  timedMs?: number;
  /** Set by the server when a natural finish earned no XP for a seat (lib/speaking/xp-rules.ts). */
  xpHold?: Partial<Record<Seat, "unfinished" | "pair" | "daily">>;
}

export const other = (s: Seat): Seat => (s === "A" ? "B" : "A");

export const DURATIONS = {
  part1: 240,
  part2Prep: 60,
  part2Talk: 120,
  part2Follow: 45,
  part3: 240,
  card: 120,
  opening: 120,
  rebuttal: 60,
} as const;

const timed = (
  key: PhaseKey,
  round: 0 | 1,
  lead: Seat,
  speaker: Seat,
  durationSec: number,
  prompts = 1,
  extra: Partial<PhaseSpec> = {},
): PhaseSpec => ({ key, kind: "timed", round, lead, speaker, durationSec, prompts: Math.max(1, prompts), timerPerPrompt: false, ...extra });

const LOBBY: PhaseSpec = { key: "lobby", kind: "lobby", round: 0, lead: null, speaker: null, durationSec: 0, prompts: 1, timerPerPrompt: false };
const SWAP: PhaseSpec = { key: "swap", kind: "swap", round: 1, lead: null, speaker: null, durationSec: 0, prompts: 1, timerPerPrompt: false };
const DONE: PhaseSpec = { key: "done", kind: "done", round: 1, lead: null, speaker: null, durationSec: 0, prompts: 1, timerPerPrompt: false };

function roundPhases(content: PeerContent, round: 0 | 1, starter: Seat): PhaseSpec[] {
  const lead = round === 0 ? starter : other(starter);
  switch (content.format) {
    case "exam": {
      const r = content.rounds[round];
      const cand = other(lead);
      return [
        timed("part1", round, lead, cand, DURATIONS.part1, r.part1.length),
        timed("part2-prep", round, lead, cand, DURATIONS.part2Prep),
        timed("part2-talk", round, lead, cand, DURATIONS.part2Talk),
        timed("part3", round, lead, cand, DURATIONS.part3, r.part3.questions.length),
      ];
    }
    case "quick": {
      const cand = other(lead);
      return [
        timed("part2-prep", round, lead, cand, DURATIONS.part2Prep),
        timed("part2-talk", round, lead, cand, DURATIONS.part2Talk),
        timed("part2-follow", round, lead, cand, DURATIONS.part2Follow),
      ];
    }
    case "conversation":
      return [timed("card", round, lead, lead, DURATIONS.card, content.rounds[round].length, { timerPerPrompt: true })];
    case "debate": {
      // Round 0: `starter` argues FOR; after the swap the sides change.
      const pro = lead;
      const con = other(lead);
      return [
        timed("opening", round, pro, pro, DURATIONS.opening, 1, { side: "for" }),
        timed("opening", round, con, con, DURATIONS.opening, 1, { side: "against" }),
        timed("rebuttal", round, pro, pro, DURATIONS.rebuttal, 1, { side: "for" }),
        timed("rebuttal", round, con, con, DURATIONS.rebuttal, 1, { side: "against" }),
      ];
    }
  }
}

/** All phases of a session, in order. */
export function phasePlan(state: Pick<PeerSessionState, "content" | "starter">): PhaseSpec[] {
  return [LOBBY, ...roundPhases(state.content, 0, state.starter), SWAP, ...roundPhases(state.content, 1, state.starter), DONE];
}

export function currentPhase(state: PeerSessionState): PhaseSpec {
  const plan = phasePlan(state);
  return plan[Math.min(state.phase, plan.length - 1)];
}

/** A timed stretch counts for at most its timer × this (a forgotten tab can't farm time). */
export const TIMED_CAP = 1.5;

/** The plan's total timed duration in ms (conversation cards: one timer per card). */
export function plannedTimedMs(state: Pick<PeerSessionState, "content" | "starter">): number {
  return phasePlan(state)
    .filter((p) => p.kind === "timed")
    .reduce((sum, p) => sum + p.durationSec * 1000 * (p.timerPerPrompt ? p.prompts : 1), 0);
}

/** `timedMs` plus the running timer's stretch (capped), when a timer is running. */
function banked(state: PeerSessionState, now: number): number {
  const before = state.timedMs ?? 0;
  if (state.startAt === null || !state.durationSec) return before;
  const stretch = Math.min(Math.max(0, now - state.startAt), state.durationSec * 1000 * TIMED_CAP);
  return before + stretch;
}

export function initialSessionState(content: PeerContent, starter: Seat, levels: { A: number; B: number }): PeerSessionState {
  return {
    v: 1,
    format: content.format,
    starter,
    phase: 0,
    prompt: 0,
    ready: { A: false, B: false },
    startAt: null,
    durationSec: null,
    endedAt: null,
    endedBy: null,
    levels,
    content,
    timedMs: 0,
  };
}

/** Who may move the session on right now (start from lobby/swap, next/skip in a timed phase). */
export function advancer(state: PeerSessionState): Seat | null {
  const plan = phasePlan(state);
  const p = plan[state.phase];
  if (!p) return null;
  if (p.kind === "timed") return p.lead;
  if (p.kind === "lobby" || p.kind === "swap") return plan[state.phase + 1]?.lead ?? null;
  return null;
}

function enter(state: PeerSessionState, plan: PhaseSpec[], index: number, now: number): PeerSessionState {
  const p = plan[index];
  const timedMs = banked(state, now);
  if (p.kind === "done") return { ...state, phase: index, prompt: 0, startAt: null, durationSec: null, endedAt: now, endedBy: null, timedMs };
  if (p.kind === "timed") return { ...state, phase: index, prompt: 0, startAt: now, durationSec: p.durationSec, timedMs };
  return { ...state, phase: index, prompt: 0, startAt: null, durationSec: null, timedMs };
}

/** Apply one action by `by` at `now`. Returns the same object when the action is not allowed. */
export function advance(state: PeerSessionState, action: SessionAction, by: Seat, now: number): PeerSessionState {
  const plan = phasePlan(state);
  const index = Math.min(state.phase, plan.length - 1);
  const p = plan[index];
  if (p.kind === "done") return state;

  switch (action) {
    case "end":
      return { ...state, phase: plan.length - 1, prompt: 0, startAt: null, durationSec: null, endedAt: now, endedBy: by, timedMs: banked(state, now) };
    case "ready":
      if (p.kind !== "lobby" || state.ready[by]) return state;
      return { ...state, ready: { ...state.ready, [by]: true } };
    case "start":
      if (p.kind === "lobby" && !(state.ready.A && state.ready.B)) return state;
      if (p.kind !== "lobby" && p.kind !== "swap") return state;
      if (advancer(state) !== by) return state;
      return enter(state, plan, index + 1, now);
    case "next":
      if (p.kind !== "timed" || p.lead !== by) return state;
      if (state.prompt < p.prompts - 1) {
        return p.timerPerPrompt
          ? { ...state, prompt: state.prompt + 1, startAt: now, durationSec: p.durationSec, timedMs: banked(state, now) }
          : { ...state, prompt: state.prompt + 1 };
      }
      return enter(state, plan, index + 1, now);
    case "skip":
      if (p.kind !== "timed" || p.lead !== by) return state;
      return enter(state, plan, index + 1, now);
  }
}

/** `advance` plus the version counter: it moves only when the state changed. */
export function applyVersioned(
  state: PeerSessionState,
  version: number,
  action: SessionAction,
  by: Seat,
  now: number,
): { state: PeerSessionState; version: number; changed: boolean } {
  const next = advance(state, action, by, now);
  return next === state ? { state, version, changed: false } : { state: next, version: version + 1, changed: true };
}

export const isDone = (state: PeerSessionState) => currentPhase(state).kind === "done";

/** Runtime check for state read back from the database (Json column). */
export function isPeerSessionState(v: unknown): v is PeerSessionState {
  if (!v || typeof v !== "object") return false;
  const s = v as Partial<PeerSessionState>;
  return (
    s.v === 1 &&
    typeof s.phase === "number" &&
    typeof s.prompt === "number" &&
    (s.starter === "A" || s.starter === "B") &&
    !!s.ready &&
    !!s.levels &&
    !!s.content &&
    typeof s.content === "object" &&
    s.format === (s.content as PeerContent).format
  );
}
