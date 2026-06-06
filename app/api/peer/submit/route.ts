import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const student = await db.student.findUnique({ where: { userId: user.id } });
    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title ?? "").trim().slice(0, 160);
    const taskType = String(body?.taskType ?? "Task 2").slice(0, 40);
    const content = String(body?.content ?? "").trim().slice(0, 8000);

    if (title.length < 3 || content.length < 40) {
      return NextResponse.json(
        { error: "Add a title and at least ~40 characters of writing." },
        { status: 400 }
      );
    }

    try {
      const submission = await (db as any).peerSubmission.create({
        data: {
          studentId: student.id,
          authorName: user.name ?? "Student",
          groupId: student.groupId ?? null,
          title,
          taskType,
          content,
        },
      });
      return NextResponse.json({ ok: true, id: submission.id });
    } catch (e) {
      // Table likely not migrated yet
      return NextResponse.json(
        { error: "Peer Review isn't set up yet. Ask an admin to run the database migration." },
        { status: 503 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
