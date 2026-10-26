import { db } from "@/lib/db";
import { boundedJson } from "@/lib/security/json-body";
import { reserveLimits } from "@/lib/security/rate-limit";
import { trustedMutation } from "@/lib/security/same-origin";
import { reply, roomMember } from "@/lib/speaking/room-member";
import { REPORT_NOTE_MAX, REPORTS_PER_DAY, isReportReason } from "@/lib/speaking/safety";

export const dynamic = "force-dynamic";

/**
 * POST { roomId, reason, note? } — report the partner of a peer room (docs/peer-speaking.md,
 * Phase C). Members only; one OPEN report per reporter per room; 5 per day per student.
 * Reports go to the teachers' monitor (/teacher/speaking); PAUSE_REPORTS open reports
 * pause the reported student's peer speaking.
 */
export async function POST(request: Request) {
  if (!trustedMutation(request)) return reply({ error: "Untrusted origin" }, 403);
  let body: Record<string, unknown>;
  try {
    const raw = await boundedJson(request, 2000);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("shape");
    body = raw as Record<string, unknown>;
  } catch {
    return reply({ error: "Invalid request" }, 400);
  }
  try {
    const m = await roomMember(body.roomId);
    if (m.fail) return m.fail;
    if (!isReportReason(body.reason)) return reply({ error: "Choose a reason." }, 400);
    if (body.note !== undefined && body.note !== null && typeof body.note !== "string") return reply({ error: "Invalid note" }, 400);
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > REPORT_NOTE_MAX) return reply({ error: `Keep the note under ${REPORT_NOTE_MAX} characters.` }, 400);

    const open = await db.speakingReport.findFirst({
      where: { roomId: m.room.id, reporterId: m.studentId, status: "OPEN" },
      select: { id: true },
    });
    if (open) return reply({ error: "You already reported this session. A teacher will look at it.", code: "duplicate" }, 409);

    const rate = await reserveLimits([{ key: `speaking-report:${m.studentId}`, limit: REPORTS_PER_DAY, seconds: 86400 }]);
    if (!rate.ok)
      return reply(
        { error: rate.unavailable ? "Reports are busy — try again in a minute." : "You've sent the most reports for today. Talk to your teacher if something is wrong." },
        rate.unavailable ? 503 : 429,
      );

    await db.speakingReport.create({
      data: { roomId: m.room.id, reporterId: m.studentId, reportedId: m.partnerId, reason: body.reason, note: note || null },
    });
    return reply({ ok: true });
  } catch (e) {
    console.error("Peer report failed", e instanceof Error ? e.name : "unknown");
    return reply({ error: "The report couldn't be sent. Try again." }, 503);
  }
}
