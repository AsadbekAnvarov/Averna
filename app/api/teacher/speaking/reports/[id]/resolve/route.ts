import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { teacherOf } from "@/lib/access";
import { db } from "@/lib/db";
import { trustedMutation } from "@/lib/security/same-origin";
import { PAUSE_REPORTS } from "@/lib/speaking/peer-store";
import { canResolveReport } from "@/lib/speaking/teacher-monitor";

export const dynamic = "force-dynamic";

/**
 * POST — resolve an OPEN peer speaking report (docs/peer-speaking.md, Phase C).
 * Teachers: only reports that involve a student of their groups; admins: any.
 * Sets RESOLVED, resolvedAt, resolvedById (the user id) → { ok, stillPaused }.
 */

type Params = { params: Promise<{ id: string }> };

const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });

export async function POST(request: Request, { params }: Params) {
  if (!trustedMutation(request)) return reply({ error: "Untrusted origin" }, 403);
  try {
    const session = await auth();
    if (!session?.user) return reply({ error: "Please sign in again." }, 401);
    const role = session.user.role;
    if (role !== "TEACHER" && role !== "ADMIN") return reply({ error: "Only teachers can resolve reports." }, 403);
    const { id } = await params;
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return reply({ error: "Invalid report" }, 400);

    const report = await db.speakingReport.findUnique({ where: { id }, select: { id: true, status: true, reporterId: true, reportedId: true } });
    if (!report) return reply({ error: "Report not found" }, 404);
    const teacher = role === "TEACHER" ? await teacherOf(session.user.id) : null;
    if (!(await canResolveReport({ role, teacherId: teacher?.id ?? null }, report))) return reply({ error: "This report is about students outside your groups." }, 403);

    if (report.status === "OPEN") {
      await db.speakingReport.updateMany({
        where: { id: report.id, status: "OPEN" },
        data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: session.user.id },
      });
    }
    const stillOpen = await db.speakingReport.count({ where: { reportedId: report.reportedId, status: "OPEN" } });
    return reply({ ok: true, stillPaused: stillOpen >= PAUSE_REPORTS });
  } catch (e) {
    console.error("Resolve peer report failed", e instanceof Error ? e.name : "unknown");
    return reply({ error: "Couldn't resolve the report. Try again." }, 503);
  }
}
