import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { assessWritingTask, analyzeWritingIssues } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const text = String(body?.text ?? "").trim();
    const taskType = body?.taskType === "task1" ? "task1" : "task2";
    const prompt = String(body?.prompt ?? "").slice(0, 500);

    if (text.length < 40) {
      return NextResponse.json({ error: "Paste at least a few sentences to analyse." }, { status: 400 });
    }

    const assessment = await assessWritingTask(text, taskType, prompt || "General task");
    const issues = analyzeWritingIssues(text);

    // A ready-to-edit feedback draft the teacher can refine or replace
    const draft =
      `Overall band (estimate): ${assessment.overallBand}.\n\n` +
      `Strengths: ${assessment.strengths.join(" ")}\n\n` +
      `To improve: ${[...assessment.weaknesses, ...assessment.recommendations].slice(0, 4).join(" ")}`;

    return NextResponse.json({ ok: true, assessment, issues, draft });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to analyse";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
