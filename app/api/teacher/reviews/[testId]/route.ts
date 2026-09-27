import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/auth";
import { saveTestReview } from "@/lib/review/save";

export const dynamic = "force-dynamic";

/** Comment ≤ 4000 characters plus the bands and filters fit well inside this. */
const MAX_BODY_BYTES = 32_000;

/**
 * Save (create or update) the teacher's review of a Writing / Speaking attempt.
 * Body: { band, criteria: { … }, comment?, queue?: { group, skill, source, days } }
 * → { ok, created, changed, review, next } — `next` is the next pending attempt
 * in the teacher's queue under the same filters (null when none is left).
 *
 * Teachers review the students of their own groups; admins everyone.
 */
export async function POST(req: NextRequest, { params }: { params: { testId: string } }) {
  let user: { id: string; role?: string | null };
  try {
    user = await requireTeacherOrAdmin();
  } catch (e) {
    const forbidden = e instanceof Error && e.message.startsWith("Forbidden");
    return NextResponse.json(
      {
        error: forbidden
          ? "Only teachers and admins can review attempts."
          : "Your session has expired. Sign in again in a new tab, then save — your review is still here.",
      },
      { status: forbidden ? 403 : 401 }
    );
  }

  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: "Send the review as JSON." }, { status: 415 });
  }
  const text = await req.text().catch(() => "");
  if (text.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "The review is too long. Shorten the comment and try again." }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "The review couldn't be read. Please try again." }, { status: 400 });
  }

  try {
    const r = await saveTestReview({ id: user.id, role: user.role }, params.testId, body);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json(r);
  } catch (error) {
    console.error("Teacher review save failed:", error);
    return NextResponse.json(
      { error: "The review couldn't be saved. Nothing was changed — please try again." },
      { status: 500 }
    );
  }
}
