/**
 * Fail-open fallback for recorded Listening parts — what the runner and
 * GET /api/listening/script share.
 *
 * A part with a ready recording reaches the browser without its script
 * (lib/ielts/audio/client). When that recording can't be played — the Blob file
 * was deleted or replaced mid-sitting, the store is restricted, the CDN is
 * blocked — the runner asks for THAT part's script and carries on with browser
 * voices from where the recording stopped. The server hands it out only to the
 * student whose run it is (lib/ielts/audio/script-access) and, under exam
 * conditions, only once the section clock has reached that part: earlier it
 * answers 403 "not_yet" with `retryAfterSec`, and the runner waits and asks
 * again (a genuine fallback is delayed at worst, never refused).
 *
 * Pure and client-safe.
 */

import type { ScriptLine } from "../types";

export const SCRIPT_CONTEXTS = ["practice", "mock", "placement"] as const;
/** Whose rules apply: Listening practice, the mock exam, or the placement test. */
export type ScriptContext = (typeof SCRIPT_CONTEXTS)[number];

/** 200 */
export interface ScriptResponse {
  testId: string;
  /** Part index in the full test (0-based). */
  part: number;
  /** The part's script, as a part without a recording has it (ClientListeningPart.script). */
  script: ScriptLine[];
}

/** not_yet (403): exam conditions, and the section clock hasn't reached this part yet — ask again after `retryAfterSec`. */
export type ScriptErrorCode = "invalid" | "auth" | "forbidden" | "not_yet" | "not_found" | "server";

/** 400 / 401 / 403 / 404 / 500 */
export interface ScriptErrorBody {
  error: string;
  code: ScriptErrorCode;
  /** not_yet: seconds until the part's script opens (also sent as Retry-After). */
  retryAfterSec?: number;
}

/** More lines than any real part has (the longest seed part has ~60). */
export const MAX_SCRIPT_LINES = 400;

export function isScriptContext(v: unknown): v is ScriptContext {
  return typeof v === "string" && (SCRIPT_CONTEXTS as readonly string[]).includes(v);
}

/**
 * The run's context when the runner isn't told: practice mode → "practice";
 * exam conditions → "placement" for a placement form's Listening test (named
 * "placement-listening-…", lib/placement/content.ts), else "mock".
 */
export function runContext(mode: "practice" | "mock", testId: string): ScriptContext {
  if (mode === "practice") return "practice";
  return /^placement-/.test(testId) ? "placement" : "mock";
}

export function scriptUrl(testId: string, part: number, context: ScriptContext): string {
  const qs = new URLSearchParams({ testId, part: String(part), context });
  return `/api/listening/script?${qs.toString()}`;
}

/**
 * A 403 "not_yet" (the section clock hasn't reached the part): how long to
 * wait before asking again, in ms — from the body's `retryAfterSec`, else the
 * Retry-After header, else 5 s; null for any other response.
 */
export function scriptWaitMs(status: number, body: unknown, retryAfter: string | null): number | null {
  if (status !== 403 || !body || typeof body !== "object" || (body as { code?: unknown }).code !== "not_yet") return null;
  const fromBody = Number((body as { retryAfterSec?: unknown }).retryAfterSec);
  const fromHeader = Number(retryAfter);
  const sec = Number.isFinite(fromBody) && fromBody > 0 ? fromBody : Number.isFinite(fromHeader) && fromHeader > 0 ? fromHeader : 5;
  return Math.round(sec * 1000);
}

/**
 * Why browser voices couldn't take over a part: this browser has no speech
 * synthesis ("no-voices"), or the script request failed — offline / failed
 * (connection or server: Try again may fix it), denied / missing (refused), or
 * early (still "not_yet" after every wait).
 */
export type TakeoverFailure = "no-voices" | "offline" | "failed" | "denied" | "missing" | "early";

/**
 * Exam conditions: offer to go on to the next part (so the later recordings
 * still play) when this part can't be heard here — no speech synthesis, the
 * script refused (denied / missing / still not_yet) or its request failing on
 * the server's side (Try again stays offered next to it). Not while offline:
 * the next recording couldn't load either, so Try again it is.
 */
export function partCantBeHeard(why: TakeoverFailure): boolean {
  return why !== "offline";
}

/** Going on from the part at scope position `pos` of `count`: the next part, or the answer check after the last one. */
export function nextAfterPart(pos: number, count: number): { kind: "part"; pos: number } | { kind: "check" } {
  return pos + 1 < count ? { kind: "part", pos: pos + 1 } : { kind: "check" };
}

/** The script of a 200 response; null unless it is something browser voices can read. */
export function readScriptLines(body: unknown): ScriptLine[] | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as { script?: unknown }).script;
  if (!Array.isArray(raw) || !raw.length || raw.length > MAX_SCRIPT_LINES) return null;
  const out: ScriptLine[] = [];
  for (const l of raw) {
    if (!l || typeof l !== "object") return null;
    const o = l as Record<string, unknown>;
    if (typeof o.speaker !== "string" || typeof o.text !== "string") return null;
    const line: ScriptLine = { speaker: o.speaker, text: o.text };
    const pause = Number(o.pauseAfter);
    if (o.pauseAfter != null && Number.isFinite(pause) && pause > 0) line.pauseAfter = pause;
    out.push(line);
  }
  return out.some((l) => l.text.trim()) ? out : null;
}
