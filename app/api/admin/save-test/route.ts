import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { readingTestSchema } from "@/lib/test-schema";

export const dynamic = "force-dynamic";

/**
 * Persist a reviewed, generated Reading test so students can take it.
 * POST body: { test: <ReadingTest JSON>, topic?, level?, publish?: boolean }
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
    const parsed = readingTestSchema.safeParse(body.test);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid or incomplete test data." }, { status: 400 });
    }
    const t = parsed.data;
    const questions = t.passages.reduce((n, p) => n + p.questions.length, 0);

    const row = await db.generatedTest.create({
      data: {
        module: "READING",
        title: t.title,
        description: t.description || "",
        topic: typeof body.topic === "string" ? body.topic : null,
        level: typeof body.level === "string" ? body.level : null,
        published: body.publish !== false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: t as any,
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
