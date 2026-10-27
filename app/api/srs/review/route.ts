import { trustedMutation } from "@/lib/security/same-origin";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { awardXp, advanceStreak } from "@/lib/engine/xp-engine";
import { recordLearningEvent } from "@/lib/engine/learning-dna";
import { type Rating, type SrsCardState } from "@/lib/srs";
import { CLIENT_ID_RE, decideReview, type ReviewStatus } from "@/lib/srs-sync";
import { STREAK_CONFIG, XP_CONFIG } from "@/lib/engine/progression/config";
import { computeSrsReviewXp } from "@/lib/engine/progression/xp";
import { settleProgression } from "@/lib/engine/progression/service";
import { tashkentDayStart } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VALID: Rating[] = ["again", "hard", "good", "easy"];
/** Cap retention-XP per rolling 24h so reviews can't be farmed (central config). */
const DAILY_SRS_XP_CAP = XP_CONFIG.srs.dailyCap;
/** Max reviews accepted in one batch (a game round is well under this). */
const MAX_BATCH = 60;

interface ReviewInput {
  itemKey: string;
  rating: Rating;
  source: "vocab" | "mistake";
  /** Device-made id of a queued grade (idea 7): echoed back so the device can drop it from its queue. */
  clientId?: string;
  /** When the grade was made on the device (epoch ms). Makes the review idempotent — see lib/srs-sync.ts. */
  reviewedAt?: number;
}

function parseReview(raw: unknown): ReviewInput | null {
  const r = raw as { itemKey?: unknown; rating?: unknown; source?: unknown; clientId?: unknown; reviewedAt?: unknown };
  const itemKey = typeof r?.itemKey === "string" ? r.itemKey.trim().slice(0, 200) : "";
  const rating = r?.rating as Rating;
  if (!itemKey || !VALID.includes(rating)) return null;
  return {
    itemKey,
    rating,
    source: r?.source === "mistake" ? "mistake" : "vocab",
    ...(typeof r?.clientId === "string" && CLIENT_ID_RE.test(r.clientId) ? { clientId: r.clientId } : {}),
    ...(typeof r?.reviewedAt === "number" ? { reviewedAt: r.reviewedAt } : {}),
  };
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
    return NextResponse.json({ error: "Review timing is temporarily unavailable. Please retry." }, { status: 503 });
  }
}

/**
 * POST — record one review (`{ itemKey, rating, source }`) or a batch
 * (`{ reviews: [...] }`, used by the recall mini-games in S10).
 *
 * Scheduling reuses the same SM-2 maths as the client (lib/srs.ts) so both stay
 * in sync. A review may carry `clientId` + `reviewedAt` (grades queued on the
 * device while offline or after a failed save): it is then scheduled as of
 * `reviewedAt`, a replay is ignored and a grade older than the card's last
 * review loses to the server state (lib/srs-sync.ts). Each result has a
 * `status` (applied | duplicate | stale | invalid); only applied reviews count
 * toward XP, the streak, the activity log and Learning DNA. Retention-XP is granted only for a genuine, successful review of an
 * item that was actually DUE, and the 24h cap is shared across the whole batch —
 * so a fast game round can't be farmed for XP.
 */
export async function POST(req: NextRequest) {
  if (!trustedMutation(req)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  try {
    const user = await requireAuth();
    const student = await db.student.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "Student profile not found" }, { status: 404 });

    const body = await req.json();
    const raw: unknown[] = Array.isArray(body?.reviews) ? body.reviews.slice(0, MAX_BATCH) : [body];
    const reviews = raw.map(parseReview).filter((r): r is ReviewInput => r !== null);
    if (reviews.length === 0) {
      return NextResponse.json({ error: "Invalid review" }, { status: 400 });
    }

    const mistakeIds = reviews.filter((r) => r.source === "mistake").map((r) => r.itemKey);
    if (mistakeIds.length) {
      const owned = await db.mistakeEntry.findMany({ where: { studentId: student.id, id: { in: mistakeIds } }, select: { id: true } });
      const ids = new Set(owned.map((r) => r.id));
      if (mistakeIds.some((id) => !ids.has(id))) return NextResponse.json({ error: "Review a correction saved in your own account." }, { status: 403 });
    }

    // One budget lookup for the whole request.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todays = await db.activityLog.findMany({
      where: { studentId: student.id, action: "SRS_REVIEW", createdAt: { gte: since } },
      select: { points: true },
    });
    let spent = todays.reduce((s, l) => s + (l.points || 0), 0);

    let totalXp = 0;
    const results: {
      itemKey: string;
      dueAt?: number;
      xp: number;
      status: ReviewStatus;
      clientId?: string;
      /** The server's state for a duplicate or stale grade: the device adopts it (server wins). */
      state?: SrsCardState;
    }[] = [];
    /** Reviews that changed the schedule (duplicates and stale grades don't count twice). */
    const applied: ReviewInput[] = [];
    const seenClientIds = new Set<string>();
    /** Recall quality per review, for the Learning DNA accuracy signal. */
    const RECALL_QUALITY: Record<Rating, number> = { again: 0, hard: 0.5, good: 0.85, easy: 1 };

    for (const rev of reviews) {
      const ids = rev.clientId ? { clientId: rev.clientId } : {};
      if (rev.clientId && seenClientIds.has(rev.clientId)) {
        results.push({ itemKey: rev.itemKey, xp: 0, status: "duplicate", ...ids });
        continue;
      }
      if (rev.clientId) seenClientIds.add(rev.clientId);

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
      // Idempotent and conflict-safe for queued grades (lib/srs-sync.ts); unchanged for online ones.
      const decision = decideReview(
        existing && prev ? { state: prev, lastReviewedAt: existing.lastReviewedAt.getTime() } : null,
        rev.rating,
        rev.reviewedAt,
        now,
      );
      if (decision.status !== "applied") {
        results.push({
          itemKey: rev.itemKey,
          xp: 0,
          status: decision.status,
          ...ids,
          ...(prev ? { dueAt: prev.due, state: prev } : {}),
        });
        continue;
      }

      const next = decision.next;
      const data = {
        source: rev.source,
        ease: next.ease,
        interval: next.interval,
        reps: next.reps,
        lapses: next.lapses,
        dueAt: new Date(next.due),
        lastReviewedAt: new Date(decision.at),
      };
      await db.reviewItem.upsert({
        where: key,
        create: { studentId: student.id, itemKey: rev.itemKey, ...data },
        update: data,
      });
      applied.push(rev);

      // Only a successful review of a due item earns retention-XP.
      let awarded = 0;
      if (decision.wasDue && rev.rating !== "again") {
        awarded = spent >= DAILY_SRS_XP_CAP ? 0 : Math.min(DAILY_SRS_XP_CAP - spent, computeSrsReviewXp(next.interval));
        spent += awarded;
        totalXp += awarded;
      }
      results.push({ itemKey: rev.itemKey, dueAt: next.due, xp: awarded, status: "applied", ...ids });
    }

    // A replayed queue (every grade already recorded) changes nothing else either.
    if (applied.length === 0) return NextResponse.json({ ok: true, xp: 0, results });

    // Flashcards keep the streak alive only after a real review session
    // (STREAK_CONFIG.srsMinReviewsPerDay reviews in this Tashkent day). This is
    // decided independently of XP: reviews after the daily XP cap still count
    // as study.
    const todayRows = await db.activityLog.findMany({
      where: { studentId: student.id, action: "SRS_REVIEW", createdAt: { gte: tashkentDayStart() } },
      select: { details: true },
    });
    const reviewedBefore = todayRows.reduce(
      (n, r) => n + (Number((r.details as { count?: number } | null)?.count) || 0),
      0
    );
    const reviewedToday = reviewedBefore + applied.length;

    if (totalXp > 0) {
      await awardXp({
        studentId: student.id,
        amount: totalXp,
        source: "srs_review",
        skipLog: true,
        activity: "FLASHCARDS",
        breakdown: { lines: [{ label: `${applied.length} reviews`, amount: totalXp }] },
        countsTowardStreak: false,
      });
    }
    if (reviewedToday >= STREAK_CONFIG.srsMinReviewsPerDay) {
      await advanceStreak(student.id).catch(() => null); // idempotent per day
    }
    // One audit row per request keeps the daily budget accounting exact.
    await db.activityLog
      .create({
        data: {
          studentId: student.id,
          action: "SRS_REVIEW",
          details: { count: applied.length, source: applied[0].source },
          points: totalXp,
        },
      })
      .catch(() => {});

    // Learning DNA: recall after a delay is the only honest measure of retention,
    // and the timestamp is what lets the engine detect whether reviewing FIRST
    // improves the rest of this student's session. One event per request keeps the
    // write cost flat for a fast game round while preserving both signals.
    const quality =
      applied.reduce((sum, r) => sum + RECALL_QUALITY[r.rating], 0) / applied.length;
    await recordLearningEvent({
      studentId: student.id,
      kind: "review",
      skill: applied[0].source === "mistake" ? "GRAMMAR" : "VOCABULARY",
      channel: "flashcard",
      accuracy: quality,
      items: applied.length,
      correct: applied.filter((r) => r.rating !== "again").length,
      errorTags: quality < 0.5 ? ["vocabulary_recall"] : [],
    });

    // A 10-card review can complete the Daily Mission warm-up.
    await settleProgression(student.id);

    return NextResponse.json({ ok: true, xp: totalXp, results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record review";
    console.error("SRS review error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
