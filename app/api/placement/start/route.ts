import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { startPlacement } from "@/lib/placement/placement";

export const dynamic = "force-dynamic";

/** Start the placement test, or resume the student's sitting in progress. → { attemptId, resumed } */
export async function POST() {
  let userId: string;
  try {
    userId = (await requireAuth()).id;
  } catch {
    return NextResponse.json({ error: "Please sign in to take the placement test." }, { status: 401 });
  }
  try {
    const student = await db.student.findUnique({ where: { userId }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "The placement test is for student accounts." }, { status: 404 });
    const r = await startPlacement(student.id);
    if (!r.ok) return NextResponse.json({ error: r.error, nextAt: r.nextAt ?? null }, { status: r.status });
    return NextResponse.json({ attemptId: r.attemptId, resumed: r.resumed });
  } catch (error) {
    console.error("Placement start error:", error);
    return NextResponse.json({ error: "The placement test couldn't be started. Please try again." }, { status: 500 });
  }
}
