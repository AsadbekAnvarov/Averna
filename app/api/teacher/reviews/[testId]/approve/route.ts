import { revalidateTag } from "next/cache";
import { z } from "zod";
import { teacherOf } from "@/lib/access";
import { saveTestReview } from "@/lib/review/save";
import { reviewReply, reviewTeacher } from "@/lib/review/teacher-api";
import { captureReviewState, mockUpdatedAt, signUndo, UNDO_WINDOW_MS } from "@/lib/review/undo";
import { MAX_COMMENT_CHARS } from "@/lib/review/scoring";
import { boundedJson } from "@/lib/security/json-body";
import { needsHelpTag } from "@/lib/teacher/needs-help-tag";

export const dynamic = "force-dynamic";

/**
 * POST — approve an AI-drafted review in one tap, or save it after editing
 * (idea 10). Body: { band, criteria, comment?, queue? } — the same as the
 * manual review form; it is saved by the SAME path (lib/review/save
 * `saveTestReview`: TestReview, the attempt's band, homework, mock sitting,
 * the student's notification). → { ok, created, changed, review, next, undo }
 * where `undo` is a short-lived signed token for "Approved · Undo"
 * (lib/review/undo), or null when undo isn't available.
 *
 * Teachers only, for students of their own groups.
 */
const schema = z.object({
  band: z.union([z.number(), z.string()]),
  criteria: z.record(z.union([z.number(), z.string(), z.null()])),
  comment: z.string().max(MAX_COMMENT_CHARS + 200).nullable().optional(),
  queue: z.record(z.unknown()).optional(),
});

export async function POST(request: Request, props: { params: Promise<{ testId: string }> }) {
  const { testId } = await props.params;
  const gate = await reviewTeacher(request, testId);
  if (!gate.ok) return gate.response;

  let raw: unknown;
  try {
    raw = await boundedJson(request, 32_000);
  } catch {
    return reviewReply({ error: "The review couldn't be read. Please try again." }, 400);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return reviewReply({ error: "The review is incomplete — give every band and try again." }, 400);

  try {
    const before = await captureReviewState(testId);
    const notifiedAt = Date.now();
    const r = await saveTestReview(gate.user, testId, parsed.data);
    if (!r.ok) return reviewReply({ error: r.error }, r.status);

    const undo =
      before &&
      signUndo({
        v: 1,
        by: gate.user.id,
        exp: Date.now() + UNDO_WINDOW_MS,
        before,
        after: { reviewUpdatedAt: r.review.updatedAt, mockUpdatedAt: await mockUpdatedAt(before.mock?.id), notifiedAt: r.changed ? notifiedAt : null },
      });
    const teacher = await teacherOf(gate.user.id);
    if (teacher) revalidateTag(needsHelpTag(teacher.id));
    return reviewReply({ ...r, undo: undo ?? null });
  } catch (error) {
    console.error("Review approve failed:", error instanceof Error ? error.message : error);
    return reviewReply({ error: "The review couldn't be saved. Nothing was changed — please try again." }, 500);
  }
}
