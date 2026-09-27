import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { abandonPlacement } from "@/lib/placement/placement";

export const dynamic = "force-dynamic";

/** Leave the placement test for good (it can be started again from the beginning). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  let userId: string;
  try {
    userId = (await requireAuth()).id;
  } catch {
    return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  }
  try {
    const student = await db.student.findUnique({ where: { userId }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
    const ok = await abandonPlacement(student.id, params.id);
    return NextResponse.json({ ok });
  } catch (error) {
    console.error("Placement abandon error:", error);
    return NextResponse.json({ error: "Couldn't leave the placement test. Please try again." }, { status: 500 });
  }
}
