import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateLessonPlan } from "@/lib/ai";
import { guardAi } from "@/lib/engine/ai-guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const guard = guardAi(user.id, "teacher-tool");
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: 429 });
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Teachers only" }, { status: 403 });
    }

    const { topic, level } = await req.json();
    if (!topic || typeof topic !== "string" || topic.trim().length < 2) {
      return NextResponse.json({ error: "Please enter a topic." }, { status: 400 });
    }

    const plan = await generateLessonPlan(topic, typeof level === "string" ? level : undefined);
    return NextResponse.json(plan);
  } catch (error: any) {
    console.error("Lesson builder route error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to build lesson" }, { status: 500 });
  }
}
