import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { analyzeEssayXray } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const { essay, prompt } = await req.json();

    if (!essay || typeof essay !== "string" || essay.trim().length < 20) {
      return NextResponse.json({ error: "Please paste at least a few sentences to X-ray." }, { status: 400 });
    }

    const result = await analyzeEssayXray(essay, typeof prompt === "string" ? prompt : undefined);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Essay X-Ray route error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to analyze essay" }, { status: 500 });
  }
}
