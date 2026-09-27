import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasOpenAI } from "@/lib/ai";
import { GEN_ROW_SELECT, GEN_SKILLS, LEVEL_PREFIX, MODULE_FOR, isGenSkill, summarizeDraft, type GenRow } from "@/lib/ielts/generate";
import type { DraftsResponse } from "@/lib/ielts/generation-types";

export const dynamic = "force-dynamic";

function authError(e: unknown) {
  const signedOut = e instanceof Error && e.message === "Unauthorized";
  return NextResponse.json({ error: signedOut ? "Please sign in." : "Teacher or admin access required." }, { status: signedOut ? 401 : 403 });
}

/** GET ?skill=READING|LISTENING|WRITING_TASK1|WRITING_TASK2|SPEAKING|ALL — bulk-generator rows, newest first (max 500). */
export async function GET(req: NextRequest) {
  try {
    await requireTeacherOrAdmin();
  } catch (e) {
    return authError(e);
  }

  const skill = (req.nextUrl.searchParams.get("skill") ?? "ALL").trim().toUpperCase();
  if (skill !== "ALL" && !isGenSkill(skill)) {
    return NextResponse.json({ error: "skill must be READING, LISTENING, WRITING_TASK1, WRITING_TASK2, SPEAKING or ALL." }, { status: 400 });
  }

  try {
    const modules = isGenSkill(skill) ? [MODULE_FOR[skill]] : GEN_SKILLS.map((s) => MODULE_FOR[s]);
    const rows: GenRow[] = await db.generatedTest.findMany({
      where: { level: { startsWith: LEVEL_PREFIX }, module: { in: modules } },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: GEN_ROW_SELECT,
    });
    const now = Date.now();
    const response: DraftsResponse = { drafts: rows.map((r) => summarizeDraft(r, now)), openAiConfigured: hasOpenAI() };
    return NextResponse.json(response);
  } catch (error) {
    console.error("exam-gen/drafts error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load the drafts." }, { status: 500 });
  }
}
