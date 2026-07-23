import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { aiRoleplayReply } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const { scenarioId, message, history } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const conversationHistory = (history || []).slice(-10).map((m: any) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: String(m.content ?? ""),
    }));

    const reply = await aiRoleplayReply(String(scenarioId ?? ""), message, conversationHistory);

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Roleplay route error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to get reply" }, { status: 500 });
  }
}
