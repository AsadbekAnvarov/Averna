/**
 * Live speaking partner — cost limits (docs/elegance-roadmap.md, idea 3). Pure: the
 * env readers take the environment as an argument, the quota maths takes numbers.
 *
 *   REALTIME_STUDENT_MINUTES_PER_DAY  per student per Tashkent day (default 10)
 *   REALTIME_MAX_CALL_SECONDS         one call (default 240, clamped to 60–270 so the
 *                                     start route's after() hard stop fits the 300 s
 *                                     Fluid default function duration)
 *   REALTIME_DAILY_MINUTES_CAP        all students together per Tashkent day (default 300)
 *
 * Accounting (lib/realtime/live-store.ts): every call is one ActivityLog row whose
 * `seconds` is the FULL reservation while the call is open and the actual length once
 * it is settled. Usage today = the sum over today's rows. A start reserves, then counts
 * again WITH its own row and rolls the row back when that count is over a cap — so
 * concurrent starts can only be refused too often, never let through too often.
 */

/** Longest call allowed whatever the env says: after() waits this + the grace inside a 300 s function. */
export const MAX_CALL_SECONDS_CEILING = 270;
export const MIN_MAX_CALL_SECONDS = 60;
/** A call shorter than this isn't worth starting ("today's minutes are used up"). */
export const MIN_CALL_SECONDS = 30;
/** The server hangs up this long after the reserved length (the client ends itself at the limit). */
export const HARD_STOP_GRACE_SECONDS = 5;
/** Largest SDP offer the start route accepts (a browser audio offer is ~3–6 KB). */
export const SDP_MAX_BYTES = 20_000;

export interface LiveLimits {
  studentSecondsPerDay: number;
  maxCallSeconds: number;
  globalSecondsPerDay: number;
}

type Env = Record<string, string | undefined>;

function envNumber(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  if (raw == null || String(raw).trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function liveLimits(env: Env = process.env): LiveLimits {
  const maxCall = Math.round(envNumber(env, "REALTIME_MAX_CALL_SECONDS", 240));
  return {
    studentSecondsPerDay: Math.round(envNumber(env, "REALTIME_STUDENT_MINUTES_PER_DAY", 10) * 60),
    maxCallSeconds: Math.min(MAX_CALL_SECONDS_CEILING, Math.max(MIN_MAX_CALL_SECONDS, maxCall)),
    globalSecondsPerDay: Math.round(envNumber(env, "REALTIME_DAILY_MINUTES_CAP", 300) * 60),
  };
}

// ---------------------------------------------------------------------------
// Quota maths
// ---------------------------------------------------------------------------

export interface LiveUsageRow {
  studentId: string;
  createdAt: Date | number;
  /** Reserved while open, actual once settled. */
  seconds: number;
}

const ms = (d: Date | number) => (typeof d === "number" ? d : d.getTime());
const secs = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/** Seconds used since `since` (a Tashkent day start), by one student or (without `studentId`) by everyone. */
export function usedSeconds(rows: readonly LiveUsageRow[], since: Date | number, studentId?: string): number {
  const from = ms(since);
  let total = 0;
  for (const r of rows) {
    if (ms(r.createdAt) < from) continue;
    if (studentId !== undefined && r.studentId !== studentId) continue;
    total += secs(r.seconds);
  }
  return total;
}

/** Seconds left today for a student: the smaller of their own and the global remainder (≥ 0). */
export function remainingSeconds(l: LiveLimits, usedStudent: number, usedGlobal: number): number {
  return Math.max(0, Math.floor(Math.min(l.studentSecondsPerDay - usedStudent, l.globalSecondsPerDay - usedGlobal)));
}

/** Length to reserve for a new call (0–maxCallSeconds). Below MIN_CALL_SECONDS the start is refused. */
export function reservationSeconds(l: LiveLimits, usedStudent: number, usedGlobal: number): number {
  return Math.min(l.maxCallSeconds, remainingSeconds(l, usedStudent, usedGlobal));
}

/** Which cap a usage total breaks (student first), or null. Called with totals that INCLUDE the new reservation. */
export function capExceeded(l: LiveLimits, usedStudent: number, usedGlobal: number): "student" | "global" | null {
  if (usedStudent > l.studentSecondsPerDay) return "student";
  if (usedGlobal > l.globalSecondsPerDay) return "global";
  return null;
}

/**
 * The settled length of a call ended at `now`: the server's own elapsed time, whole
 * seconds rounded up, never more than the reservation (a call can't run past its hard
 * stop) and never negative. The client's report is not trusted for accounting.
 */
export function settleSeconds(reservedSec: number, startedAtMs: number, nowMs: number): number {
  const elapsed = Math.ceil(Math.max(0, nowMs - startedAtMs) / 1000);
  return Math.max(0, Math.min(Math.max(0, Math.floor(reservedSec)), elapsed));
}
