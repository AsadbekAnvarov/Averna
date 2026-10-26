/** "Your peer speaking" progress card data for the Speaking hub (docs/peer-speaking.md, Phase C). Server only. */
import { db } from "@/lib/db";
import { tashkentDateKey, tashkentWeekStart } from "@/lib/utils";
import type { Criterion, Ratings } from "./feedback-presets";
import { averageRatings, nextStepFor, ratingTrend, type NextStep } from "./next-step";

export interface PeerProgress {
  sessionsThisWeek: number;
  partnersThisMonth: number;
  /** Mean of the last 10 feedbacks received, per criterion (null with none). */
  received: Ratings | null;
  receivedCount: number;
  trend: Record<Criterion, "up" | "down" | "flat"> | null;
  nextStep: NextStep | null;
}

/** Monday 00:00 Tashkent of this week, and the 1st of this month 00:00 Tashkent. */
function periodStarts(now: Date) {
  return { week: tashkentWeekStart(now), month: new Date(`${tashkentDateKey(now).slice(0, 7)}-01T00:00:00+05:00`) };
}

export async function peerProgress(studentId: string, now = new Date()): Promise<PeerProgress> {
  const { week, month } = periodStarts(now);
  const since = week < month ? week : month;
  const [rooms, feedback] = await Promise.all([
    db.speakingRoom.findMany({
      where: { createdAt: { gte: since }, OR: [{ studentAId: studentId }, { studentBId: studentId }] },
      select: { createdAt: true, studentAId: true, studentBId: true },
      take: 500,
    }),
    db.speakingPeerFeedback.findMany({
      where: { toStudentId: studentId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { fluency: true, lexical: true, grammar: true, pronunciation: true },
    }),
  ]);
  const partners = new Set(rooms.filter((r) => r.createdAt >= month).map((r) => (r.studentAId === studentId ? r.studentBId : r.studentAId)));
  const received = averageRatings(feedback);
  return {
    sessionsThisWeek: rooms.filter((r) => r.createdAt >= week).length,
    partnersThisMonth: partners.size,
    received,
    receivedCount: feedback.length,
    trend: ratingTrend(feedback),
    nextStep: nextStepFor(received),
  };
}
