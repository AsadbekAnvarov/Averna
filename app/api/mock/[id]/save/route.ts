import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveMockDraft } from "@/lib/ielts/mock";

export const dynamic = "force-dynamic";

/** Autosave the running section. Body: { section: number, draft: { answers } | { essays } } */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  let userId: string;
  try {
    userId = (await requireAuth()).id;
  } catch {
    return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  }
  try {
    const student = await db.student.findUnique({ where: { userId }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
    const body = (await req.json().catch(() => ({}))) as { section?: unknown; draft?: unknown };
    const saved = await saveMockDraft(student.id, params.id, Number(body.section), body.draft);
    return NextResponse.json({ ok: saved }, { status: saved ? 200 : 409 });
  } catch (error) {
    console.error("Mock autosave error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
