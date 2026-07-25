import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateStudentPoints } from "@/lib/db-helpers";
import { schedule, type Rating, type SrsCardState } from "@/lib/srs";

export const dynamic = "force-dynamic";

const VALID: Rating[] = ["again", "hard", "good", "easy"];
/** Cap retention-XP per rolling 24h so reviews can't be farmed. */
const DAILY_SRS_XP_CAP = 60;

/**
 * Server-backed spaced-repetition ledger. The client keeps localStorage for
 * instant review UX and mirrors each review here so retention persists across
 * devices, is visible to the AI, and earns modest retention-XP (which also
 * advances the verified streak). Scheduling reuses the same SM-2 math as the
 * client (lib/srs.ts) so both stay in sync.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const student = await db.student.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "Student profile not found" }, { status: 404 });

    const body = await req.json();
    const itemKey = typeof body.itemKey === "string" ? body.itemKey.slice(0, 200) : "";
    const rating = body.rating as Rating;
    const source = body.source === "mistake" ? "mistake" : "vocab";
    if (!itemKey || !VALID.includes(rating)) {
      return NextResponse.json({ error: "Invalid review" }, { status: 400 });
    }

    const now = Date.now();
    const key = { studentId_itemKey: { studentId: student.id, itemKey } };
    const existing = await db.reviewItem.findUnique({ where: key });

    const prev: SrsCardState | undefined = existing
      ? { ease: existing.ease, interval: existing.interval, due: existing.dueAt.getTime(), reps: existing.reps, lapses: existing.lapses }
      : undefined;
    const wasDue = !existing || existing.dueAt.getTime() <= now;

    const next = schedule(prev, rating, now);
    const data = {
      source,
      ease: next.ease,
      interval: next.interval,
      reps: next.reps,
      lapses: next.lapses,
      dueAt: new Date(next.due),
      lastReviewedAt: new Date(now),
    };
    await db.reviewItem.upsert({
      where: key,
      create: { studentId: student.id, itemKey, ...data },
      update: data,
    });

    // Retention-XP only for a genuine, successful spaced review. It's naturally
    // rate-limited (an item isn't due again for its interval) plus a daily cap.
    let awarded = 0;
    if (wasDue && rating !== "again") {
      const since = new Date(now - 24 * 60 * 60 * 1000);
      const todays = await db.activityLog.findMany({
        where: { studentId: student.id, action: "SRS_REVIEW", createdAt: { gte: since } },
        select: { points: true },
      });
      const dailySrsXp = todays.reduce((s, l) => s + (l.points || 0), 0);
      awarded = dailySrsXp >= DAILY_SRS_XP_CAP ? 0 : Math.min(12, 3 + Math.floor(next.interval / 4));
      if (awarded > 0) {
        await updateStudentPoints(student.id, awarded); // also advances the verified streak
      }
      await db.activityLog.create({
        data: { studentId: student.id, action: "SRS_REVIEW", details: { itemKey, source, rating }, points: awarded },
      });
    }

    return NextResponse.json({ ok: true, dueAt: next.due, xp: awarded });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record review";
    console.error("SRS review error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
