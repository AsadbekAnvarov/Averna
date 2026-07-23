import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateDailyBriefing } from "@/lib/ai";

export const dynamic = "force-dynamic";

const MODULE_LABEL: Record<string, string> = {
  READING: "Reading",
  LISTENING: "Listening",
  WRITING: "Writing",
  SPEAKING: "Speaking",
};

export async function GET() {
  try {
    const user = await requireAuth();

    const student = await db.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    let focusArea = "General";
    let recentBand: number | undefined;

    if (student) {
      const tests = await db.iELTSTest.findMany({
        where: { studentId: student.id },
        orderBy: { completedAt: "desc" },
        take: 40,
        select: { module: true, score: true },
      });

      // Average band per module, then pick the weakest as today's focus.
      const sums = new Map<string, { total: number; n: number }>();
      for (const t of tests) {
        const agg = sums.get(t.module) ?? { total: 0, n: 0 };
        agg.total += t.score;
        agg.n += 1;
        sums.set(t.module, agg);
      }
      let lowest = Infinity;
      for (const [mod, agg] of sums) {
        const avg = agg.total / agg.n;
        if (avg < lowest) {
          lowest = avg;
          focusArea = MODULE_LABEL[mod] ?? "General";
          recentBand = Math.round(avg * 10) / 10;
        }
      }
    }

    const dateLabel = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());

    const briefing = await generateDailyBriefing({
      studentName: user.name?.split(" ")[0],
      focusArea,
      recentBand,
      dateLabel,
    });

    return NextResponse.json({ ...briefing, focusArea, dateLabel });
  } catch (error: any) {
    console.error("Daily podcast route error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to generate episode" }, { status: 500 });
  }
}
