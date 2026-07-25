import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTeacherFeedbackProfile } from "@/lib/teacher-intel";
import { draftTeacherFeedback } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Teachers only" }, { status: 403 });
    }
    const { context } = await req.json();

    const teacher = await db.teacher.findUnique({ where: { userId: user.id }, select: { id: true } });
    const profile = teacher ? await getTeacherFeedbackProfile(teacher.id) : { samples: [] as string[] };

    const draft = await draftTeacherFeedback({
      context: typeof context === "string" ? context : "",
      samples: profile.samples,
    });
    return NextResponse.json({ draft });
  } catch (error: any) {
    console.error("Twin feedback route error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
  }
}
