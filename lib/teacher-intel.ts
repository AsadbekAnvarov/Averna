import { db } from "@/lib/db";
import { predictBand } from "@/lib/utils";

/**
 * Teacher "AI Studio" intelligence (read-only).
 *
 * Everything here is derived from data that already exists (attendance,
 * activity, tests, homework submissions, speaking ratings) — no writes, no
 * schema change. Powers the AI Student Radar (F1+F5), AI Teaching Assistant
 * (F6), Personal Teaching DNA (F7) and Achievement Studio (F8). Teacher UI is
 * English. Every categorisation carries a plain-language reason.
 */

const DAY = 86_400_000;
const MODULE_LABEL: Record<string, string> = { READING: "Reading", LISTENING: "Listening", WRITING: "Writing", SPEAKING: "Speaking" };

export type RadarCategory = "attention" | "at_risk" | "losing_motivation" | "improving" | "ready_higher" | "stable";
export type HealthLabel = "Critical" | "Needs Attention" | "Stable" | "Excellent";

export interface RadarStudent {
  id: string;
  name: string;
  group: string;
  band: number | null;
  healthScore: number;
  healthLabel: HealthLabel;
  category: RadarCategory;
  reasons: string[];
  action: string;
  href: string;
}

interface StudentSignals {
  id: string;
  name: string;
  group: string;
  blacklisted: boolean;
  attendanceRate: number | null;
  daysSinceActive: number | null;
  homeworkCompletion: number | null;
  band: number | null;
  trend: "up" | "down" | "flat" | null;
}

async function loadSignals(teacherId: string): Promise<StudentSignals[]> {
  const groups = await db.group.findMany({
    where: { teacherId },
    select: {
      name: true,
      homework: { select: { id: true } },
      students: {
        select: {
          id: true,
          blacklisted: true,
          user: { select: { name: true } },
          attendances: { orderBy: { date: "desc" }, take: 10, select: { status: true } },
          activityLogs: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
        },
      },
    },
  });

  const roster = groups.flatMap((g) =>
    g.students.map((s) => ({ s, groupName: g.name, assigned: g.homework.length })),
  );
  const ids = roster.map((r) => r.s.id);
  if (ids.length === 0) return [];

  const [tests, subs] = await Promise.all([
    db.iELTSTest.findMany({ where: { studentId: { in: ids } }, orderBy: { completedAt: "asc" }, select: { studentId: true, score: true } }),
    db.homeworkSubmission.findMany({ where: { studentId: { in: ids } }, select: { studentId: true } }),
  ]);

  const testsBy = new Map<string, number[]>();
  for (const t of tests) {
    const arr = testsBy.get(t.studentId) ?? [];
    arr.push(t.score);
    testsBy.set(t.studentId, arr);
  }
  const subsBy = new Map<string, number>();
  for (const s of subs) subsBy.set(s.studentId, (subsBy.get(s.studentId) ?? 0) + 1);

  const now = Date.now();
  return roster.map(({ s, groupName, assigned }) => {
    let attendanceRate: number | null = null;
    if (s.attendances.length >= 3) {
      const present = s.attendances.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
      attendanceRate = Math.round((present / s.attendances.length) * 100);
    }
    const last = s.activityLogs[0]?.createdAt;
    const daysSinceActive = last ? Math.floor((now - new Date(last).getTime()) / DAY) : null;

    const scores = (testsBy.get(s.id) ?? []).filter((x) => x > 0);
    const p = predictBand(scores);

    const submitted = subsBy.get(s.id) ?? 0;
    const homeworkCompletion = assigned > 0 ? Math.min(100, Math.round((submitted / assigned) * 100)) : null;

    return {
      id: s.id,
      name: s.user?.name ?? "Student",
      group: groupName,
      blacklisted: s.blacklisted,
      attendanceRate,
      daysSinceActive,
      homeworkCompletion,
      band: p ? p.current : null,
      trend: p ? p.trend : null,
    };
  });
}

function healthOf(sig: StudentSignals): { score: number; label: HealthLabel } {
  const attendance = sig.attendanceRate ?? 75;
  const homework = sig.homeworkCompletion ?? 60;
  const recency =
    sig.daysSinceActive == null ? 40 : sig.daysSinceActive <= 1 ? 100 : sig.daysSinceActive <= 3 ? 80 : sig.daysSinceActive <= 7 ? 50 : sig.daysSinceActive <= 14 ? 25 : 5;
  const band = sig.band != null ? Math.min(100, (sig.band / 9) * 100) : 50;

  let score = Math.round(attendance * 0.3 + homework * 0.3 + recency * 0.2 + band * 0.2);
  if (sig.blacklisted) score = Math.min(score, 35);
  score = Math.max(0, Math.min(100, score));

  const label: HealthLabel = score >= 80 ? "Excellent" : score >= 60 ? "Stable" : score >= 40 ? "Needs Attention" : "Critical";
  return { score, label };
}

function categorise(sig: StudentSignals, score: number): { category: RadarCategory; action: string } {
  const inactive = sig.daysSinceActive != null && sig.daysSinceActive >= 7;
  const lowAttendance = sig.attendanceRate != null && sig.attendanceRate < 60;

  if (sig.blacklisted || score < 40 || (lowAttendance && inactive)) {
    return { category: "attention", action: "Have a 1-on-1 chat and set a small catch-up goal." };
  }
  if (sig.band != null && sig.band >= 7 && score >= 75) {
    return { category: "ready_higher", action: "Offer harder passages / Band 8 targets to keep them challenged." };
  }
  if (sig.trend === "up" && (sig.daysSinceActive == null || sig.daysSinceActive <= 3)) {
    return { category: "improving", action: "Acknowledge the progress — a little praise compounds." };
  }
  if (inactive || sig.trend === "down" || (sig.homeworkCompletion != null && sig.homeworkCompletion < 40)) {
    return { category: "losing_motivation", action: "Send a quick nudge and a bite-sized task to rebuild momentum." };
  }
  if (score < 60) {
    return { category: "at_risk", action: "Watch this week; check attendance and homework." };
  }
  return { category: "stable", action: "On track — keep the routine going." };
}

function reasonsOf(sig: StudentSignals): string[] {
  const r: string[] = [];
  if (sig.attendanceRate != null) r.push(`${sig.attendanceRate}% attendance`);
  if (sig.daysSinceActive != null) r.push(sig.daysSinceActive === 0 ? "active today" : `inactive ${sig.daysSinceActive}d`);
  else r.push("no activity yet");
  if (sig.band != null) r.push(`~Band ${sig.band.toFixed(1)}${sig.trend === "up" ? " ↑" : sig.trend === "down" ? " ↓" : ""}`);
  if (sig.homeworkCompletion != null) r.push(`${sig.homeworkCompletion}% homework`);
  if (sig.blacklisted) r.push("blacklisted");
  return r;
}

export async function getStudentRadar(teacherId: string): Promise<RadarStudent[]> {
  const signals = await loadSignals(teacherId);
  return signals
    .map((sig) => {
      const { score, label } = healthOf(sig);
      const { category, action } = categorise(sig, score);
      return {
        id: sig.id,
        name: sig.name,
        group: sig.group,
        band: sig.band,
        healthScore: score,
        healthLabel: label,
        category,
        reasons: reasonsOf(sig),
        action,
        href: `/teacher/parent-report/${sig.id}`,
      };
    })
    .sort((a, b) => a.healthScore - b.healthScore);
}

// ---------------- F6 — AI Teaching Assistant ----------------
export interface TeachingTip {
  id: string;
  text: string;
  detail: string;
  href: string;
}

export async function getTeachingAssistant(teacherId: string): Promise<TeachingTip[]> {
  const [signals, pending, moduleRows] = await Promise.all([
    loadSignals(teacherId),
    db.homeworkSubmission.count({ where: { status: "SUBMITTED", homework: { teacherId } } }),
    db.iELTSTest.findMany({
      where: { student: { group: { teacherId } } },
      select: { module: true, score: true },
    }),
  ]);

  const tips: TeachingTip[] = [];

  // Weakest module across the teacher's students
  const agg = new Map<string, { total: number; n: number }>();
  for (const r of moduleRows) {
    const a = agg.get(r.module) ?? { total: 0, n: 0 };
    a.total += r.score;
    a.n += 1;
    agg.set(r.module, a);
  }
  let weakest: { label: string; avg: number } | null = null;
  let classAvg: number | null = null;
  if (agg.size > 0) {
    let tot = 0;
    let cnt = 0;
    for (const [mod, a] of agg) {
      const avg = a.total / a.n;
      tot += a.total;
      cnt += a.n;
      if (!weakest || avg < weakest.avg) weakest = { label: MODULE_LABEL[mod] ?? mod, avg: Math.round(avg * 10) / 10 };
    }
    classAvg = cnt ? tot / cnt : null;
  }

  if (weakest) {
    tips.push({
      id: "weak-module",
      text: `Your students are weakest in ${weakest.label} (avg Band ${weakest.avg}).`,
      detail: `Consider a focused ${weakest.label} review before introducing the next topic.`,
      href: "/teacher/lessons",
    });
  }
  if (classAvg != null && classAvg >= 6.5) {
    tips.push({
      id: "ready-harder",
      text: "This class is ready for harder material.",
      detail: `Average predicted band is ~${(Math.round(classAvg * 10) / 10).toFixed(1)} — step up passage difficulty and timing.`,
      href: "/teacher/lessons",
    });
  }

  const inactive = signals.filter((s) => s.daysSinceActive != null && s.daysSinceActive >= 7);
  if (inactive.length > 0) {
    tips.push({
      id: "inactive",
      text: `${inactive.length} student${inactive.length === 1 ? "" : "s"} haven't practised in a week.`,
      detail: `Send a quick nudge: ${inactive.slice(0, 3).map((s) => s.name.split(" ")[0]).join(", ")}${inactive.length > 3 ? "…" : ""}.`,
      href: "/teacher/announcements",
    });
  }

  const weakSpeaking = signals.filter((s) => s.band != null && s.band < 6);
  if (weakSpeaking.length >= 3) {
    tips.push({
      id: "speaking",
      text: `${weakSpeaking.length} students would benefit from extra Speaking practice.`,
      detail: "Book a group speaking session or open extra 1-on-1 slots.",
      href: "/teacher/tutoring",
    });
  }

  if (pending > 0) {
    tips.push({
      id: "grading",
      text: `${pending} submission${pending === 1 ? "" : "s"} waiting to be graded.`,
      detail: "Clearing the queue keeps feedback timely and motivation high.",
      href: "/teacher/homework",
    });
  }

  return tips;
}

// ---------------- F7 — Personal Teaching DNA ----------------
export interface TeachingDNA {
  studentsTaught: number;
  essaysReviewed: number;
  avgReviewHrs: number | null;
  avgFeedbackLen: number;
  avgRating: number | null;
  improvementRate: number | null; // avg band delta across students
  strengths: string[];
  focus: string[];
}

export async function getTeachingDNA(teacherId: string): Promise<TeachingDNA> {
  const since = new Date(Date.now() - 90 * DAY);
  const [graded, ratings, groups] = await Promise.all([
    db.homeworkSubmission.findMany({
      where: { gradedBy: teacherId, gradedAt: { gte: since, not: null } },
      select: { submittedAt: true, gradedAt: true, feedback: true },
    }),
    db.speakingSession.findMany({ where: { teacherId, rating: { not: null } }, select: { rating: true } }),
    db.group.findMany({ where: { teacherId }, select: { students: { select: { id: true } } } }),
  ]);

  const studentIds = groups.flatMap((g) => g.students.map((s) => s.id));
  const tests = studentIds.length
    ? await db.iELTSTest.findMany({ where: { studentId: { in: studentIds } }, orderBy: { completedAt: "asc" }, select: { studentId: true, score: true } })
    : [];

  const essaysReviewed = graded.length;
  const hrs = graded.filter((g) => g.gradedAt).map((g) => (new Date(g.gradedAt!).getTime() - new Date(g.submittedAt).getTime()) / 3_600_000);
  const avgReviewHrs = hrs.length ? Math.round((hrs.reduce((a, b) => a + b, 0) / hrs.length) * 10) / 10 : null;
  const fbLens = graded.map((g) => g.feedback?.length ?? 0);
  const avgFeedbackLen = fbLens.length ? Math.round(fbLens.reduce((a, b) => a + b, 0) / fbLens.length) : 0;
  const ratingVals = ratings.map((r) => r.rating!).filter((x) => x != null);
  const avgRating = ratingVals.length ? Math.round((ratingVals.reduce((a, b) => a + b, 0) / ratingVals.length) * 10) / 10 : null;

  // Improvement rate: avg (latest - earliest) band across students with >=2 tests
  const byStudent = new Map<string, number[]>();
  for (const t of tests) {
    const arr = byStudent.get(t.studentId) ?? [];
    arr.push(t.score);
    byStudent.set(t.studentId, arr);
  }
  const deltas: number[] = [];
  for (const arr of byStudent.values()) if (arr.length >= 2) deltas.push(arr[arr.length - 1] - arr[0]);
  const improvementRate = deltas.length ? Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 100) / 100 : null;

  const strengths: string[] = [];
  const focus: string[] = [];
  if (avgReviewHrs != null && avgReviewHrs <= 24) strengths.push("Fast, timely feedback");
  else if (avgReviewHrs != null) focus.push("Speed up essay turnaround");
  if (avgFeedbackLen >= 120) strengths.push("Detailed written feedback");
  else if (essaysReviewed >= 3) focus.push("Add a little more detail to feedback");
  if (avgRating != null && avgRating >= 4) strengths.push("High student satisfaction");
  else if (avgRating != null) focus.push("Boost speaking-session experience");
  if (improvementRate != null && improvementRate > 0) strengths.push(`Students improve on average +${improvementRate.toFixed(2)} band`);

  return {
    studentsTaught: studentIds.length,
    essaysReviewed,
    avgReviewHrs,
    avgFeedbackLen,
    avgRating,
    improvementRate,
    strengths,
    focus,
  };
}

// ---------------- F8 — Achievement Studio ----------------
export interface TeacherAchievement {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  progress: number; // 0-100
  unlocked: boolean;
  detail: string;
}

export async function getTeacherAchievements(teacherId: string): Promise<TeacherAchievement[]> {
  const [reviewed, speaking, groups] = await Promise.all([
    db.homeworkSubmission.count({ where: { gradedBy: teacherId, gradedAt: { not: null } } }),
    db.speakingSession.count({ where: { teacherId } }),
    db.group.findMany({ where: { teacherId }, select: { students: { select: { id: true } } } }),
  ]);

  const studentIds = groups.flatMap((g) => g.students.map((s) => s.id));
  const tests = studentIds.length
    ? await db.iELTSTest.findMany({ where: { studentId: { in: studentIds } }, orderBy: { completedAt: "asc" }, select: { studentId: true, score: true } })
    : [];
  const byStudent = new Map<string, number[]>();
  for (const t of tests) {
    const arr = byStudent.get(t.studentId) ?? [];
    arr.push(t.score);
    byStudent.set(t.studentId, arr);
  }
  let improved = 0;
  for (const arr of byStudent.values()) if (arr.length >= 2 && arr[arr.length - 1] - arr[0] >= 0.5) improved += 1;

  const mk = (id: string, name: string, emoji: string, desc: string, value: number, target: number): TeacherAchievement => ({
    id,
    name,
    emoji,
    desc,
    progress: Math.min(100, Math.round((value / target) * 100)),
    unlocked: value >= target,
    detail: `${Math.min(value, target)}/${target}`,
  });

  return [
    mk("reviews-100", "Essay Reviewer", "📝", "Review 100 submissions", reviewed, 100),
    mk("reviews-500", "Marking Machine", "⚡", "Review 500 submissions", reviewed, 500),
    mk("speaking-mentor", "Speaking Mentor", "🎤", "Run 50 speaking sessions", speaking, 50),
    mk("band-champion", "Band Improvement Champion", "📈", "Help 10 students gain +0.5 band", improved, 10),
    mk("class-builder", "Class Builder", "👥", "Teach 25 students", studentIds.length, 25),
  ];
}



// ---------------- Shared helpers for F4 / F9 / F10 ----------------
export interface GroupBrief {
  id: string;
  name: string;
  level: string | null;
  size: number;
  avgBand: number | null;
  weakModule: string | null;
}

export async function getGroupsBrief(teacherId: string): Promise<GroupBrief[]> {
  const groups = await db.group.findMany({
    where: { teacherId },
    select: { id: true, name: true, level: true, students: { select: { id: true } } },
  });
  const studentToGroup = new Map<string, string>();
  for (const g of groups) for (const s of g.students) studentToGroup.set(s.id, g.id);
  const allIds = Array.from(studentToGroup.keys());

  const tests = allIds.length
    ? await db.iELTSTest.findMany({ where: { studentId: { in: allIds } }, select: { studentId: true, module: true, score: true } })
    : [];

  // per group: overall avg + per-module avg
  const byGroup = new Map<string, { total: number; n: number; mod: Map<string, { t: number; n: number }> }>();
  for (const g of groups) byGroup.set(g.id, { total: 0, n: 0, mod: new Map() });
  for (const t of tests) {
    const gid = studentToGroup.get(t.studentId);
    if (!gid) continue;
    const agg = byGroup.get(gid)!;
    agg.total += t.score;
    agg.n += 1;
    const m = agg.mod.get(t.module) ?? { t: 0, n: 0 };
    m.t += t.score;
    m.n += 1;
    agg.mod.set(t.module, m);
  }

  return groups.map((g) => {
    const agg = byGroup.get(g.id)!;
    let weak: { label: string; avg: number } | null = null;
    for (const [mod, m] of agg.mod) {
      const avg = m.t / m.n;
      if (!weak || avg < weak.avg) weak = { label: MODULE_LABEL[mod] ?? mod, avg };
    }
    return {
      id: g.id,
      name: g.name,
      level: g.level,
      size: g.students.length,
      avgBand: agg.n ? Math.round((agg.total / agg.n) * 10) / 10 : null,
      weakModule: weak ? weak.label : null,
    };
  });
}

export interface RecentLesson {
  id: string;
  topic: string;
  notes: string | null;
  date: string;
  group: string;
}

export async function getRecentLessons(teacherId: string, take = 8): Promise<RecentLesson[]> {
  const lessons = await db.lessonLog.findMany({
    where: { teacherId },
    orderBy: { date: "desc" },
    take,
    select: { id: true, topic: true, notes: true, date: true, group: { select: { name: true } } },
  });
  return lessons.map((l) => ({
    id: l.id,
    topic: l.topic,
    notes: l.notes,
    date: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(l.date),
    group: l.group?.name ?? "Group",
  }));
}

export interface FeedbackProfile {
  count: number;
  avgLen: number;
  samples: string[];
}

export async function getTeacherFeedbackProfile(teacherId: string): Promise<FeedbackProfile> {
  const graded = await db.homeworkSubmission.findMany({
    where: { gradedBy: teacherId, feedback: { not: null } },
    orderBy: { gradedAt: "desc" },
    take: 12,
    select: { feedback: true },
  });
  const samples = graded.map((g) => (g.feedback ?? "").trim()).filter((f) => f.length > 0);
  const avgLen = samples.length ? Math.round(samples.reduce((s, f) => s + f.length, 0) / samples.length) : 0;
  return { count: samples.length, avgLen, samples: samples.slice(0, 6) };
}
