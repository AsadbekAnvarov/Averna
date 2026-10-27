import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { canReviewStudent } from "@/lib/access";
import { draftStudentNudge, hasOpenAI } from "@/lib/ai";
import { guardAi } from "@/lib/engine/ai-guard";
import { boundedJson } from "@/lib/security/json-body";
import { trustedMutation } from "@/lib/security/same-origin";

export const dynamic = "force-dynamic";

/**
 * POST { studentId, firstName, reasons[], miniTask } → { draft } — an AI-drafted
 * first message for "Who needs help today" → Message (idea 10). Teachers only,
 * for a student of their own groups; only the reasons the teacher already sees
 * reach the model. 503 without an AI key and 429 over the daily cap
 * (guardAi "teacher-nudge") — the card then keeps its template draft.
 */
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

const schema = z.object({
  studentId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  firstName: z.string().trim().min(1).max(60),
  reasons: z.array(z.string().trim().min(1).max(120)).min(1).max(3),
  miniTask: z.boolean().optional(),
});

export async function POST(request: Request) {
  if (!trustedMutation(request)) return reply({ error: "Untrusted origin" }, 403);
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return reply({ error: "Sign in again to draft a message." }, 401);
  if (user.role !== "TEACHER") return reply({ error: "Message drafts are for teachers." }, 403);

  let raw: unknown;
  try {
    raw = await boundedJson(request, 4_000);
  } catch {
    return reply({ error: "Invalid request" }, 400);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return reply({ error: "Invalid request" }, 400);
  if (!(await canReviewStudent({ id: user.id, role: "TEACHER" }, parsed.data.studentId))) {
    return reply({ error: "You can only message students in your own groups from here." }, 403);
  }
  if (!hasOpenAI()) return reply({ error: "AI drafts aren't available — the template is ready to edit." }, 503);
  const guard = await guardAi(user.id, "teacher-nudge");
  if (!guard.ok) return reply({ error: guard.message ?? "Today's AI drafts are used up — the template is ready to edit." }, 429);

  const draft = await draftStudentNudge({
    firstName: parsed.data.firstName,
    reasons: parsed.data.reasons,
    miniTask: parsed.data.miniTask === true,
  });
  if (!draft) return reply({ error: "The AI draft didn't come through — the template is ready to edit." }, 502);
  return reply({ draft });
}
