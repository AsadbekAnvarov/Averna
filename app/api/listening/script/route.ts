import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getListeningExam } from "@/lib/ielts/catalog";
import { MOCK_SECTIONS, paperLockedByMock } from "@/lib/ielts/mock";
import { planOf } from "@/lib/placement/placement";
import { getPlacementForm } from "@/lib/placement/content";
import { listeningClientContent } from "@/lib/ielts/audio/client";
import { auditLine, decideScript, parseScriptQuery } from "@/lib/ielts/audio/script-access";
import type { MockRowLike, PlacementRowLike, ScriptDeps } from "@/lib/ielts/audio/script-access";
import type { ScriptErrorBody, ScriptErrorCode, ScriptResponse } from "@/lib/ielts/audio/script";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

function reply(status: number, code: ScriptErrorCode, error: string, retryAfterSec?: number) {
  const body: ScriptErrorBody = { error, code, ...(retryAfterSec ? { retryAfterSec } : {}) };
  return NextResponse.json(body, { status, headers: retryAfterSec ? { ...NO_STORE, "Retry-After": String(retryAfterSec) } : NO_STORE });
}

const deps: ScriptDeps = {
  catalogTest: (id) => getListeningExam(id),
  paperLocked: (studentId, testId) => paperLockedByMock(studentId, testId),
  activeMocks: async (studentId) =>
    (await db.mockAttempt.findMany({
      where: { studentId, status: "active" },
      select: { id: true, status: true, current: true, sectionStartedAt: true, papers: true },
      take: 3,
    })) as MockRowLike[],
  mockSections: MOCK_SECTIONS,
  activePlacements: async (studentId) =>
    (await db.placementAttempt.findMany({
      where: { studentId, status: "active" },
      select: { id: true, status: true, current: true, plan: true, draft: true },
      take: 3,
    })) as PlacementRowLike[],
  placementPlan: (raw) => planOf(raw),
  placementListening: (formId) => getPlacementForm(formId)?.listening ?? null,
  // The recordings the runner is served now (never throws: any problem → browser voices everywhere,
  // which only makes the section clock open parts earlier).
  servedRecordingMs: async (test) => (await listeningClientContent(test)).parts.map((p) => p.audio?.durationMs ?? null),
};

/**
 * GET /api/listening/script?testId=…&part=…&context=practice|mock|placement
 * → { testId, part, script }
 *
 * The script of ONE Listening part, for the runner's fail-open fallback: a part
 * with a recording reaches the browser without its script, and when the
 * recording can't be played the runner carries on with browser voices. Only
 * for the student whose run it is — practice (unless it's the paper of their
 * running mock section), their running mock Listening section, or their
 * running placement Listening section (rules: lib/ielts/audio/script-access).
 *
 * Exam conditions (mock, placement): part k only once the section clock has
 * reached the earliest moment part k can start playing, less a minute —
 * earlier it's 403 { code: "not_yet", retryAfterSec } with Retry-After, and the
 * runner asks again then. Every script served (and every early request) is
 * logged with the student, the sitting, the part and the section time — the
 * audit trail of which parts were read by browser voices.
 */
export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = (await requireAuth()).id;
  } catch {
    return reply(401, "auth", "Please sign in again.");
  }
  const query = parseScriptQuery(req.nextUrl.searchParams);
  if (!query) return reply(400, "invalid", "Missing or invalid test, part or context.");
  try {
    const student = await db.student.findUnique({ where: { userId }, select: { id: true } });
    if (!student) return reply(403, "forbidden", "Listening scripts are only available to student accounts.");
    const r = await decideScript(query, student.id, deps);
    if (!r.ok) {
      if (r.code === "not_yet") {
        console.warn(auditLine("refused-early", r.audit));
        return reply(403, "not_yet", r.error, r.retryAfterSec);
      }
      return reply(r.status, r.code, r.error);
    }
    if (r.audit) console.info(auditLine("served", r.audit));
    const body: ScriptResponse = r.body;
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (e) {
    console.error("Listening script fallback failed:", e);
    return reply(500, "server", "The script couldn't be loaded. Please try again.");
  }
}
