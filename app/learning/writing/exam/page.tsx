export const dynamic = "force-dynamic";

import { randomInt, randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { findAward } from "@/lib/engine/xp-engine";
import { hashString } from "@/lib/engine/progression/missions";
import { writingBand } from "@/lib/ielts/bands";
import { getWritingTask, listWritingTasks } from "@/lib/ielts/catalog";
import { examPrompt } from "@/lib/ielts/submit";
import type { WritingPrompt } from "@/lib/writing-data";
import {
  WritingExamClient,
  type WritingExamResult,
  type WritingExamTaskResult,
} from "@/components/exam/writing-exam-client";

/**
 * Full IELTS Writing test — Task 1 + Task 2 in 60 minutes (practice mode).
 *
 * The URL pins the paper: ?t1=<Task 1 id>&t2=<Task 2 id>&attempt=<id>. A visit
 * without valid tasks gets random ones (preferring prompts this student hasn't
 * written yet) and a fresh attempt id; a visit without an attempt id gets a
 * fresh one. A refresh keeps both, so the runner's autosave, its clock and the
 * idempotent submission carry on — and an attempt that was already marked
 * shows its result again instead of an empty paper.
 */

export const metadata = { title: "Full Writing test" };

const HERE = "/learning/writing/exam";
const ATTEMPT_RE = /^[A-Za-z0-9_-]{8,64}$/;

type TaskKey = "task1" | "task2";
type SearchParams = Record<string, string | string[] | undefined>;

const firstParam = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
const newAttemptId = () => randomUUID().replace(/-/g, "");
const asRec = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

/** This page with the given paper + attempt; any other query params are kept. */
function examUrl(searchParams: SearchParams, t1: string, t2: string, attempt: string): string {
  const qs = new URLSearchParams({ t1, t2, attempt });
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "t1" || key === "t2" || key === "attempt" || value == null) continue;
    for (const item of Array.isArray(value) ? value : [value]) qs.append(key, item);
  }
  return `${HERE}?${qs.toString()}`;
}

async function studentIdOf(userId: string): Promise<string | null> {
  try {
    const student = await db.student.findUnique({ where: { userId }, select: { id: true } });
    return student?.id ?? null;
  } catch {
    return null;
  }
}

/** Prompt ids and content keys of every Writing task this student has written. */
async function writtenKeys(studentId: string | null): Promise<Set<string>> {
  const seen = new Set<string>();
  if (!studentId) return seen;
  const rows: { answers: unknown }[] = await db.iELTSTest
    .findMany({
      where: { studentId, module: "WRITING" },
      orderBy: { completedAt: "desc" },
      take: 500,
      select: { answers: true },
    })
    .catch(() => []);
  for (const row of rows) {
    const a = asRec(row.answers);
    if (!a) continue;
    if (typeof a.promptId === "string" && a.promptId) seen.add(a.promptId);
    if (typeof a.testId === "string" && a.testId) seen.add(a.testId);
  }
  return seen;
}

/** A random prompt, preferring ones this student hasn't written. */
function pickPrompt(list: WritingPrompt[], task: TaskKey, seen: Set<string>): WritingPrompt | null {
  if (!list.length) return null;
  const fresh = list.filter((p) => !seen.has(p.id) && !seen.has(`${task}:${hashString(String(p.prompt))}`));
  const pool = fresh.length ? fresh : list;
  return pool[randomInt(pool.length)];
}

/**
 * The marked result of this attempt when BOTH tasks are already saved (e.g. a
 * refresh on the result screen). One saved task means the submission broke off
 * half-way: the runner stays open and a retry completes it.
 */
async function submittedResult(studentId: string, attempt: string): Promise<WritingExamResult | null> {
  try {
    const [a1, a2] = await Promise.all([
      findAward(studentId, `test:${attempt}:W1`),
      findAward(studentId, `test:${attempt}:W2`),
    ]);
    if (!a1?.refId || !a2?.refId) return null;
    const rows: { id: string; score: number; aiAnalysis: unknown }[] = await db.iELTSTest.findMany({
      where: { studentId, id: { in: [a1.refId, a2.refId] } },
      select: { id: true, score: true, aiAnalysis: true },
    });
    const taskResult = (award: { refId: string | null; amount: number; breakdown: unknown }): WritingExamTaskResult | null => {
      const row = rows.find((r) => r.id === award.refId);
      if (!row) return null;
      const notes = asRec(award.breakdown)?.notes;
      return {
        testId: row.id,
        band: row.score,
        words: num(asRec(row.aiAnalysis)?.wordCount) ?? 0,
        xpAwarded: Math.max(0, Math.round(Number(award.amount) || 0)),
        xpNotes: Array.isArray(notes) ? notes.filter((n): n is string => typeof n === "string") : [],
      };
    };
    const task1 = taskResult(a1);
    const task2 = taskResult(a2);
    if (!task1 || !task2) return null;
    return { band: writingBand(task1.band, task2.band), task1, task2, xpAwarded: task1.xpAwarded + task2.xpAwarded };
  } catch {
    return null;
  }
}

export default async function WritingExamPage({ searchParams = {} }: { searchParams?: SearchParams }) {
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");

  const id1 = firstParam(searchParams.t1);
  const id2 = firstParam(searchParams.t2);
  const [given1, given2] = await Promise.all([
    id1 ? getWritingTask("task1", id1) : null,
    id2 ? getWritingTask("task2", id2) : null,
  ]);

  if (!given1 || !given2) {
    // New paper: keep a valid task from the URL, pick the other(s) at random.
    // Always a new attempt id — a saved draft of another paper must not reappear.
    const [seen, list1, list2] = await Promise.all([
      studentIdOf(session.user.id).then(writtenKeys),
      given1 ? [given1] : listWritingTasks("task1"),
      given2 ? [given2] : listWritingTasks("task2"),
    ]);
    const t1 = given1 ?? pickPrompt(list1, "task1", seen);
    const t2 = given2 ?? pickPrompt(list2, "task2", seen);
    if (!t1 || !t2) return redirect("/learning/writing");
    return redirect(examUrl(searchParams, t1.id, t2.id, newAttemptId()));
  }

  const requested = firstParam(searchParams.attempt);
  const attempt = requested && ATTEMPT_RE.test(requested) ? requested : null;
  if (!attempt) return redirect(examUrl(searchParams, given1.id, given2.id, newAttemptId()));

  const studentId = await studentIdOf(session.user.id);
  const done = studentId ? await submittedResult(studentId, attempt) : null;

  return (
    <WritingExamClient
      key={attempt}
      task1={examPrompt(given1)}
      task2={examPrompt(given2)}
      attemptId={attempt}
      initialResult={done}
    />
  );
}
