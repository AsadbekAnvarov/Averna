import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { assessWritingTask } from "@/lib/ai";
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

    const { essay, taskType, prompt } = await req.json();
    if (!essay || typeof essay !== "string" || essay.trim().length < 20) {
      return NextResponse.json({ error: "Please paste the student's essay." }, { status: 400 });
    }

    const type = taskType === "task1" ? "task1" : "task2";
    const assessment = await assessWritingTask(essay, type, typeof prompt === "string" ? prompt : "");
    return NextResponse.json(assessment);
  } catch (error: any) {
    console.error("Essay review route error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to review essay" }, { status: 500 });
  }
}
