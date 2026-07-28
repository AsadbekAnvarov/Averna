import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { awardXp } from "@/lib/engine/xp-engine";
import { recordLearningEvent } from "@/lib/engine/learning-dna";
import { schedule, type Rating, type SrsCardState } from "@/lib/srs";

export const dynamic = "force-dynamic";

const VALID: Rating[] = ["again", "hard", "good", "easy"];
/** Cap retention-XP per rolling 24h so reviews can't be farmed. */
const DAILY_SRS_XP_CAP = 60;
/** Max reviews accepted in one batch (a game round is well under this). */
const MAX_BATCH = 60;

interface ReviewInput {
  itemKey: string;
  rating: Rating;
  source: "vocab" | "mistake";
}

function parseReview(raw: unknown): ReviewInput | null {
  const r = raw as { itemKey?: unknown; rating?: unknown; source?: unknown };
  const itemKey = typeof r?.itemKey === "string" ? r.itemKey.trim().slice(0, 200) : "";
  const rating = r?.rating as Rating;
  if (!itemKey || !VALID.includes(rating)) return null;
  return { itemKey, rating, source: r?.source === "mistake" ? "mistake" : "vocab" };
}

/**
 * GET — the student's spaced-repetition ledger, shaped like the client's SrsMap
 * so a second device can seed itself from the server instead of starting over
 * (S6: the server is the durable source of truth; localStorage is a fast cache).
 */
export async function GET() {
  try {
    const user = await requireAuth();
    const student = await db.student.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!student) return NextResponse.json({ items: {} });

    const rows = await db.reviewItem.findMany({
      where: { studentId: student.id },
      select: { itemKey: true, ease: true, interval: true, reps: true, lapses: true, dueAt: true },
    });

    const items: Record<string, SrsCardState> = {};
    for (const r of rows) {
      items[r.itemKey] = {
        ease: r.ease,
        interval: r.interval,
        due: r.dueAt.getTime(),
        reps: r.reps,
        lapses: r.lapses,
      };
    }
    return NextResponse.json({ items });
  } catch {
    // Never break the review UI because sync is unavailable.
    return NextResponse.json({ items: {} });
  }
}

/**
 * POST — record one review (`{ itemKey, rating, source }`) or a batch
 * (`{ reviews: [...] }`, used by the recall mini-games in S10).
 *
 * Scheduling reuses the same SM-2 maths as the client (lib/srs.ts) so both stay
 * in sync. Retention-XP is granted only for a genuine, successful review of an
 * item that was actually DUE, and the 24h cap is shared across the whole batch —
 * so a fast game round can't be farmed for XP.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const student = await db.student.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "Student profile not found" }, { status: 404 });

    const body = await req.json();
    const raw = Array.isArray(body?.reviews) ? body.reviews.slice(0, MAX_BATCH) : [body];
    const reviews = raw.map(parseReview).filter((r): r is ReviewInput => r !== null);
    if (reviews.length === 0) {
      return NextResponse.json({ error: "Invalid review" }, { status: 400 });
    }

    // One budget lookup for the whole request.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todays = await db.activityLog.findMany({
      where: { studentId: student.id, action: "SRS_REVIEW", createdAt: { gte: since } },
      select: { points: true },
    });
    let spent = todays.reduce((s, l) => s + (l.points || 0), 0);

    let totalXp = 0;
    const results: { itemKey: string; dueAt: number; xp: number }[] = [];
    /** Recall quality per review, for the Learning DNA accuracy signal. */
    const RECALL_QUALITY: Record<Rating, number> = { again: 0, hard: 0.5, good: 0.85, easy: 1 };

    for (const rev of reviews) {
      const now = Date.now();
      const key = { studentId_itemKey: { studentId: student.id, itemKey: rev.itemKey } };
      const existing = await db.reviewItem.findUnique({ where: key });

      const prev: SrsCardState | undefined = existing
        ? {
            ease: existing.ease,
            interval: existing.interval,
            due: existing.dueAt.getTime(),
            reps: existing.reps,
            lapses: existing.lapses,
          }
        : undefined;
      const wasDue = !existing || existing.dueAt.getTime() <= now;

      const next = schedule(prev, rev.rating, now);
      const data = {
        source: rev.source,
        ease: next.ease,
        interval: next.interval,
        reps: next.reps,
        lapses: next.lapses,
        dueAt: new Date(next.due),
        lastReviewedAt: new Date(now),
      };
      await db.reviewItem.upsert({
        where: key,
        create: { studentId: student.id, itemKey: rev.itemKey, ...data },
        update: data,
      });

      // Only a successful review of a due item earns retention-XP.
      let awarded = 0;
      if (wasDue && rev.rating !== "again") {
        awarded = spent >= DAILY_SRS_XP_CAP ? 0 : Math.min(12, 3 + Math.floor(next.interval / 4));
        spent += awarded;
        totalXp += awarded;
      }
      results.push({ itemKey: rev.itemKey, dueAt: next.due, xp: awarded });
    }

    if (totalXp > 0) {
      // Learning source → also advances the verified streak.
      await awardXp({ studentId: student.id, amount: totalXp, source: "srs_review", skipLog: true });
    }
    // One audit row per request keeps the daily budget accounting exact.
    await db.activityLog
      .create({
        data: {
          studentId: student.id,
          action: "SRS_REVIEW",
          details: { count: reviews.length, source: reviews[0].source },
          points: totalXp,
        },
      })
      .catch(() => {});

    // Learning DNA: recall after a delay is the only honest measure of retention,
    // and the timestamp is what lets the engine detect whether reviewing FIRST
    // improves the rest of this student's session. One event per request keeps the
    // write cost flat for a fast game round while preserving both signals.
    const quality =
      reviews.reduce((sum, r) => sum + RECALL_QUALITY[r.rating], 0) / reviews.length;
    await recordLearningEvent({
      studentId: student.id,
      kind: "review",
      skill: reviews[0].source === "mistake" ? "GRAMMAR" : "VOCABULARY",
      channel: "flashcard",
      accuracy: quality,
      items: reviews.length,
      correct: reviews.filter((r) => r.rating !== "again").length,
      errorTags: quality < 0.5 ? ["vocabulary_recall"] : [],
    });

    return NextResponse.json({ ok: true, xp: totalXp, results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record review";
    console.error("SRS review error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
