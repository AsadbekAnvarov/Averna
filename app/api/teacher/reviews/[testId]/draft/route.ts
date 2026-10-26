import { z } from "zod";
import { guardAi } from "@/lib/engine/ai-guard";
import { canGenerate, draftContext, generateDraft, storedDraft } from "@/lib/review/draft";
import { reviewReply, reviewTeacher } from "@/lib/review/teacher-api";
import { boundedJson } from "@/lib/security/json-body";

export const dynamic = "force-dynamic";

/**
 * POST { regenerate?: boolean } → { draft, generated } — the AI draft of a
 * review (idea 10).
 *
 *   - Without `regenerate`: the stored assessment's draft when it has feedback
 *     text (no AI call); otherwise one AI call, kept in aiAnalysis.teacherDraft.
 *   - `regenerate: true`: always a fresh AI draft (new words, same bands).
 *
 * Every AI call is limited per teacher (guardAi "review-draft", 80 a day) → 429.
 * Without an AI key: Writing uses the heuristic scorer's words and Speaking has
 * no draft text (the teacher writes it); "regenerate" answers 503.
 */
const schema = z.object({ regenerate: z.boolean().optional() }).strict();

export async function POST(request: Request, props: { params: Promise<{ testId: string }> }) {
  const { testId } = await props.params;
  const gate = await reviewTeacher(request, testId);
  if (!gate.ok) return gate.response;

  let raw: unknown;
  try {
    raw = await boundedJson(request, 1_000);
  } catch {
    return reviewReply({ error: "Invalid request" }, 400);
  }
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) return reviewReply({ error: "Invalid request" }, 400);
  const regenerate = parsed.data.regenerate === true;

  try {
    const ctx = await draftContext(testId);
    if (!ctx) return reviewReply({ error: "Only Writing and Speaking attempts have review drafts." }, 400);
    const stored = storedDraft(ctx);
    const wantAi = regenerate || stored.source === "none" || stored.source === "heuristic";
    if (!wantAi || !canGenerate(ctx)) {
      if (regenerate) return reviewReply({ error: "Regenerating needs the AI examiner, which isn't set up here. Edit the draft instead." }, 503);
      return reviewReply({ draft: stored, generated: false });
    }
    const guard = await guardAi(gate.user.id, "review-draft");
    if (!guard.ok) {
      if (!regenerate) return reviewReply({ draft: stored, generated: false });
      return reviewReply({ error: "You've used today's AI drafts (80 a day), or the service is busy. Edit the draft instead." }, 429);
    }
    const fresh = await generateDraft(ctx);
    if (!fresh) {
      if (!regenerate) return reviewReply({ draft: stored, generated: false });
      return reviewReply({ error: "The new draft didn't come through. Try again, or edit this one." }, 502);
    }
    return reviewReply({ draft: fresh, generated: true });
  } catch (error) {
    console.error("Review draft failed:", error instanceof Error ? error.message : error);
    return reviewReply({ error: "The draft couldn't be prepared. You can still write the review yourself." }, 500);
  }
}
