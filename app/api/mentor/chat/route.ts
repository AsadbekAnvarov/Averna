import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiMentorChat } from "@/lib/ai";
import { guardAi } from "@/lib/engine/ai-guard";
import { getDnaPromptContext, recordLearningEvent } from "@/lib/engine/learning-dna";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const guard = guardAi(user.id, "mentor-chat");
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: 429 });

    const { message, history } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const conversationHistory = (history || []).slice(-10).map((msg: any) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));

    // Ground the mentor in the student's Learning DNA so it explains things the
    // way this person actually learns, instead of restarting from zero every chat.
    const student = await db.student
      .findUnique({ where: { userId: user.id }, select: { id: true } })
      .catch(() => null);
    const dna = student ? await getDnaPromptContext(student.id).catch(() => null) : null;

    const response = await aiMentorChat(message, conversationHistory, dna);

    // A mentor conversation is a learning behaviour in its own right.
    if (student) {
      await recordLearningEvent({
        studentId: student.id,
        kind: "ai_chat",
        channel: "conversation",
        items: 1,
      });
    }

    return NextResponse.json({ response });
  } catch (error: any) {
    console.error("Mentor chat error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
