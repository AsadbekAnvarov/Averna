import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Toggle a single emoji reaction on a message the user can see.
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { messageId, emoji } = await req.json();
    if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });

    const msg = await db.message.findUnique({ where: { id: messageId } });
    if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Only participants can react
    if (msg.senderId !== user.id && msg.receiverId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Toggle off if the same emoji is reapplied
    const next = msg.reaction === emoji ? null : (emoji as string)?.slice(0, 8) || null;
    await db.message.update({ where: { id: messageId }, data: { reaction: next } });
    return NextResponse.json({ ok: true, reaction: next });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
