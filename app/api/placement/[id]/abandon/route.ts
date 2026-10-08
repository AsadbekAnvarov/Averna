import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { abandonPlacement } from "@/lib/placement/placement";

export const dynamic = "force-dynamic";

/**
 * Leave the placement test for good. Once a section's clock has started (or a
 * section was marked) the sitting counts toward the 14-day retake wait, like a
 * finished one; left earlier, the test can be started again at once. Left at
 * the optional Writing intro, the sitting is finished without Writing instead
 * (it gets a level): → { ok: true, finished: true }, and the client opens the result.
 */
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  let userId: string;
  try {
    userId = (await requireAuth()).id;
  } catch {
    return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  }
  try {
    const student = await db.student.findUnique({ where: { userId }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
    const outcome = await abandonPlacement(student.id, params.id);
    return NextResponse.json({ ok: !!outcome, ...(outcome === "finished" ? { finished: true } : {}) });
  } catch (error) {
    console.error("Placement abandon error:", error);
    return NextResponse.json({ error: "Couldn't leave the placement test. Please try again." }, { status: 500 });
  }
}
