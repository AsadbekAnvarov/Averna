import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { aiMentorChat } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const { message, history } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const conversationHistory = (history || []).slice(-10).map((msg: any) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));

    const response = await aiMentorChat(message, conversationHistory);

    return NextResponse.json({ response });
  } catch (error: any) {
    console.error("Mentor chat error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
