import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyUser } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { receiverId, content } = await req.json();
    const text = (content as string)?.trim();
    if (!receiverId || !text) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    await db.message.create({
      data: { senderId: user.id, receiverId, content: text.slice(0, 1000) },
    });
    await notifyUser(receiverId, {
      type: "message",
      title: `New message from ${user.name ?? "someone"}`,
      message: text.length > 60 ? text.slice(0, 60) + "…" : text,
      link: `/messages?with=${user.id}`,
    });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
