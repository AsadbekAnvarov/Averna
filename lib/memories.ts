import { db } from "@/lib/db";
import { getStudentTests } from "@/lib/student-intel";
import { predictBand } from "@/lib/utils";

/**
 * F9 — Memories (read-only).
 *
 * Occasionally reminds a student of their own journey using real data:
 * anniversaries, band growth since their first test, "on this day" moments,
 * and where it all began. No writes, no schema change, no new heavy queries —
 * it reuses the shared cached getStudentTests(). English UI.
 */

const DAY = 86_400_000;
const MODULE_LABEL: Record<string, string> = {
  READING: "Reading",
  LISTENING: "Listening",
  WRITING: "Writing",
  SPEAKING: "Speaking",
};

export interface Memory {
  id: string;
  emoji: string;
  title: string;
  body: string;
  /** Tailwind gradient `from-*` class for the card's soft accent wash. */
  accent: string;
  /** Higher = more emotionally meaningful; used to order the stack. */
  weight: number;
}

function humanAgo(d: Date, now: Date): string {
  const days = Math.floor((now.getTime() - d.getTime()) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const w = Math.round(days / 7);
    return `${w} week${w > 1 ? "s" : ""} ago`;
  }
  if (days < 365) {
    const m = Math.round(days / 30);
    return `${m} month${m > 1 ? "s" : ""} ago`;
  }
  const y = Math.floor(days / 365);
  return `${y} year${y > 1 ? "s" : ""} ago`;
}

const sameCalendarDay = (a: Date, b: Date) => a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export async function getMemories(studentId: string): Promise<Memory[]> {
  const [tests, student, firstAchievement] = await Promise.all([
    getStudentTests(studentId),
    db.student.findUnique({ where: { id: studentId }, select: { createdAt: true } }),
    db.studentAchievement.findFirst({
      where: { studentId },
      orderBy: { unlockedAt: "asc" },
      select: { unlockedAt: true, achievement: { select: { name: true } } },
    }),
  ]);

  const now = new Date();
  const memories: Memory[] = [];
  const scored = tests.filter((t) => t.score > 0); // ascending by completedAt

  // 1. Anniversary of joining Averna (only on the actual calendar day, 1y+).
  if (student) {
    const days = Math.floor((now.getTime() - student.createdAt.getTime()) / DAY);
    const years = Math.floor(days / 365);
    if (years >= 1 && sameCalendarDay(now, student.createdAt)) {
      memories.push({
        id: "join-anniversary",
        emoji: "🎂",
        title: `${years} year${years > 1 ? "s" : ""} with Averna`,
        body: `Exactly ${years} year${years > 1 ? "s" : ""} ago today you began your IELTS journey here. Look how far you've come.`,
        accent: "from-averna-pink/30",
        weight: 100,
      });
    }
  }

  // 2. Overall band growth since the very first test.
  if (scored.length >= 3) {
    const firstBand = scored[0].score;
    const p = predictBand(scored.map((t) => t.score));
    const current = p ? p.current : scored[scored.length - 1].score;
    const delta = Math.round((current - firstBand) * 10) / 10;
    if (delta >= 0.5) {
      memories.push({
        id: "band-growth",
        emoji: "📈",
        title: `+${delta.toFixed(1)} band${delta >= 2 ? "s" : ""} since day one`,
        body: `Your very first test scored Band ${firstBand.toFixed(1)}. You're now around Band ${current.toFixed(1)} — that's real, earned progress.`,
        accent: "from-averna-neon/30",
        weight: 90,
      });
    }
  }

  // 3. The skill you once struggled with — biggest per-module improvement.
  {
    let best: { label: string; first: number; recentAvg: number; gain: number } | null = null;
    for (const key of Object.keys(MODULE_LABEL)) {
      const rows = scored.filter((t) => t.module === key);
      if (rows.length < 3) continue;
      const first = rows[0].score;
      const recent = rows.slice(-3);
      const recentAvg = recent.reduce((a, b) => a + b.score, 0) / recent.length;
      const gain = recentAvg - first;
      if (gain >= 1 && (!best || gain > best.gain)) {
        best = { label: MODULE_LABEL[key], first, recentAvg: Math.round(recentAvg * 10) / 10, gain };
      }
    }
    if (best) {
      memories.push({
        id: "skill-turnaround",
        emoji: "💪",
        title: `${best.label} used to be hard`,
        body: `Your first ${best.label} test was Band ${best.first.toFixed(1)}. Lately you're averaging Band ${best.recentAvg.toFixed(1)} — you turned a weakness into a strength.`,
        accent: "from-averna-cyan/30",
        weight: 85,
      });
    }
  }

  // 4. "On this day" — a test taken on this calendar day in a past month/year.
  const onThisDay = scored.find((t) => sameCalendarDay(now, t.completedAt) && Math.floor((now.getTime() - t.completedAt.getTime()) / DAY) >= 25);
  if (onThisDay) {
    memories.push({
      id: "on-this-day",
      emoji: "🗓️",
      title: "On this day",
      body: `${humanAgo(onThisDay.completedAt, now)} you took a ${MODULE_LABEL[onThisDay.module] ?? "practice"} test. Showing up on the same date is how bands are built.`,
      accent: "from-averna-purple/30",
      weight: 70,
    });
  }

  // 5. Your first badge.
  if (firstAchievement?.achievement?.name) {
    memories.push({
      id: "first-achievement",
      emoji: "🏅",
      title: "Your first badge",
      body: `${humanAgo(firstAchievement.unlockedAt, now)} you unlocked "${firstAchievement.achievement.name}" — the first of many.`,
      accent: "from-amber-500/30",
      weight: 45,
    });
  }

  // 6. Where it began — the very first test (gentle low-weight fallback).
  if (scored.length >= 1) {
    memories.push({
      id: "first-test",
      emoji: "🌱",
      title: "Where it began",
      body: `${humanAgo(scored[0].completedAt, now)} you took your first ${MODULE_LABEL[scored[0].module] ?? "practice"} test. Every expert started exactly here.`,
      accent: "from-emerald-500/30",
      weight: 30,
    });
  }

  return memories.sort((a, b) => b.weight - a.weight);
}
