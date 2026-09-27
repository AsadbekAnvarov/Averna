import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { startMock } from "@/lib/ielts/mock";

export const dynamic = "force-dynamic";

/** Start a full mock exam (random papers), or resume the student's active one. */
export async function POST() {
  let userId: string;
  try {
    userId = (await requireAuth()).id;
  } catch {
    return NextResponse.json({ error: "Please sign in to take the mock exam." }, { status: 401 });
  }
  try {
    const student = await db.student.findUnique({ where: { userId }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
    const r = await startMock(student.id);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
    return NextResponse.json({ attemptId: r.attemptId, resumed: r.resumed });
  } catch (error) {
    console.error("Mock start error:", error);
    return NextResponse.json({ error: "The mock exam couldn't be started. Please try again." }, { status: 500 });
  }
}
