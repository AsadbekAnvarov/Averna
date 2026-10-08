import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { beginPlacementSection } from "@/lib/placement/placement";

export const dynamic = "force-dynamic";

/** Start the clock of the current section. Body: { section: number } */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  let userId: string;
  try {
    userId = (await requireAuth()).id;
  } catch {
    return NextResponse.json({ error: "Your session has expired. Sign in again to continue." }, { status: 401 });
  }
  try {
    const student = await db.student.findUnique({ where: { userId }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
    const body = (await req.json().catch(() => ({}))) as { section?: unknown };
    const r = await beginPlacementSection(student.id, params.id, Number(body.section));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Placement begin error:", error);
    return NextResponse.json({ error: "The section couldn't be started. Please try again." }, { status: 500 });
  }
}
