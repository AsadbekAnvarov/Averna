import { db } from "@/lib/db";

/**
 * F2 — AI Learning Journal (read-only).
 *
 * Turns each active study day into a meaningful reflection built from real data
 * (tests taken + best-ever bands, XP earned, achievements unlocked). No raw
 * stat dumps — a growth story. No writes, no schema change. English UI.
 */

const MODULE_LABEL: Record<string, string> = { READING: "Reading", LISTENING: "Listening", WRITING: "Writing", SPEAKING: "Speaking" };

export interface JournalEntry {
  dateKey: string;
  dateLabel: string;
  reflection: string;
  highlights: string[];
  points: number;
}

function dayKey(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

export async function getLearningJournal(studentId: string, days = 30): Promise<JournalEntry[]> {
  const since = new Date(Date.now() - days * 86_400_000);

  const [activity, tests, achievements] = await Promise.all([
    db.activityLog.findMany({ where: { studentId, createdAt: { gte: since } }, select: { action: true, points: true, createdAt: true } }),
    db.iELTSTest.findMany({ where: { studentId }, orderBy: { completedAt: "asc" }, select: { module: true, score: true, completedAt: true } }),
    db.studentAchievement.findMany({
      where: { studentId, unlockedAt: { gte: since } },
      select: { unlockedAt: true, achievement: { select: { name: true } } },
    }),
  ]);

  // running best band per module (to detect personal bests)
  const bestSoFar = new Map<string, number>();

  // group signals by day
  interface DayAcc {
    points: number;
    actions: number;
    tests: { module: string; score: number; isBest: boolean }[];
    achievements: string[];
  }
  const byDay = new Map<string, DayAcc>();
  const ensure = (k: string) => {
    let d = byDay.get(k);
    if (!d) {
      d = { points: 0, actions: 0, tests: [], achievements: [] };
      byDay.set(k, d);
    }
    return d;
  };

  for (const t of tests) {
    const prevBest = bestSoFar.get(t.module) ?? 0;
    const isBest = t.score > prevBest && t.score > 0;
    if (t.score > prevBest) bestSoFar.set(t.module, t.score);
    if (t.completedAt >= since) {
      const d = ensure(dayKey(t.completedAt));
      d.tests.push({ module: t.module, score: t.score, isBest });
    }
  }
  for (const a of activity) {
    const d = ensure(dayKey(a.createdAt));
    d.points += a.points || 0;
    d.actions += 1;
  }
  for (const ac of achievements) {
    const d = ensure(dayKey(ac.unlockedAt));
    if (ac.achievement?.name) d.achievements.push(ac.achievement.name);
  }

  const entries: JournalEntry[] = [];
  for (const [k, d] of byDay) {
    if (d.actions === 0 && d.tests.length === 0 && d.achievements.length === 0) continue;

    const highlights: string[] = [];
    const parts: string[] = [];

    const best = d.tests.find((t) => t.isBest);
    if (best) parts.push(`your strongest ${MODULE_LABEL[best.module] ?? best.module} yet — Band ${best.score.toFixed(1)}`);
    if (d.tests.length > 0) highlights.push(`${d.tests.length} test${d.tests.length === 1 ? "" : "s"}`);
    if (d.achievements.length > 0) {
      parts.push(`unlocked ${d.achievements[0]}${d.achievements.length > 1 ? ` +${d.achievements.length - 1} more` : ""}`);
      highlights.push(`🏆 ${d.achievements.length}`);
    }
    if (d.points > 0) highlights.push(`+${d.points} XP`);

    let reflection: string;
    if (parts.length > 0) {
      reflection = `You ${parts.join(", and ")}.`;
    } else if (d.tests.length >= 2) {
      reflection = `A focused day — ${d.tests.length} practice tests done. Consistency like this compounds.`;
    } else if (d.actions >= 3) {
      reflection = `You showed up and put in the work. Small daily steps are how bands are built.`;
    } else {
      reflection = `You kept the streak alive today. Momentum matters more than intensity.`;
    }

    entries.push({
      dateKey: k,
      dateLabel: new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(k)),
      reflection,
      highlights,
      points: d.points,
    });
  }

  return entries.sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
}
