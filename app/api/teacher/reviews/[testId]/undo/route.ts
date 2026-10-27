import { revalidateTag } from "next/cache";
import { z } from "zod";
import { teacherOf } from "@/lib/access";
import { reviewReply, reviewTeacher } from "@/lib/review/teacher-api";
import { undoReview, verifyUndo } from "@/lib/review/undo";
import { boundedJson } from "@/lib/security/json-body";
import { needsHelpTag } from "@/lib/teacher/needs-help-tag";

export const dynamic = "force-dynamic";

/**
 * POST { token } — "Approved · Undo" (idea 10): put the attempt back exactly as
 * it was before the approval (the previous review or none, the band, the
 * homework submission, the mock sitting) and remove the in-app notification
 * the approval sent. Only the teacher who approved, within two minutes, and
 * only while the review is still the one that approval saved (lib/review/undo).
 */
const schema = z.object({ token: z.string().min(10).max(120_000) });

export async function POST(request: Request, props: { params: Promise<{ testId: string }> }) {
  const { testId } = await props.params;
  const gate = await reviewTeacher(request, testId);
  if (!gate.ok) return gate.response;

  let raw: unknown;
  try {
    raw = await boundedJson(request, 128_000);
  } catch {
    return reviewReply({ error: "Invalid request" }, 400);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return reviewReply({ error: "Invalid request" }, 400);

  const v = verifyUndo(parsed.data.token, gate.user.id, testId);
  if (!v.ok) return reviewReply({ error: v.error }, v.status);
  if (v.payload.before.studentId !== gate.studentId) return reviewReply({ error: "This undo link isn't valid." }, 400);

  try {
    const r = await undoReview(gate.user.id, v.payload);
    if (!r.ok) return reviewReply({ error: r.error }, r.status);
    const teacher = await teacherOf(gate.user.id);
    if (teacher) revalidateTag(needsHelpTag(teacher.id));
    return reviewReply(r);
  } catch (error) {
    console.error("Review undo failed:", error instanceof Error ? error.message : error);
    return reviewReply({ error: "The review couldn't be put back. Open it to change it instead." }, 500);
  }
}
