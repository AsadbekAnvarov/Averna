import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getMissionControl } from "@/lib/admin-intel";
import { generateAdminBriefing } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Ruxsat yoʻq" }, { status: 403 });
    }

    const mc = await getMissionControl();
    const summary = await generateAdminBriefing({
      firstName: user.name?.split(" ")[0],
      bullets: mc.bullets,
      priorities: mc.priorities,
      risks: mc.risks,
    });

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error("Admin briefing route error:", error);
    return NextResponse.json({ error: error?.message ?? "Xatolik" }, { status: 500 });
  }
}
