import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { trustedMutation } from "@/lib/security/same-origin";
import { boundedJson } from "@/lib/security/json-body";
import { reserveLimits } from "@/lib/security/rate-limit";
import { mockFocusBatch, validFocusTimes, focusDuration } from "./mock-focus-policy";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
async function studentViewer() {
  const s = await auth();
  if (!s?.user || s.user.role !== "STUDENT") return null;
  const student = await db.student.findUnique({ where: { userId: s.user.id }, select: { id: true, blacklisted: true, user: { select: { role: true } } } });
  return student && !student.blacklisted && student.user.role === "STUDENT" ? student : null;
}
export async function activeMockGet() {
  try {
    const student = await studentViewer(); if (!student) return reply({ error: "Student sign-in required" }, 403);
    const a = await db.mockAttempt.findFirst({ where: { studentId: student.id, status: "active", sectionStartedAt: { lte: new Date() }, papers: { path: ["mode"], equals: "cd-v1" } }, select: { id: true }, orderBy: { startedAt: "desc" } });
    return reply({ attemptId: a?.id ?? null });
  } catch { return reply({ error: "Could not check the active mock" }, 503); }
}
export async function mockFocusPost(request: Request, id: string) {
  if (!trustedMutation(request)) return reply({ error: "Untrusted origin" }, 403);
  try {
    const student = await studentViewer(); if (!student) return reply({ error: "Student sign-in required" }, 403);
    if (!id || id.length > 64) return reply({ error: "Invalid attempt" }, 400);
    const limit = await reserveLimits([{ key: `mock:focus:${student.id}`, limit: 600, seconds: 900 }]);
    if (!limit.ok) return reply({ error: "Focus log temporarily unavailable" }, limit.unavailable ? 503 : 429);
    let raw: unknown; try { raw = await boundedJson(request, 10000); } catch { return reply({ error: "Invalid focus log" }, 400); }
    const parsed = mockFocusBatch.safeParse(raw); if (!parsed.success) return reply({ error: "Invalid focus log" }, 400);
    const a = await db.mockAttempt.findFirst({ where: { id, studentId: student.id }, select: { papers: true, sectionStartedAt: true, startedAt: true, finishedAt: true, status: true, updatedAt: true } });
    if (!a || (a.papers as { mode?: string })?.mode !== "cd-v1" || (!a.sectionStartedAt && a.status === "active")) return reply({ error: "Running CDI mock required" }, 404);
    const end = a.finishedAt ?? (a.status !== "active" ? a.updatedAt : null);
    const now = Date.now();
    if (parsed.data.events.some(e => !validFocusTimes(e, a.startedAt, end, now))) return reply({ error: "Invalid event time" }, 400);
    // Bounded even for a deliberately noisy client. Repeated IDs cannot increase the count.
    if (await db.mockFocusEvent.count({ where: { attemptId: id } }) >= 1000) return reply({ error: "Focus log capacity reached" }, 429);
    for (const e of parsed.data.events) {
      const leftAt = new Date(e.leftAt), returnedAt = e.returnedAt ? new Date(e.returnedAt) : null;
      await db.mockFocusEvent.createMany({ data: [{ attemptId: id, eventId: e.eventId, kind: e.kind, section: e.section, leftAt, returnedAt, durationMs: returnedAt ? focusDuration(leftAt, returnedAt, end) : null }], skipDuplicates: true });
      if (returnedAt) await db.mockFocusEvent.updateMany({ where: { attemptId: id, eventId: e.eventId, kind: e.kind, leftAt, returnedAt: null }, data: { returnedAt, durationMs: focusDuration(leftAt, returnedAt, end) } });
    }
    return reply({ ok: true });
  } catch { return reply({ error: "Focus log unavailable; your exam continues" }, 503); }
}
