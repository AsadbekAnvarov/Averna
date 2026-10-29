import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  applySegmentSave,
  isVerified,
  type BoundaryCandidate,
  type SegmentRecordLike,
  type SegmentSaveInput,
  type SegmentSaveOutcome,
  type StoredSegments,
} from "./segments";
import type { ExamListeningTest } from "./types";

/**
 * listening_part_segments: part boundaries of supplied whole recordings (one row
 * per paper). Every read fails closed: a missing table (deploy.sql not applied
 * yet) or any database error means "not verified", never a broken page.
 */

export interface SegmentRecord extends SegmentRecordLike {
  testId: string;
  candidates: (BoundaryCandidate | null)[] | null;
  updatedAt: Date;
}

type Row = {
  testId: string;
  recordingSha256: string;
  durationMs: number;
  candidates: unknown;
  segments: unknown;
  verifiedById: string | null;
  verifiedAt: Date | null;
  revision: number;
  updatedAt: Date;
};

function candidatesOf(v: unknown): (BoundaryCandidate | null)[] | null {
  const list = v && typeof v === "object" ? (v as { boundaries?: unknown }).boundaries : null;
  if (!Array.isArray(list)) return null;
  return list.slice(0, 3).map((c) => {
    if (!c || typeof c !== "object") return null;
    const x = c as Partial<BoundaryCandidate>;
    return (x.boundary === 1 || x.boundary === 2 || x.boundary === 3) && Number.isFinite(x.ms) && (x.method === "pause" || x.method === "evidence")
      ? { boundary: x.boundary, ms: Number(x.ms), method: x.method }
      : null;
  });
}

function segmentsOf(v: unknown): StoredSegments | null {
  if (!v || typeof v !== "object") return null;
  const s = v as StoredSegments;
  return s.v === 1 && Array.isArray(s.parts) && s.parts.length === 4 ? s : null;
}

export function recordFromRow(row: Row): SegmentRecord {
  return {
    testId: row.testId,
    recordingSha256: row.recordingSha256,
    durationMs: row.durationMs,
    candidates: candidatesOf(row.candidates),
    segments: segmentsOf(row.segments),
    verifiedAt: row.verifiedAt,
    verifiedById: row.verifiedById,
    revision: row.revision,
    updatedAt: row.updatedAt,
  };
}

/** Rows for these papers (empty when the table doesn't exist yet or the query fails). */
export async function loadSegmentRecords(testIds: string[]): Promise<Map<string, SegmentRecord>> {
  const out = new Map<string, SegmentRecord>();
  if (!testIds.length) return out;
  try {
    const rows = (await db.listeningPartSegments.findMany({ where: { testId: { in: testIds } } })) as Row[];
    for (const r of rows) out.set(r.testId, recordFromRow(r));
  } catch {
    /* fail closed: not verified */
  }
  return out;
}

/** Verified segments for the paper's current recording (fresh read, no cache), else null. */
export async function getVerifiedSegments(test: ExamListeningTest): Promise<StoredSegments | null> {
  if (test.recordingMode !== "whole" || !test.recordingSha256) return null;
  const rec = (await loadSegmentRecords([test.id])).get(test.id) ?? null;
  return rec && isVerified(rec, test) ? rec.segments : null;
}

/**
 * Saves boundaries with optimistic concurrency: an update must match the
 * revision the client loaded; a create races on the primary key. Only the
 * listening_part_segments row is written.
 */
export async function saveSegments(input: SegmentSaveInput & { testId: string }): Promise<SegmentSaveOutcome> {
  const prev = (await db.listeningPartSegments.findUnique({ where: { testId: input.testId } })) as Row | null;
  const outcome = applySegmentSave(prev ? recordFromRow(prev) : null, input, new Date());
  if (!outcome.ok) return outcome;
  const n = outcome.next;
  const data = {
    recordingSha256: n.recordingSha256,
    durationMs: n.durationMs,
    segments: n.segments as unknown as Prisma.InputJsonValue,
    verifiedAt: n.verifiedAt ? new Date(n.verifiedAt) : null,
    verifiedById: n.verifiedById,
    revision: n.revision,
  };
  if (!prev) {
    try {
      await db.listeningPartSegments.create({ data: { testId: input.testId, ...data } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, reason: "conflict" };
      throw e;
    }
    return outcome;
  }
  const res = await db.listeningPartSegments.updateMany({ where: { testId: input.testId, revision: input.revision }, data });
  if (res.count !== 1) return { ok: false, reason: "conflict" };
  return outcome;
}
