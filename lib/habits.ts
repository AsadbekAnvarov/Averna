import { db } from "@/lib/db";
import { getStudentTests } from "@/lib/student-intel";
import { tashkentHour, tashkentDateKey } from "@/lib/utils";

/**
 * F4 — Personal Habit Intelligence (read-only).
 *
 * Learns *when* a student usually studies (their peak hour, in Fergana time)
 * from real ActivityLog timestamps, and — around that time, if they haven't
 * studied yet today — offers a gentle, personal nudge toward the skill they
 * usually practise. If they've already shown up, it quietly affirms the habit.
 * No schema change; reuses the shared cached getStudentTests(). English UI.
 */

const DAY = 86_400_000;

const MODULE: Record<string, { label: string; href: string }> = {
  READING: { label: "Reading", href: "/learning/reading" },
  LISTENING: { label: "Listening", href: "/learning/listening" },
  WRITING: { label: "Writing", href: "/learning/writing" },
  SPEAKING: { label: "Speaking", href: "/learning/speaking" },
};

export interface HabitInsight {
  kind: "nudge" | "affirmation";
  icon: "clock" | "flame";
  title: string;
  body: string;
  cta?: { label: string; href: string };
  /** Accent colour key for the strip. */
  tone: "cyan" | "amber" | "neon";
}

function hourLabel(h: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${ampm}`;
}

export async function getHabitInsight(studentId: string, streak = 0): Promise<HabitInsight | null> {
  const since = new Date(Date.now() - 60 * DAY);
  const [activity, tests] = await Promise.all([
    db.activityLog.findMany({
      where: { studentId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    getStudentTests(studentId),
  ]);

  // Need a real, repeated signal before claiming to know a habit.
  if (activity.length < 10) return null;

  // Peak study hour (Fergana), plus how many days the student actually studied.
  const hourCounts = new Array<number>(24).fill(0);
  const studyDays = new Set<string>();
  for (const a of activity) {
    hourCounts[tashkentHour(a.createdAt)] += 1;
    studyDays.add(tashkentDateKey(a.createdAt));
  }
  if (studyDays.size < 4) return null;

  let usualHour = 0;
  let peak = 0;
  for (let h = 0; h < 24; h++) {
    if (hourCounts[h] > peak) {
      peak = hourCounts[h];
      usualHour = h;
    }
  }
  if (peak < 3) return null; // not concentrated enough to be a "usual" time

  // Favourite skill (most-practised module) for a tailored call to action.
  const modCount = new Map<string, number>();
  for (const t of tests) modCount.set(t.module, (modCount.get(t.module) ?? 0) + 1);
  let fav: { label: string; href: string } | null = null;
  let favN = 0;
  for (const [mod, n] of modCount) {
    if (n > favN && MODULE[mod]) {
      favN = n;
      fav = MODULE[mod];
    }
  }

  const now = new Date();
  const studiedToday = studyDays.has(tashkentDateKey(now));
  const nowHour = tashkentHour(now);
  const usualLabel = hourLabel(usualHour);

  // Already studied today → warm affirmation of the habit.
  if (studiedToday) {
    return {
      kind: "affirmation",
      icon: "flame",
      title: "Right on schedule",
      body: `You usually study around ${usualLabel} — and you've already shown up today. That consistency is exactly how bands are built.`,
      tone: "neon",
    };
  }

  // Not yet today, and it's before their usual window → don't nag early.
  if (nowHour < usualHour - 1) return null;

  // Around or past the usual time → a gentle, personal nudge.
  const streakBit = streak > 0 ? ` Keep your ${streak}-day streak alive —` : "";
  return {
    kind: "nudge",
    icon: "clock",
    title: "Your usual study time",
    body: `You usually practise ${fav ? `${fav.label} ` : ""}around ${usualLabel}.${streakBit} a quick 10-minute session fits right in.`,
    cta: fav ? { label: `Start ${fav.label}`, href: fav.href } : { label: "Start a session", href: "/learning" },
    tone: streak > 0 ? "amber" : "cyan",
  };
}
