import { NextRequest, NextResponse } from "next/server";
import { trustedMutation } from "@/lib/security/same-origin";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tashkentDayStart } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * POST /api/session/warmup — the 60-second warm-up was finished. Writes one
 * WARMUP_COMPLETED activity row per Tashkent day (0 points: no XP, no streak)
 * so the Daily Session can tick its warm-up step from verified activity.
 */
export async function POST(req: NextRequest) {
  if (!trustedMutation(req)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const student = await db.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!student) return NextResponse.json({ ok: false }, { status: 404 });
    const already = await db.activityLog.findFirst({
      where: { studentId: student.id, action: "WARMUP_COMPLETED", createdAt: { gte: tashkentDayStart() } },
      select: { id: true },
    });
    if (!already) {
      await db.activityLog.create({ data: { studentId: student.id, action: "WARMUP_COMPLETED", details: {}, points: 0 } });
    }
    return NextResponse.json({ ok: true, duplicate: !!already });
  } catch (e) {
    console.error("POST /api/session/warmup failed:", e);
    return NextResponse.json({ error: "Could not save the warm-up." }, { status: 503 });
  }
}
