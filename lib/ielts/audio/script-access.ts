import { isCdMock } from "../mock-policy";
/**
 * Who may read a recorded Listening part's script — GET /api/listening/script,
 * the runner's fail-open fallback (./script). Only the student whose run needs
 * it, and only the part asked for:
 *
 *   practice   the library / generated test (getListeningExam, like the
 *              practice page) — refused while it is the paper of the student's
 *              running mock section (paperLockedByMock: its answers would leak);
 *   mock       the student's active mock is in its Listening section, the
 *              section clock has started (sectionStartedAt) and its Listening
 *              paper (papers.listening) is this test;
 *   placement  the student's active placement sitting is in its Listening
 *              section (plan.sections[current]), that section's clock has
 *              started (draft), and this is the Listening test of the sitting's
 *              form.
 *
 * Exam conditions (mock, placement) — the section clock: part k is served only
 * once the section has been running (now − sectionStartedAt, or now − the
 * placement draft's startedAt) for at least the earliest moment part k can
 * start playing, less a minute of slack (partStartsMs, SCRIPT_SLACK_MS). That
 * moment is the sum of the earlier parts' shortest lengths: the served
 * recording's durationMs, or ¾ of the browser-voice estimate for a part read by
 * browser voices. The section clock starts before the runner can play anything
 * and a recording plays at 1× under exam conditions, so real playback is never
 * ahead of it; asked earlier, the answer is 403 "not_yet" with the seconds to
 * wait (the runner waits and asks again). Every script served under exam
 * conditions carries an audit record (the route logs it: auditLine). Part 1 —
 * and so the one-part placement Listening — is open from the section's start.
 * Practice has no clock.
 *
 * Pure: the route passes the database reads in (ScriptDeps), so the rules are
 * checked offline. Never import it from client code (server rules only).
 */

import { estimatePartSeconds } from "../format";
import type { ExamListeningTest, ScriptLine } from "../types";
import { isScriptContext } from "./script";
import type { ScriptContext, ScriptResponse } from "./script";

export interface ScriptQuery {
  testId: string;
  /** Part index in the full test (0-based). */
  part: number;
  context: ScriptContext;
}

const TEST_ID_RE = /^[A-Za-z0-9_.:-]{1,200}$/;

/** testId (library, generated or placement id), part (0–9) and context — anything else is a 400. */
export function parseScriptQuery(params: { get(name: string): string | null }): ScriptQuery | null {
  const testId = (params.get("testId") ?? "").trim();
  const part = (params.get("part") ?? "").trim();
  const context = (params.get("context") ?? "").trim();
  if (!TEST_ID_RE.test(testId) || !/^\d$/.test(part) || !isScriptContext(context)) return null;
  return { testId, part: Number(part), context };
}

const asRec = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;

/** A timestamp column or draft field (Date, ISO string or epoch ms) as epoch ms; null when it isn't one. */
function timeOf(x: unknown): number | null {
  if (x == null || x === "") return null;
  const t = x instanceof Date ? x.getTime() : typeof x === "number" ? x : typeof x === "string" ? Date.parse(x) : NaN;
  return Number.isFinite(t) ? t : null;
}

const idOf = (x: unknown): string | null => (typeof x === "string" && x ? x : null);

/** MockAttempt columns the rule reads. */
export interface MockRowLike {
  id?: unknown;
  status?: unknown;
  current?: unknown;
  sectionStartedAt?: unknown;
  papers?: unknown;
}

/** PlacementAttempt columns the rule reads. */
export interface PlacementRowLike {
  id?: unknown;
  status?: unknown;
  current?: unknown;
  plan?: unknown;
  draft?: unknown;
}

export interface PlacementPlanLike {
  form: string;
  sections: readonly string[];
}

/** An active mock whose Listening section is running (clock started) on paper `testId`. */
export function mockListeningOpen(row: MockRowLike | null | undefined, testId: string, sections: readonly string[]): boolean {
  if (!row || row.status !== "active") return false;
  const current = row.current;
  if (typeof current !== "number" || !Number.isInteger(current) || sections[current] !== "LISTENING") return false;
  if (timeOf(row.sectionStartedAt) == null) return false;
  return asRec(row.papers)?.listening === testId;
}

/**
 * An active placement sitting whose current section is Listening with its clock
 * started (the running section's draft: { section: current, startedAt, deadline }),
 * on a form whose Listening test is `testId` (`listeningId` = that form's test id).
 */
export function placementListeningOpen(
  row: PlacementRowLike | null | undefined,
  plan: PlacementPlanLike | null,
  listeningId: string | null,
  testId: string
): boolean {
  if (!row || row.status !== "active" || !plan) return false;
  const current = row.current;
  if (typeof current !== "number" || !Number.isInteger(current) || plan.sections[current] !== "LISTENING") return false;
  const draft = asRec(row.draft);
  if (!draft || draft.section !== current) return false;
  const startedAt = Number(draft.startedAt);
  const deadline = Number(draft.deadline);
  if (!Number.isFinite(startedAt) || !Number.isFinite(deadline) || deadline <= startedAt) return false;
  return !!listeningId && listeningId === testId;
}

/** One part's script in the client shape (what a part without a recording carries); null when there is none. */
export function partScript(test: Pick<ExamListeningTest, "parts">, part: number): ScriptLine[] | null {
  if (!Number.isInteger(part) || part < 0) return null;
  const p = test.parts[part];
  if (!p || !Array.isArray(p.script)) return null;
  const lines = p.script
    .filter((l): l is ScriptLine => !!l && typeof l === "object")
    .map((l) => {
      const line: ScriptLine = { speaker: String(l.speaker ?? ""), text: String(l.text ?? "") };
      const pause = Number(l.pauseAfter);
      if (Number.isFinite(pause) && pause > 0) line.pauseAfter = pause;
      return line;
    });
  return lines.some((l) => l.text.trim()) ? lines : null;
}

// ---------------------------------------------------------------------------
// The section clock (exam conditions)
// ---------------------------------------------------------------------------

/** A part's script opens this long before the section clock reaches the part's earliest start. */
export const SCRIPT_SLACK_MS = 60_000;
/** Browser voices never read a part in less than this share of its estimate (estimatePartSeconds). */
export const VOICE_SHARE = 0.75;

/**
 * The earliest moment each part can start playing, in ms after the section
 * clock started: the sum of the earlier parts' shortest lengths — the served
 * recording's length (`recordingMs[i]`, what listeningClientContent sends:
 * ready, not stale, LISTENING_AUDIO not off), else VOICE_SHARE × the
 * browser-voice estimate of the part.
 */
export function partStartsMs(test: Pick<ExamListeningTest, "parts">, recordingMs: readonly (number | null | undefined)[]): number[] {
  const out: number[] = [];
  let at = 0;
  test.parts.forEach((p, i) => {
    out.push(at);
    const rec = recordingMs[i];
    if (typeof rec === "number" && Number.isFinite(rec) && rec > 0) at += rec;
    else at += Array.isArray(p?.script) ? estimatePartSeconds(p) * 1000 * VOICE_SHARE : 0;
  });
  return out;
}

/** When part `part`'s script opens (ms of section time; negative for Part 1: open from the start). */
export function scriptOpensAtMs(test: Pick<ExamListeningTest, "parts">, recordingMs: readonly (number | null | undefined)[], part: number): number {
  return (partStartsMs(test, recordingMs)[part] ?? 0) - SCRIPT_SLACK_MS;
}

/** One script request under exam conditions, for the log (who, which sitting, which part, how far into the section). */
export interface ScriptAudit {
  context: "mock" | "placement";
  studentId: string;
  /** The MockAttempt / PlacementAttempt id. */
  attemptId: string | null;
  testId: string;
  /** Part index (0-based, as asked). */
  part: number;
  /** Section time when it was asked. */
  elapsedMs: number;
  /** Section time from which the part's script is served. */
  opensAtMs: number;
}

/** The audit line the route logs: `[listening-script] served context=mock student=… attempt=… test=… partNo=2 elapsedSec=… opensAtSec=…`. */
export function auditLine(event: "served" | "refused-early", a: ScriptAudit): string {
  const sec = (ms: number) => Math.round(ms / 1000);
  return (
    `[listening-script] ${event} context=${a.context} student=${a.studentId} attempt=${a.attemptId ?? "-"} ` +
    `test=${a.testId} partNo=${a.part + 1} elapsedSec=${sec(a.elapsedMs)} opensAtSec=${sec(a.opensAtMs)}`
  );
}

// ---------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------

/** The database reads the rules need (see the route). */
export interface ScriptDeps {
  /** Library / generated test, resolved as the practice page and the mock resolve it (getListeningExam). */
  catalogTest(id: string): Promise<ExamListeningTest | null>;
  /** The paper of the student's running mock section (paperLockedByMock). */
  paperLocked(studentId: string, testId: string): Promise<boolean>;
  /** The student's active mock attempts (normally at most one). */
  activeMocks(studentId: string): Promise<MockRowLike[]>;
  /** MOCK_SECTIONS: section name by MockAttempt.current. */
  mockSections: readonly string[];
  /** The student's active placement sittings (normally at most one). */
  activePlacements(studentId: string): Promise<PlacementRowLike[]>;
  /** planOf (lib/placement/placement). */
  placementPlan(raw: unknown): PlacementPlanLike | null;
  /** The Listening test of a placement form (lib/placement/content). */
  placementListening(formId: string): ExamListeningTest | null;
  /**
   * Per part, the length (ms) of the recording the test is served with right
   * now — null for a part read by browser voices (listeningClientContent).
   */
  servedRecordingMs(test: ExamListeningTest): Promise<(number | null)[]>;
  /** Date.now (tests pass their own clock). */
  now?: () => number;
}

export type ScriptDecision =
  | { ok: true; body: ScriptResponse; audit?: ScriptAudit }
  | { ok: false; status: 403 | 404; code: "forbidden" | "not_found"; error: string }
  | { ok: false; status: 403; code: "not_yet"; error: string; retryAfterSec: number; audit: ScriptAudit };

const NOT_FOUND: ScriptDecision = { ok: false, status: 404, code: "not_found", error: "This Listening test or part couldn't be found." };
const forbidden = (error: string): ScriptDecision => ({ ok: false, status: 403, code: "forbidden", error });

export async function decideScript(q: ScriptQuery, studentId: string, deps: ScriptDeps): Promise<ScriptDecision> {
  let test: ExamListeningTest | null = null;
  /** Exam conditions: when the running section's clock started, and whose sitting it is. */
  let clock: { context: "mock" | "placement"; start: number; attemptId: string | null } | null = null;
  switch (q.context) {
    case "practice": {
      test = await deps.catalogTest(q.testId);
      if (!test) return NOT_FOUND;
      if (await deps.paperLocked(studentId, test.id)) {
        return forbidden("This paper is part of your mock exam in progress. Finish that section first, then practise it here.");
      }
      break;
    }
    case "mock": {
      for (const r of await deps.activeMocks(studentId)) {
        const start = timeOf(r.sectionStartedAt);
        if (start == null || !mockListeningOpen(r, q.testId, deps.mockSections)) continue;
        if (isCdMock(r.papers)) return forbidden("This computer mock uses existing recordings only. Script fallback is not available.");
        // (Normally one running mock; with more, the longest-running clock.)
        if (!clock || start < clock.start) clock = { context: "mock", start, attemptId: idOf(r.id) };
      }
      if (!clock) return forbidden("This isn't the Listening section of your mock exam in progress.");
      test = await deps.catalogTest(q.testId);
      if (!test) return NOT_FOUND;
      break;
    }
    case "placement": {
      for (const row of await deps.activePlacements(studentId)) {
        const plan = deps.placementPlan(row.plan);
        const listening = plan ? deps.placementListening(plan.form) : null;
        if (!listening || !placementListeningOpen(row, plan, listening.id, q.testId)) continue;
        const start = Number(asRec(row.draft)?.startedAt);
        if (!clock || start < clock.start) {
          test = listening;
          clock = { context: "placement", start, attemptId: idOf(row.id) };
        }
      }
      if (!test || !clock) return forbidden("This isn't the Listening section of your placement test in progress.");
      break;
    }
  }
  const script = partScript(test, q.part);
  if (!script) return NOT_FOUND;
  const body: ScriptResponse = { testId: test.id, part: q.part, script };
  if (!clock) return { ok: true, body };

  // Exam conditions: not before the section clock reaches this part (less the slack).
  const recordings = await deps.servedRecordingMs(test).catch((): (number | null)[] => []);
  const now = deps.now ? deps.now() : Date.now();
  const elapsedMs = now - clock.start;
  const opensAtMs = scriptOpensAtMs(test, recordings, q.part);
  const audit: ScriptAudit = { context: clock.context, studentId, attemptId: clock.attemptId, testId: test.id, part: q.part, elapsedMs, opensAtMs };
  if (elapsedMs < opensAtMs) {
    return {
      ok: false,
      status: 403,
      code: "not_yet",
      error: `Part ${q.part + 1} of the recording hasn't started yet.`,
      retryAfterSec: Math.max(1, Math.ceil((opensAtMs - elapsedMs) / 1000)),
      audit,
    };
  }
  return { ok: true, body, audit };
}
