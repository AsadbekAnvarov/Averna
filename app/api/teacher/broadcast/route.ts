import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyUser } from "@/lib/notifications";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Broadcast a message from a teacher to every student in one of their groups.
 * Creates a direct message + a notification for each student.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { groupId, message } = await req.json();
    const text = (message as string)?.trim();
    if (!groupId || !text) {
      return NextResponse.json({ error: "Missing group or message" }, { status: 400 });
    }

    const teacher = await db.teacher.findUnique({ where: { userId: user.id } });

    const group = await db.group.findFirst({
      where: {
        id: groupId,
        ...(user.role === "TEACHER" && teacher ? { teacherId: teacher.id } : {}),
      },
      include: { students: { include: { user: { select: { id: true } } } } },
    });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const body = text.slice(0, 1000);
    const recipients = group.students.map((s) => s.user.id).filter(Boolean);

    await Promise.all(
      recipients.map(async (receiverId) => {
        await db.message.create({
          data: { senderId: user.id, receiverId, content: body },
        });
        await notifyUser(receiverId, {
          type: "message",
          title: `Message from ${user.name ?? "your teacher"}`,
          message: body.length > 60 ? body.slice(0, 60) + "…" : body,
          link: `/messages?with=${user.id}`,
        });
      })
    );

    await recordAudit(
      { id: user.id, name: user.name, role: user.role },
      "Broadcast to group",
      `group=${group.name} recipients=${recipients.length}`
    );

    return NextResponse.json({ ok: true, sent: recipients.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
