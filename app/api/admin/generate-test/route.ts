import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/auth";
import { generateReadingTest, generateListeningTest, generateWritingPrompt } from "@/lib/ai";

export const dynamic = "force-dynamic";
// Full-test generation is a large model call; request a longer function budget.
export const maxDuration = 60;

/**
 * Admin/teacher endpoint that generates an ORIGINAL IELTS test and returns the
 * validated JSON for review.
 *
 * POST body: { module?: "reading" | "listening"; topic: string; level?: string;
 *              difficulty?: "Easy"|"Medium"|"Hard"; count?: number }
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

    const module = (typeof body.module === "string" ? body.module : "reading").toLowerCase();
    const count = typeof body.count === "number" ? body.count : undefined;

    if (module === "writing") {
      const test = await generateWritingPrompt({
        topic,
        essayType: typeof body.level === "string" && body.level.trim() ? body.level.trim() : undefined,
      });
      return NextResponse.json({ ok: true, module: "writing", test });
    }

    if (module === "listening") {
      const test = await generateListeningTest({
        topic,
        difficulty:
          body.difficulty === "Easy" || body.difficulty === "Medium" || body.difficulty === "Hard"
            ? body.difficulty
            : undefined,
        sectionCount: count,
      });
      return NextResponse.json({ ok: true, module: "listening", test });
    }

    const test = await generateReadingTest({
      topic,
      level: typeof body.level === "string" ? body.level : undefined,
      passageCount: count ?? (typeof body.passageCount === "number" ? body.passageCount : undefined),
    });
    return NextResponse.json({ ok: true, module: "reading", test });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate test";
    console.error("generate-test error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
