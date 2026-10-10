import { GroupMockError } from "@/lib/group-mock/errors";
import { isGroupMock } from "@/lib/group-mock/rules";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { trustedMutation } from "@/lib/security/same-origin";
import { boundedJson } from "@/lib/security/json-body";
import { reserveLimits } from "@/lib/security/rate-limit";
import { beginSection, saveMockDraft, startMock, submitMockSection, abandonMock } from "./mock";
import { beginMockSchema, saveMockSchema, submitMockSchema, MOCK_MAX_BODY_BYTES } from "./mock-policy";
type Action = "start" | "begin" | "save" | "section" | "abandon";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
export async function mockPost(action: Action, request: Request, id?: string) {
  if (!trustedMutation(request)) return reply({ error: "Untrusted origin" }, 403);
  try {
    const session = await auth();
    if (!session?.user) return reply({ error: "Your session expired. Sign in again in another tab; keep this exam open." }, 401);
    const student = await db.student.findUnique({ where: { userId: session.user.id }, select: { id: true, blacklisted: true, user: { select: { role: true } } } });
    if (!student || student.blacklisted || student.user.role !== "STUDENT" || session.user.role !== "STUDENT") return reply({ error: "An active student account is required." }, 403);
    if (action !== "start" && (!id || id.length > 64)) return reply({ error: "Invalid attempt" }, 400);
    const limit = await reserveLimits([{ key: `mock:${action}:${student.id}`, limit: action === "save" ? 360 : action === "start" ? 10 : 40, seconds: 900 }]);
    if (!limit.ok) return reply({ error: "The exam request is temporarily limited. Your device copy is unchanged." }, limit.unavailable ? 503 : 429);
    if (action === "start") { const r = await startMock(student.id); return r.ok ? reply({ attemptId: r.attemptId, resumed: r.resumed }) : reply({ error: r.error }, 422); }
    if (action === "abandon") { const attempt = await db.mockAttempt.findFirst({ where: { id, studentId: student.id }, select: { papers: true } }); if (isGroupMock(attempt?.papers)) return reply({ error: "Only your teacher can cancel this group session." }, 403); const ok = await abandonMock(student.id, id!); return reply({ ok }, ok ? 200 : 409); }
    let body: unknown; try { body = await boundedJson(request, MOCK_MAX_BODY_BYTES); } catch { return reply({ error: "Invalid or oversized exam request. Your device copy is unchanged." }, 400); }
    if (action === "begin") { const p = beginMockSchema.safeParse(body); if (!p.success) return reply({ error: "Invalid section" }, 400); const r = await beginSection(student.id, id!, p.data.section); return r.ok ? reply(r) : reply({ error: r.error }, 409); }
    if (action === "save") { const p = saveMockSchema.safeParse(body); if (!p.success) return reply({ error: "Invalid answers or essays" }, 400); const r = await saveMockDraft(student.id, id!, p.data.section, p.data.draft, p.data.revision); return reply(r, r.ok ? 200 : 409); }
    const p = submitMockSchema.safeParse(body); if (!p.success) return reply({ error: "Invalid section submission" }, 400);
    const r = await submitMockSection({ studentId: student.id, userId: session.user.id, attemptId: id!, section: p.data.section, payload: p.data.payload, revision: p.data.revision, fromDraft: p.data.fromDraft });
    return r.ok ? reply({ ok: true, done: r.done, section: r.section }) : reply({ error: r.error }, r.status);
  } catch (error) { if (error instanceof GroupMockError) return reply({error:error.message}, error.status); console.error(`Mock ${action} unavailable`, error instanceof Error ? error.name : "unknown"); return reply({ error: "The exam request could not be completed. Keep this page open and try again." }, 503); }
}
