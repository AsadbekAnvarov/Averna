import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getExamReadiness, getMemoryTimeline } from "@/lib/student-intel";
import { avernaAssistant } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { message, history } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const student = await db.student.findUnique({
      where: { userId: user.id },
      select: { id: true, totalPoints: true, currentStreak: true, longestStreak: true, targetBand: true },
    });
    if (!student) return NextResponse.json({ error: "No student profile" }, { status: 403 });

    const [readiness, memory] = await Promise.all([getExamReadiness(student.id), getMemoryTimeline(student.id)]);

    const fading = memory.filter((m) => m.status === "fading" || m.status === "forgotten").map((m) => m.label);
    const perSkill = readiness.perSkill
      .map((s) => `${s.label}: ${s.predicted != null ? `Band ${s.predicted.toFixed(1)}${s.trend === "up" ? " (rising)" : s.trend === "down" ? " (falling)" : ""}` : "no data"}`)
      .join("; ");

    const profileText = [
      `First name: ${user.name?.split(" ")[0] ?? "the student"}.`,
      `Target band: ${student.targetBand ?? "not set"}.`,
      `Predicted overall band: ${readiness.overall != null ? readiness.overall.toFixed(1) : "unknown"} (${readiness.confidence ?? "low"} confidence).`,
      `Per skill — ${perSkill}.`,
      readiness.weakest ? `Weakest skill: ${readiness.weakest.label} (Band ${readiness.weakest.predicted?.toFixed(1)}).` : "",
      `Streak: ${student.currentStreak} days (best ${student.longestStreak}). XP: ${student.totalPoints}.`,
      fading.length ? `Skills fading from memory (need review): ${fading.join(", ")}.` : "Memory retention is currently strong.",
    ]
      .filter(Boolean)
      .join(" ");

    // Rule-based fallback grounded in the same data
    const m = message.toLowerCase();
    const weak = readiness.weakest;
    let fallback: string;
    if (/(study|do).*(today|now)|what should/.test(m)) {
      fallback = weak
        ? `Start with ${weak.label} today — it's your lowest predicted band (${weak.predicted?.toFixed(1)}). Do one ${weak.label} test, then review the mistakes it surfaces.`
        : `Take a test in any skill today so I can map your levels and give you a precise plan.`;
    } else if (/(stuck|not improv|plateau|why)/.test(m)) {
      const falling = readiness.perSkill.filter((s) => s.trend === "down").map((s) => s.label);
      fallback = falling.length
        ? `${falling.join(" & ")} ${falling.length === 1 ? "has" : "have"} dipped recently — that's usually pacing or careless errors. Slow down and review your last attempts.`
        : `Progress often plateaus before a jump. Focus on ${weak?.label ?? "your weakest skill"} and keep your ${student.currentStreak}-day streak going.`;
    } else if (/(forget|mistake|weak|remember)/.test(m)) {
      fallback = fading.length
        ? `You're starting to forget ${fading.join(", ")}. Review those first — the Mistake Bank and Memory Timeline show exactly what's fading.`
        : `Your retention looks strong right now. Keep reviewing in the Mistake Bank to lock it in.`;
    } else if (/(band|goal|path|8|target)/.test(m)) {
      fallback = weak && readiness.overall != null
        ? `You're at ~Band ${readiness.overall.toFixed(1)}${student.targetBand ? `, targeting ${student.targetBand}` : ""}. The fastest path: lift ${weak.label} (your weakest) while holding your strengths. Consistency + weak-skill focus is the formula.`
        : `Set a target band and take a few tests — then I'll map your fastest path to it.`;
    } else {
      fallback = weak
        ? `Right now your best lever is ${weak.label} (Band ${weak.predicted?.toFixed(1)}). Want a quick plan for it?`
        : `Take a test so I can read your levels and guide you precisely.`;
    }

    const reply = await avernaAssistant(profileText, message, Array.isArray(history) ? history : [], fallback);
    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Averna AI route error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
  }
}
