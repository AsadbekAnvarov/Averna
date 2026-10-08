import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { submitPlacementSection } from "@/lib/placement/placement";

export const dynamic = "force-dynamic";
// Writing may go to the AI examiner.
export const maxDuration = 60;

/**
 * Submit the current section.
 * Body: { section: number, payload: { answers } | { essay } | { skip: true } } → { ok: true, done, section }
 */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  let userId: string;
  try {
    userId = (await requireAuth()).id;
  } catch {
    return NextResponse.json(
      { error: "Your session has expired. Sign in again in a new tab, then press Try again — your answers are saved." },
      { status: 401 }
    );
  }
  try {
    const student = await db.student.findUnique({ where: { userId }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
    const body = (await req.json().catch(() => ({}))) as { section?: unknown; payload?: unknown };
    const r = await submitPlacementSection({
      studentId: student.id,
      userId,
      attemptId: params.id,
      section: Number(body.section),
      payload: body.payload,
    });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, done: r.done, section: r.section });
  } catch (error) {
    console.error("Placement section error:", error);
    return NextResponse.json({ error: "This section wasn't submitted. Nothing was lost — please try again." }, { status: 500 });
  }
}
