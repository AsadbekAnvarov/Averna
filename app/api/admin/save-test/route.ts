import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { readingTestSchema, listeningTestSchema, writingPromptSchema, writingTask1Schema, speakingTestSchema } from "@/lib/test-schema";

export const dynamic = "force-dynamic";

/**
 * Persist a reviewed, generated test so students can take it.
 * POST body: { module?: "reading"|"listening", test: <Test JSON>, topic?, level?, publish?: boolean }
 */
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireTeacherOrAdmin();
  } catch {
    return NextResponse.json({ error: "Teacher or admin access required." }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const module = (typeof body.module === "string" ? body.module : "reading").toLowerCase();

    let title: string;
    let description: string;
    let questions: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    let moduleKey: string;

    if (module === "speaking") {
      const parsed = speakingTestSchema.safeParse(body.test);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid or incomplete speaking set data." }, { status: 400 });
      }
      const t = parsed.data;
      title = t.title;
      description = t.topic || "Speaking practice set";
      questions = 0;
      data = t;
      moduleKey = "SPEAKING";
    } else if (module === "writing-task1") {
      const parsed = writingTask1Schema.safeParse(body.test);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid or incomplete Task 1 data." }, { status: 400 });
      }
      const t = parsed.data;
      title = t.title;
      description = t.type || "";
      questions = 0;
      data = t;
      moduleKey = "WRITING_TASK1";
    } else if (module === "writing") {
      const parsed = writingPromptSchema.safeParse(body.test);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid or incomplete writing prompt data." }, { status: 400 });
      }
      const t = parsed.data;
      title = t.title;
      description = t.type || "";
      questions = 0;
      data = t;
      moduleKey = "WRITING";
    } else if (module === "listening") {
      const parsed = listeningTestSchema.safeParse(body.test);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid or incomplete listening test data." }, { status: 400 });
      }
      const t = parsed.data;
      title = t.title;
      description = t.description || "";
      questions = t.sections.reduce((n, s) => n + s.questions.length, 0);
      data = t;
      moduleKey = "LISTENING";
    } else {
      const parsed = readingTestSchema.safeParse(body.test);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid or incomplete reading test data." }, { status: 400 });
      }
      const t = parsed.data;
      title = t.title;
      description = t.description || "";
      questions = t.passages.reduce((n, p) => n + p.questions.length, 0);
      data = t;
      moduleKey = "READING";
    }

    const row = await db.generatedTest.create({
      data: {
        module: moduleKey,
        title,
        description,
        topic: typeof body.topic === "string" ? body.topic : null,
        level: typeof body.level === "string" ? body.level : null,
        published: body.publish !== false,
        data,
        createdById: user.id,
      },
    });

    return NextResponse.json({ ok: true, id: row.id, questions });
  } catch (error) {
    console.error("save-test error:", error);
    const message = error instanceof Error ? error.message : "Failed to save the test";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
