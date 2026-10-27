/**
 * Live speaking partner — call accounting in ActivityLog (no schema change). SERVER ONLY.
 *
 * One row per call: action "LIVE_SPEAKING", points 0, details LiveCallDetails. While
 * the call is open `seconds` holds the FULL reservation; settling (end route, the
 * start route's hard stop, or a newer start of the same student) sets it to the
 * server-measured length — never more than the reservation. Usage today is the sum
 * of `seconds` over today's rows (Tashkent day), per student and for everyone.
 *
 * Every state change is a conditional write on `details.state = "open"`, so of two
 * racing settles exactly one wins; whoever settles a call also hangs it up. The rows
 * hold no transcript, no audio and no SDP.
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { tashkentDayStart } from "@/lib/utils";
import { hangupRealtimeCall } from "./openai-realtime";
import { settleSeconds, usedSeconds, type LiveUsageRow } from "./limits";
import { isLiveMode, type LiveMode } from "./modes";

export const LIVE_ACTION = "LIVE_SPEAKING";

export type LiveEndReason = "student" | "limit" | "network" | "server" | "replaced";
const END_REASONS: readonly LiveEndReason[] = ["student", "limit", "network", "server", "replaced"];
export const isEndReason = (x: unknown): x is LiveEndReason => END_REASONS.includes(x as LiveEndReason);

export interface LiveCallDetails {
  kind: "live-call";
  state: "open" | "ended";
  /** OpenAI's call id (null between the reservation and OpenAI's answer). */
  callId: string | null;
  startedAt: string;
  reservedSec: number;
  /** Reserved while open, settled once ended. */
  seconds: number;
  endedAt: string | null;
  endedBy: LiveEndReason | null;
  /** OpenAI confirmed the hangup (or the call was already gone). */
  hungUp: boolean;
  mode: LiveMode;
  topicId: string;
}

export interface LiveCallRow {
  id: string;
  studentId: string;
  createdAt: Date;
  details: LiveCallDetails;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" ? v : null);

/** Stored details back into shape (null when the row isn't a live call). Pure; exported for tests. */
export function parseLiveDetails(x: unknown): LiveCallDetails | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (o.kind !== "live-call") return null;
  const reservedSec = num(o.reservedSec);
  const seconds = num(o.seconds);
  const startedAt = str(o.startedAt);
  if (reservedSec == null || seconds == null || !startedAt) return null;
  return {
    kind: "live-call",
    state: o.state === "ended" ? "ended" : "open",
    callId: str(o.callId),
    startedAt,
    reservedSec: Math.max(0, reservedSec),
    seconds: Math.max(0, seconds),
    endedAt: str(o.endedAt),
    endedBy: isEndReason(o.endedBy) ? o.endedBy : null,
    hungUp: o.hungUp === true,
    mode: isLiveMode(o.mode) ? o.mode : "casual",
    topicId: str(o.topicId) ?? "",
  };
}

function toRow(r: { id: string; studentId: string; createdAt: Date; details: unknown }): LiveCallRow | null {
  const details = parseLiveDetails(r.details);
  return details ? { id: r.id, studentId: r.studentId, createdAt: r.createdAt, details } : null;
}

const json = (d: LiveCallDetails) => d as unknown as Prisma.InputJsonValue;
const OPEN = { path: ["state"], equals: "open" } as const;

/** Every live call of today (Tashkent), all students — the global budget needs them all. */
export async function todayCalls(now: Date = new Date()): Promise<LiveCallRow[]> {
  const rows = await db.activityLog.findMany({
    where: { action: LIVE_ACTION, createdAt: { gte: tashkentDayStart(now) } },
    select: { id: true, studentId: true, createdAt: true, details: true },
    take: 10_000,
  });
  return rows.map(toRow).filter((r): r is LiveCallRow => !!r);
}

export interface LiveUsage {
  student: number;
  global: number;
}

export function usageOf(rows: readonly LiveCallRow[], studentId: string, now: Date = new Date()): LiveUsage {
  const usage: LiveUsageRow[] = rows.map((r) => ({ studentId: r.studentId, createdAt: r.createdAt, seconds: r.details.seconds }));
  const since = tashkentDayStart(now);
  return { student: usedSeconds(usage, since, studentId), global: usedSeconds(usage, since) };
}

export async function usageToday(studentId: string, now: Date = new Date()): Promise<LiveUsage> {
  return usageOf(await todayCalls(now), studentId, now);
}

/** Reserve a call: the row counts its full length from now on. */
export async function insertReservation(input: { studentId: string; reservedSec: number; mode: LiveMode; topicId: string; now?: Date }): Promise<LiveCallRow> {
  const now = input.now ?? new Date();
  const details: LiveCallDetails = {
    kind: "live-call",
    state: "open",
    callId: null,
    startedAt: now.toISOString(),
    reservedSec: input.reservedSec,
    seconds: input.reservedSec,
    endedAt: null,
    endedBy: null,
    hungUp: false,
    mode: input.mode,
    topicId: input.topicId,
  };
  const row = await db.activityLog.create({
    data: { studentId: input.studentId, action: LIVE_ACTION, details: json(details), points: 0 },
    select: { id: true, studentId: true, createdAt: true },
  });
  return { id: row.id, studentId: row.studentId, createdAt: row.createdAt, details };
}

/** Undo a reservation that never became a call (over a cap, or OpenAI refused). */
export async function deleteReservation(id: string): Promise<void> {
  await db.activityLog.deleteMany({ where: { id, action: LIVE_ACTION } });
}

/** Store OpenAI's call id. False when the row was settled meanwhile (a newer start replaced it). */
export async function attachCallId(row: LiveCallRow, callId: string): Promise<boolean> {
  const details: LiveCallDetails = { ...row.details, callId };
  const r = await db.activityLog.updateMany({ where: { id: row.id, action: LIVE_ACTION, details: OPEN }, data: { details: json(details) } });
  if (r.count > 0) row.details = details;
  return r.count > 0;
}

export async function findCall(id: string): Promise<LiveCallRow | null> {
  const r = await db.activityLog.findFirst({
    where: { id, action: LIVE_ACTION },
    select: { id: true, studentId: true, createdAt: true, details: true },
  });
  return r ? toRow(r) : null;
}

/** A student's calls still open (from the last 30 minutes — anything older was hard-stopped). */
export async function openCallsOf(studentId: string, now: Date = new Date()): Promise<LiveCallRow[]> {
  const rows = await db.activityLog.findMany({
    where: { studentId, action: LIVE_ACTION, createdAt: { gte: new Date(now.getTime() - 30 * 60_000) }, details: OPEN },
    select: { id: true, studentId: true, createdAt: true, details: true },
    take: 20,
  });
  return rows
    .map(toRow)
    .filter((r): r is LiveCallRow => !!r && r.details.state === "open");
}

export interface FinishResult {
  /** This request settled the call (false: it was already ended). */
  settledNow: boolean;
  /** The call's accounted length. */
  seconds: number;
  details: LiveCallDetails;
}

/**
 * End a call: settle it (if still open) to the server-measured length, then hang it
 * up at OpenAI unless that already happened. Safe to call from several places at once.
 */
export async function finishCall(row: LiveCallRow, endedBy: LiveEndReason, now: Date = new Date()): Promise<FinishResult> {
  let details = row.details;
  let settledNow = false;
  if (details.state === "open") {
    const seconds = settleSeconds(details.reservedSec, Date.parse(details.startedAt), now.getTime());
    const next: LiveCallDetails = { ...details, state: "ended", seconds: Math.min(seconds, details.seconds), endedAt: now.toISOString(), endedBy };
    const r = await db.activityLog.updateMany({ where: { id: row.id, action: LIVE_ACTION, details: OPEN }, data: { details: json(next) } });
    settledNow = r.count > 0;
    if (settledNow) details = next;
    else details = (await findCall(row.id))?.details ?? details;
  }
  if (details.callId && !details.hungUp) {
    if (await hangupRealtimeCall(details.callId)) {
      const marked: LiveCallDetails = { ...details, hungUp: true };
      // Only a settled row is marked, so this can't reopen or un-settle anything.
      await db.activityLog
        .updateMany({ where: { id: row.id, action: LIVE_ACTION, details: { path: ["state"], equals: "ended" } }, data: { details: json(marked) } })
        .catch(() => undefined);
      details = marked;
    }
  }
  row.details = details;
  return { settledNow, seconds: details.seconds, details };
}

/** The start route's after(): end the call if the client didn't. Never throws. */
export async function hardStop(rowId: string): Promise<void> {
  try {
    const row = await findCall(rowId);
    // Ended and hung up (or never connected): nothing to stop.
    if (!row || (row.details.state === "ended" && (row.details.hungUp || !row.details.callId))) return;
    await finishCall(row, "server");
  } catch (e) {
    console.error("Live call hard stop failed", e instanceof Error ? e.name : "unknown");
  }
}
