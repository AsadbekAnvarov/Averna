import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { GEN_ROW_SELECT, isExamGenLevel, summarizeDraft, type GenRow } from "@/lib/ielts/generate";
import type { PreviewResponse } from "@/lib/ielts/generation-types";

export const dynamic = "force-dynamic";

function authError(e: unknown) {
  const signedOut = e instanceof Error && e.message === "Unauthorized";
  return NextResponse.json({ error: signedOut ? "Please sign in." : "Teacher or admin access required." }, { status: signedOut ? 401 : 403 });
}

/** GET ?id= — the full stored JSON of one bulk-generator row (answers included) for review. */
export async function GET(req: NextRequest) {
  try {
    await requireTeacherOrAdmin();
  } catch (e) {
    return authError(e);
  }

  const id = (req.nextUrl.searchParams.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  try {
    const row: GenRow | null = await db.generatedTest.findUnique({ where: { id }, select: GEN_ROW_SELECT });
    if (!row || !isExamGenLevel(row.level)) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    const response: PreviewResponse = { draft: summarizeDraft(row), test: row.data };
    return NextResponse.json(response);
  } catch (error) {
    console.error("exam-gen/preview error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load the draft." }, { status: 500 });
  }
}
