import { db } from "@/lib/db";

/**
 * F3 — Community Challenges (read-only).
 *
 * A monthly platform-wide goal built from REAL aggregate activity: every study
 * action by every student this month counts toward one shared target. Shows
 * community progress, the student's personal contribution and the top
 * contributors. No writes, no schema change. Student UI (English).
 */

const THEMES = [
  { name: "Vocabulary Marathon", emoji: "📚", verb: "learning sessions" },
  { name: "Grammar Challenge", emoji: "🧩", verb: "practice sessions" },
  { name: "Reading Month", emoji: "📖", verb: "study sessions" },
  { name: "Writing Festival", emoji: "✍️", verb: "study sessions" },
  { name: "Listening Sprint", emoji: "🎧", verb: "practice sessions" },
  { name: "Speaking Week", emoji: "🎤", verb: "practice sessions" },
];

export interface Contributor {
  id: string;
  name: string;
  count: number;
  isYou: boolean;
}

export interface CommunityChallenge {
  theme: string;
  emoji: string;
  verb: string;
  monthLabel: string;
  total: number;
  goal: number;
  pct: number;
  reached: boolean;
  personal: number;
  personalPct: number;
  activeStudents: number;
  contributors: Contributor[];
}

export async function getCommunityChallenge(studentId: string): Promise<CommunityChallenge> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const logs = await db.activityLog.findMany({
    where: { createdAt: { gte: startOfMonth } },
    select: { studentId: true },
  });

  const total = logs.length;
  const byStudent = new Map<string, number>();
  for (const l of logs) byStudent.set(l.studentId, (byStudent.get(l.studentId) ?? 0) + 1);

  const activeStudents = byStudent.size;
  const personal = byStudent.get(studentId) ?? 0;

  // Fair, motivating goal that scales with participation.
  const goal = Math.max(500, activeStudents * 30);
  const pct = Math.min(100, Math.round((total / goal) * 100));
  const reached = total >= goal;
  const personalPct = total > 0 ? Math.round((personal / total) * 100) : 0;

  // Top contributors (+ ensure the current student is represented)
  const topIds = Array.from(byStudent.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id]) => id);
  if (!topIds.includes(studentId) && personal > 0) topIds.push(studentId);

  const students = topIds.length
    ? await db.student.findMany({ where: { id: { in: topIds } }, select: { id: true, user: { select: { name: true } } } })
    : [];
  const nameById = new Map(students.map((s) => [s.id, s.user?.name ?? "Student"]));

  const contributors: Contributor[] = topIds
    .map((id) => ({ id, name: nameById.get(id) ?? "Student", count: byStudent.get(id) ?? 0, isYou: id === studentId }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const theme = THEMES[now.getMonth() % THEMES.length];
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(startOfMonth);

  return {
    theme: theme.name,
    emoji: theme.emoji,
    verb: theme.verb,
    monthLabel,
    total,
    goal,
    pct,
    reached,
    personal,
    personalPct,
    activeStudents,
    contributors,
  };
}
