import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getMissionControl } from "@/lib/admin-intel";
import { generateAdminBriefing } from "@/lib/ai";
import { guardAi, cachedAi, dayStamp } from "@/lib/engine/ai-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Ruxsat yoʻq" }, { status: 403 });
    }

    const guard = guardAi(user.id, "admin-briefing");
    if (!guard.ok) {
      return NextResponse.json({ error: guard.message }, { status: 429 });
    }

    const mc = await getMissionControl();

    // Cache server-side for the day, keyed by a fingerprint of the underlying
    // numbers: the same situation never costs a second model call, but the
    // briefing refreshes as soon as the data actually changes.
    const fingerprint = JSON.stringify([mc.bullets, mc.priorities, mc.risks]);
    const summary = await cachedAi(
      `briefing:${user.id}:${dayStamp()}:${fingerprint.length}:${fingerprint.slice(0, 120)}`,
      6 * 60 * 60 * 1000,
      () =>
        generateAdminBriefing({
          firstName: user.name?.split(" ")[0],
          bullets: mc.bullets,
          priorities: mc.priorities,
          risks: mc.risks,
        })
    );

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error("Admin briefing route error:", error);
    return NextResponse.json({ error: error?.message ?? "Xatolik" }, { status: 500 });
  }
}
