import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { awardXp } from "@/lib/engine/xp-engine";
import { getDailyQuestions } from "@/lib/challenge-questions";
import { computeDailyQuizXp } from "@/lib/engine/progression/xp";
import { XP_CONFIG } from "@/lib/engine/progression/config";
import { settleProgression } from "@/lib/engine/progression/service";
import { tashkentDateKey, tashkentDayStart } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Daily 5-question challenge.
 *
 * Scored SERVER-SIDE from the chosen options against today's deterministic
 * question set (the client used to post its own `score`, which let anyone
 * claim a perfect result). Rewarded once per Tashkent day: the ledger key
 * `quiz:<day>` makes concurrent/double submissions impossible to double-pay.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const student = await db.student.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const chosen: unknown[] = Array.isArray(body?.answers) ? body.answers.slice(0, XP_CONFIG.dailyQuiz.questions) : [];
    // Score against the set the student saw: today's, or yesterday's when the
    // set was opened just before midnight (Tashkent). Anything else is today's.
    const yesterdayKey = tashkentDateKey(new Date(Date.now() - 86400000));
    const setDate = body?.dayKey === yesterdayKey ? new Date(Date.now() - 86400000) : new Date();
    const questions = getDailyQuestions(setDate);
    const score = questions.reduce((n, q, i) => (chosen[i] === q.answer ? n + 1 : n), 0);
    const answered = chosen.filter((c) => typeof c === "number").length;

    const dayKey = tashkentDateKey();
    const already = await db.activityLog.findFirst({
      where: { studentId: student.id, action: "DAILY_CHALLENGE", createdAt: { gte: tashkentDayStart() } },
      select: { id: true },
    });
    if (already) {
      return NextResponse.json({ alreadyDone: true, pointsEarned: 0, score });
    }

    const pointsEarned = answered >= questions.length ? computeDailyQuizXp(score) : 0;
    const award = await awardXp({
      studentId: student.id,
      amount: pointsEarned,
      source: "challenge",
      idempotencyKey: `quiz:${dayKey}`,
      activity: "DAILY_QUIZ",
      breakdown: { lines: [{ label: `${score}/${questions.length} correct`, amount: pointsEarned }] },
      skipLog: true,
      // Completing the daily set is meaningful practice — it keeps the streak.
      countsTowardStreak: pointsEarned > 0,
    });
    if (award.duplicate) {
      return NextResponse.json({ alreadyDone: true, pointsEarned: 0, score });
    }

    await db.activityLog.create({
      data: { studentId: student.id, action: "DAILY_CHALLENGE", details: { score, answered }, points: pointsEarned },
    });
    const rewards = await settleProgression(student.id);

    return NextResponse.json({ alreadyDone: false, pointsEarned, score, rewards });
  } catch (error: unknown) {
    console.error("Daily challenge error:", error);
    return NextResponse.json({ error: "Your result couldn't be saved. Please try again." }, { status: 500 });
  }
}
