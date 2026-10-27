import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDailySessionData } from "@/lib/session/load";
import { buildDailyPlan, parseSessionLength } from "@/lib/session/daily-plan";

export const dynamic = "force-dynamic";

/**
 * GET /api/session/today?minutes=5|10|20[&exam=YYYY-MM-DD] — today's Daily
 * Session for the signed-in student: the plan (with done flags from today's
 * activity) plus the facts it was built from, so the Today hero can refresh
 * its checkmarks when the student comes back, and rebuild other lengths
 * without another request. Read-only and private (no-store).
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in to see today's session." }, { status: 401 });
  if (session.user.role !== "STUDENT") return NextResponse.json({ error: "Daily sessions are for students." }, { status: 403 });
  try {
    const student = await db.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
    const data = await getDailySessionData(student.id);
    if (!data) return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
    const url = new URL(req.url);
    const exam = url.searchParams.get("exam");
    const plan = buildDailyPlan({
      ...data.facts,
      minutes: parseSessionLength(url.searchParams.get("minutes")),
      examDate: exam && /^\d{4}-\d{2}-\d{2}$/.test(exam) ? exam : null,
    });
    return NextResponse.json({ plan, facts: data.facts }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("GET /api/session/today failed:", e);
    return NextResponse.json({ error: "Today's session is temporarily unavailable." }, { status: 503 });
  }
}
