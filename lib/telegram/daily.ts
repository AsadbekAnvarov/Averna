/**
 * Daily Telegram digests — called once per Tashkent day at 19:00 by
 * /api/cron/daily inside runOncePerDay (deduplicated across both projects).
 *
 *   students (en)    homework due tomorrow not yet submitted; streak at risk   → prefs.reminders
 *   teachers (uz)    homework due yesterday / today: submitted X/Y + who's missing,
 *                    Writing/Speaking waiting for review (14 days), inactive 7+ days → prefs.reports
 *   admins (uz)      today's new students, finished placement tests, PENDING
 *                    payments, reviews waiting, homework created              → prefs.reports
 *   parents (uz/ru)  Sundays only: the weekly report of each child             → prefs.reports
 *
 * One message per chat where possible (mergeByChat), throttled (~25/s),
 * capped at MAX_SENDS and bounded by a time budget that fits the route's 60 s.
 * Returns counts for the CronRun row; without the bot configured → { skipped }.
 */

import type { JobResult } from "@/lib/cron/once";
import { db } from "@/lib/db";
import { tashkentWeekday } from "@/lib/utils";
import { digestIsEmpty, type StudentReminder, type TeacherDigest, type WeeklyReport } from "./builders";
import { appBaseUrl, appLink, telegramReady } from "./config";
import { purgeOldCodes } from "./links";
import { adminSummaryText, asLang, openAppKeyboard, studentEveningText, teacherDigestText, weeklyReportText } from "./messages";
import { markChatsInactive } from "./notify";
import { mergeByChat, sendBatch, type Outgoing } from "./outbox";
import { readPrefs } from "./prefs";
import { loadAdminSummary, loadStudentReminders, loadTeacherDigests, loadWeeklyReports } from "./reports";
import type { PrefKey } from "./types";

/** Messages per run at most (the rest is reported as `capped`). */
export const MAX_SENDS = 900;
/** Queries + sends; the cron route may run 60 s. */
const BUDGET_MS = 45_000;

type LinkRow = { chatId: string; role: string; userId: string | null; studentId: string | null; language: string; prefs: unknown };

const idsOf = (rows: LinkRow[], key: "userId" | "studentId"): string[] =>
  Array.from(new Set(rows.map((r) => r[key]).filter((x): x is string => !!x)));

export async function runTelegramDaily(now: Date = new Date()): Promise<JobResult> {
  if (!telegramReady()) return { skipped: "telegram not configured" };
  const started = Date.now();
  const sunday = tashkentWeekday(now) === 0;

  const links: LinkRow[] = await db.telegramLink.findMany({
    where: { active: true },
    select: { chatId: true, role: true, userId: true, studentId: true, language: true, prefs: true },
  });
  const wants = (key: PrefKey) => (l: LinkRow) => readPrefs(l.prefs)[key];
  const admins = links.filter((l) => l.role === "admin" && l.userId).filter(wants("reports"));
  const teachers = links.filter((l) => l.role === "teacher" && l.userId).filter(wants("reports"));
  const parents = sunday ? links.filter((l) => l.role === "parent" && l.studentId).filter(wants("reports")) : [];
  const students = links.filter((l) => l.role === "student" && l.userId).filter(wants("reminders"));

  const errors: string[] = [];
  const safe = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      errors.push(label);
      console.error(`Telegram daily: ${label} failed:`, e);
      return fallback;
    }
  };

  const [summary, digests, weekly, reminders] = await Promise.all([
    admins.length ? safe("admins", () => loadAdminSummary(now, admins[0].userId as string), null) : Promise.resolve(null),
    teachers.length ? safe("teachers", () => loadTeacherDigests(idsOf(teachers, "userId"), now), [] as TeacherDigest[]) : Promise.resolve([] as TeacherDigest[]),
    parents.length
      ? safe("parents", () => loadWeeklyReports(idsOf(parents, "studentId"), now), new Map<string, WeeklyReport>())
      : Promise.resolve(new Map<string, WeeklyReport>()),
    students.length ? safe("students", () => loadStudentReminders(idsOf(students, "userId"), now), [] as StudentReminder[]) : Promise.resolve([] as StudentReminder[]),
  ]);

  // Priority order: admins, teachers, parents, students (merging keeps each chat's first position).
  const base = appBaseUrl();
  const out: Outgoing[] = [];
  const counts = { admins: 0, teachers: 0, parents: 0, students: 0 };
  if (summary) {
    for (const l of admins) {
      const lang = asLang(l.language);
      out.push({ chatId: l.chatId, text: adminSummaryText(lang, summary, "daily"), keyboard: openAppKeyboard(lang, appLink("/admin/dashboard", base)) });
      counts.admins++;
    }
  }
  const digestBy = new Map(digests.map((d) => [d.userId, d]));
  for (const l of teachers) {
    const d = digestBy.get(l.userId as string);
    if (!d || digestIsEmpty(d)) continue;
    const lang = asLang(l.language);
    out.push({ chatId: l.chatId, text: teacherDigestText(lang, d, now), keyboard: openAppKeyboard(lang, appLink("/teacher/dashboard", base)) });
    counts.teachers++;
  }
  for (const l of parents) {
    const r = weekly.get(l.studentId as string);
    if (!r) continue;
    out.push({ chatId: l.chatId, text: weeklyReportText(asLang(l.language), r, "weekly") });
    counts.parents++;
  }
  const reminderBy = new Map(reminders.map((r) => [r.userId, r]));
  for (const l of students) {
    const r = reminderBy.get(l.userId as string);
    if (!r) continue;
    const lang = asLang(l.language);
    out.push({ chatId: l.chatId, text: studentEveningText(lang, r), keyboard: openAppKeyboard(lang, appLink("/homework", base)) });
    counts.students++;
  }

  const merged = mergeByChat(out);
  const batch = merged.slice(0, MAX_SENDS);
  const result = await sendBatch(batch, {
    timeoutMs: 5000,
    maxRetryWaitMs: 10_000,
    budgetMs: Math.max(1000, BUDGET_MS - (Date.now() - started)),
    onGone: markChatsInactive,
  });
  const codesPurged = await purgeOldCodes(now);

  return {
    sunday,
    links: links.length,
    ...counts,
    messages: merged.length,
    sent: result.sent,
    failed: result.failed,
    blocked: result.gone,
    capped: merged.length - batch.length + result.skipped,
    codesPurged,
    errors: errors.length ? errors.join(",") : null,
    ms: Date.now() - started,
  };
}
