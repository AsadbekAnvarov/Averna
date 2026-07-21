import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/auth";
import { generateReadingTest } from "@/lib/ai";

export const dynamic = "force-dynamic";
// Full-test generation is a large model call; request a longer function budget.
export const maxDuration = 60;

/**
 * Admin/teacher endpoint that generates an ORIGINAL IELTS Reading test.
 * Returns the validated test JSON for review. (Persistence + an authoring UI
 * are the next phase.)
 *
 * POST body: { topic: string; level?: string; passageCount?: number; questionsPerPassage?: number }
 */
export async function POST(req: NextRequest) {
  try {
    await requireTeacherOrAdmin();
  } catch {
    return NextResponse.json({ error: "Teacher or admin access required." }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    if (!topic) {
      return NextResponse.json({ error: "Provide a 'topic' for the test." }, { status: 400 });
    }

    const test = await generateReadingTest({
      topic,
      level: typeof body.level === "string" ? body.level : undefined,
      passageCount: typeof body.passageCount === "number" ? body.passageCount : undefined,
      questionsPerPassage:
        typeof body.questionsPerPassage === "number" ? body.questionsPerPassage : undefined,
    });

    return NextResponse.json({ ok: true, test });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate test";
    console.error("generate-test error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
