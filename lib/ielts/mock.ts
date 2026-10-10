/**
 * The real IELTS mock exam — server logic.
 *
 * New sitting = Listening → Reading → Writing (Speaking separately); legacy sittings retain four sections, with
 * papers picked at RANDOM from the full-format library (40-question Listening
 * and Reading papers, one Task 1 + one Task 2, one full Speaking set),
 * preferring papers the student has never taken.
 *
 * Exam conditions are enforced on the server:
 *   - the section clock starts when the student presses Start and lives in the
 *     database, so a refresh or a second tab can't reset it;
 *   - answers are autosaved to the attempt while working;
 *   - after the deadline (+ a short network grace) new answers are refused and
 *     the section is graded from the last autosave — like papers being
 *     collected when time is up;
 *   - each section is graded and saved as an IELTSTest the moment it is
 *     submitted (XP, streak, missions, Learning DNA), so the final page only
 *     combines results that already exist.
 *
 * SERVER ONLY.
 */

import { randomInt } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashString } from "@/lib/engine/progression/missions";
import type { WritingPrompt } from "@/lib/writing-data";
import { overallBand, writingBand } from "./bands";
import { hasRecordedSpeech } from "@/lib/speaking/recording";
import { readCriteria } from "@/lib/review/scoring";
import {
  getListeningExam,
  getReadingExam,
  getSpeakingSet,
  getWritingTask,
  listListeningExams,
  listReadingExams,
  listSpeakingSets,
  listWritingTasks,
} from "./catalog";
import { estimateListeningMinutes } from "./format";
import { CD_MOCK_MODE, isCdMock, mockSections, mockGrace, paperSchema, validMockDraft, nextClock } from "./mock-policy";
import { mockListeningLibrary, mockReadingLibrary, recordingMinutes, isFullObjective } from "./mock-library";
import { toClientReading } from "./sanitize";
import { listeningClientContent } from "./audio/client";
import { examPrompt, submitObjectiveExam, submitSpeakingTest, submitWritingExam } from "./submit";
import type { ClientListeningTest, ClientReadingTest, ExamTestSummary, SpeakingExamSet } from "./types";

export const MOCK_SECTIONS = ["LISTENING", "READING", "WRITING", "SPEAKING"] as const;
export type MockSection = (typeof MOCK_SECTIONS)[number];

export type MockPapers = {
  listening: string;
  reading: string;
  task1: string;
  task2: string;
  speaking: string;
  mode?: typeof CD_MOCK_MODE;
};

export type MockSectionResult = {
  band: number;
  /** IELTSTest ids saved for this section (Writing: Task 1, Task 2). */
  testIds: string[];
  correct?: number;
  total?: number;
  answered?: number;
  xp: number;
  /** Graded automatically because the time ran out. */
  auto?: boolean;
  task1Band?: number;
  task2Band?: number;
  /** Speaking: criteria and the top feedback lines (shown on the result page). */
  criteria?: { fluency: number; lexical: number; grammar: number; pronunciation?: number | null };
  /** A teacher reviewed this section (Writing: at least one task) — its band is the teacher's. */
  reviewed?: boolean;
  feedback?: string[];
  assessedBy?: "ai" | "heuristic";
  submittedAt: string;
};
export type MockResults = Partial<Record<MockSection, MockSectionResult>>;

/** Accept a submission this long after the deadline as on time (network, auto-submit). */
/** An active sitting untouched for this long is abandoned when a new one starts. */
const STALE_MS = 24 * 60 * 60 * 1000;
const MAX_DRAFT_CHARS = 80_000;

const json = (x: unknown) => x as Prisma.InputJsonValue;
const asRec = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;

function papersOf(raw: unknown): MockPapers | null {
  const parsed = paperSchema.safeParse(raw);
  return parsed.success ? parsed.data as MockPapers : null;
}

export function resultsOf(raw: unknown): MockResults {
  return (asRec(raw) ?? {}) as MockResults;
}

// ---------------------------------------------------------------------------
// Library availability + random paper selection
// ---------------------------------------------------------------------------

export interface MockAvailability {
  ready: boolean;
  listening: number;
  reading: number;
  task1: number;
  task2: number;
  speaking: number;
}

export async function getMockAvailability(): Promise<MockAvailability> {
  const [listening, reading, t1, t2, speaking] = await Promise.all([
    listListeningExams(),
    listReadingExams(),
    listWritingTasks("task1"),
    listWritingTasks("task2"),
    listSpeakingSets(),
  ]);
  const [readyAudio, readyReading] = await Promise.all([mockListeningLibrary(listening), mockReadingLibrary(reading)]);
  const a = {
    listening: readyAudio.size,
    reading: readyReading.size,
    task1: t1.length,
    task2: t2.length,
    speaking: speaking.length,
  };
  return { ...a, ready: a.listening > 0 && a.reading > 0 && a.task1 > 0 && a.task2 > 0 };
}

/** Every paper id / content key this student has already met. */
async function seenKeys(studentId: string): Promise<Set<string>> {
  const seen = new Set<string>();
  const [tests, mocks] = await Promise.all([
    db.iELTSTest
      .findMany({ where: { studentId }, orderBy: { completedAt: "desc" }, take: 600, select: { answers: true } })
      .catch(() => [] as { answers: unknown }[]),
    db.mockAttempt
      .findMany({ where: { studentId }, orderBy: { startedAt: "desc" }, take: 50, select: { papers: true } })
      .catch(() => [] as { papers: unknown }[]),
  ]);
  for (const t of tests) {
    const a = asRec(t.answers);
    if (!a) continue;
    for (const k of ["examId", "testId", "promptId"]) {
      const v = a[k];
      if (typeof v === "string" && v) seen.add(v.replace(/#p\d+$/, ""));
    }
  }
  for (const m of mocks) {
    const p = papersOf(m.papers);
    if (p) Object.values(p).forEach((id) => seen.add(id));
  }
  return seen;
}

/** Random pick, preferring unseen items. */
function pickOne<T>(items: T[], isSeen: (t: T) => boolean): T | null {
  if (!items.length) return null;
  const fresh = items.filter((t) => !isSeen(t));
  const pool = fresh.length ? fresh : items;
  return pool[randomInt(pool.length)];
}

async function pickPapers(studentId: string): Promise<MockPapers | null> {
  const [seen, listening, reading, t1, t2] = await Promise.all([
    seenKeys(studentId),
    listListeningExams(),
    listReadingExams(),
    listWritingTasks("task1"),
    listWritingTasks("task2"),
  ]);
  const writingSeen = (task: "task1" | "task2") => (p: WritingPrompt) =>
    seen.has(p.id) || seen.has(`${task}:${hashString(String(p.prompt))}`);
  const [readyAudio, readyReading] = await Promise.all([mockListeningLibrary(listening), mockReadingLibrary(reading)]);
  const l = pickOne<ExamTestSummary>(listening.filter(t => readyAudio.has(t.id)), (t) => seen.has(t.id));
  const r = pickOne<ExamTestSummary>(reading.filter((t: ExamTestSummary) => readyReading.has(t.id)), (t) => seen.has(t.id));
  const w1 = pickOne<WritingPrompt>(t1, writingSeen("task1"));
  const w2 = pickOne<WritingPrompt>(t2, writingSeen("task2"));
  if (!l || !r || !w1 || !w2) return null;
  return { listening: l.id, reading: r.id, task1: w1.id, task2: w2.id, speaking: "", mode: CD_MOCK_MODE };
}

// ---------------------------------------------------------------------------
// Attempt lifecycle
// ---------------------------------------------------------------------------

export type StartResult = { ok: true; attemptId: string; resumed: boolean } | { ok: false; error: string };

export async function startMock(studentId: string): Promise<StartResult> {
  const active = await db.mockAttempt.findFirst({
    where: { studentId, status: "active" },
    orderBy: { startedAt: "desc" },
    select: { id: true, updatedAt: true },
  });
  if (active) {
    if (Date.now() - active.updatedAt.getTime() < STALE_MS) return { ok: true, attemptId: active.id, resumed: true };
    await db.mockAttempt.update({ where: { id: active.id }, data: { status: "abandoned" } });
  }
  const papers = await pickPapers(studentId);
  if (!papers) {
    return { ok: false, error: "The computer mock needs a full 40-question Listening paper with all four existing recordings ready, a full Reading paper and existing Writing Task 1 and Task 2 prompts. Ask your teacher to check the library; no voice is generated automatically." };
  }
  try {
    const row = await db.mockAttempt.create({
      data: { studentId, status: "active", papers: json(papers), current: 0, results: json({}) },
      select: { id: true },
    });
    return { ok: true, attemptId: row.id, resumed: false };
  } catch (e) {
    // Two starts at once (two tabs, a retried request): the partial unique index
    // "one active attempt per student" (prisma/sql/deploy.sql) rejects the second
    // — resume the attempt the first request created.
    const winner = await db.mockAttempt.findFirst({ where: { studentId, status: "active" }, select: { id: true } });
    if (winner) return { ok: true, attemptId: winner.id, resumed: true };
    throw e;
  }
}

/**
 * The paper of the student's RUNNING mock section, while that section isn't
 * graded yet. Practising the same paper at that moment would reveal its answer
 * key on the practice result page, so the practice routes refuse it.
 */
export async function paperLockedByMock(studentId: string, examId: string): Promise<boolean> {
  try {
    const rows = await db.mockAttempt.findMany({
      where: { studentId, status: "active" },
      select: { papers: true, results: true },
      take: 3,
    });
    return rows.some((r: { papers: unknown; results: unknown }) => {
      const p = papersOf(r.papers);
      const done = resultsOf(r.results);
      return !!p && ((p.reading === examId && !done.READING) || (p.listening === examId && !done.LISTENING));
    });
  } catch {
    return true; // fail closed: database failure must not unlock answer-bearing practice
  }
}

export async function abandonMock(studentId: string, attemptId: string): Promise<boolean> {
  const r = await db.mockAttempt.updateMany({
    where: { id: attemptId, studentId, status: "active" },
    data: { status: "abandoned" },
  });
  return r.count > 0;
}

type AttemptRow = {
  id: string;
  studentId: string;
  status: string;
  papers: unknown;
  current: number;
  sectionStartedAt: Date | null;
  sectionDeadline: Date | null;
  draft: unknown;
  results: unknown;
  overall: number | null;
  startedAt: Date;
  finishedAt: Date | null;
  updatedAt: Date;
};

async function loadRow(studentId: string, attemptId: string): Promise<AttemptRow | null> {
  if (typeof attemptId !== "string" || !attemptId || attemptId.length > 64) return null;
  const row = await db.mockAttempt.findFirst({ where: { id: attemptId, studentId } }).catch(() => null);
  return (row as AttemptRow | null) ?? null;
}

/** Minutes on the section clock. Listening follows the recording (+ review time and a small buffer). */
async function sectionMinutes(section: MockSection, papers: MockPapers): Promise<number> {
  switch (section) {
    case "LISTENING": {
      if (isCdMock(papers)) {
        const test = await getListeningExam(papers.listening);
        const content = test ? await listeningClientContent(test, { recordingsOnly: true }) : null;
        const minutes = content ? recordingMinutes(content) : null;
        if (minutes == null) throw new Error("The selected Listening recordings are not ready.");
        return minutes;
      }
      // Browser voices speak at slightly different speeds and may need a retry,
      // so the server window is generous; the runner itself ends the section
      // after the recording and the 2-minute check.
      const t = await getListeningExam(papers.listening);
      return (t ? estimateListeningMinutes(t) : 40) + 12;
    }
    case "READING": {
      const t = await getReadingExam(papers.reading);
      if (isCdMock(papers) && (!t || !isFullObjective(t, 3))) throw new Error("The selected Reading paper is not a full exam.");
      return isCdMock(papers) ? 60 : t?.timeLimit ?? 60;
    }
    case "WRITING":
      return 60;
    case "SPEAKING":
      // 11–14 minutes of test plus microphone checks and Part 2 preparation.
      return 40;
  }
}

export async function beginSection(
  studentId: string,
  attemptId: string,
  section: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await loadRow(studentId, attemptId);
  if (!row || row.status !== "active") return { ok: false, error: "This mock exam is no longer active." };
  if (row.current !== section) return { ok: false, error: "This section has already finished — reloading the exam." };
  if (row.sectionStartedAt) return { ok: true };
  const papers = papersOf(row.papers);
  if (!papers) return { ok: false, error: "This mock exam is damaged. Please start a new one." };
  if (!Number.isInteger(section) || !mockSections(papers)[section]) return { ok: false, error: "Invalid exam section." };
  const minutes = await sectionMinutes(mockSections(papers)[section], papers);
  const now = Date.now();
  await db.mockAttempt.updateMany({
    where: { id: row.id, current: section, sectionStartedAt: null, status: "active" },
    data: { sectionStartedAt: new Date(now), sectionDeadline: new Date(now + minutes * 60_000), draft: Prisma.DbNull },
  });
  return { ok: true };
}

export async function saveMockDraft(studentId: string, attemptId: string, section: number, draft: unknown, revision?: number): Promise<{ ok: boolean; revision?: number; conflict?: boolean }> {
  const row = await loadRow(studentId, attemptId);
  if (!row || row.status !== "active" || row.current !== section || !row.sectionStartedAt || !validMockDraft(section, draft)) return { ok: false };
  const now = Date.now();
  if (row.sectionDeadline && now > row.sectionDeadline.getTime() + mockGrace(row.papers)) return { ok: false };
  const size = JSON.stringify(draft).length;
  if (size > MAX_DRAFT_CHARS) return { ok: false };
  const oldMeta = asRec(asRec(row.draft)?.__mock);
  const version = typeof oldMeta?.revision === "number" ? oldMeta.revision : 0;
  const { __mock: _meta, ...oldPayload } = asRec(row.draft) ?? {};
  if (isCdMock(row.papers) && revision === version - 1 && JSON.stringify(oldPayload) === JSON.stringify(draft)) return { ok: true, revision: version };
  if (isCdMock(row.papers) && revision !== version) return { ok: false, conflict: true, revision: version };
  const nextRevision = version + 1;
  const stored = { ...asRec(draft), __mock: { revision: nextRevision, savedAt: now } };
  const r = await db.mockAttempt.updateMany({
    where: { id: row.id, studentId, current: section, status: "active", updatedAt: row.updatedAt, ...(isCdMock(row.papers) ? { draft: { equals: row.draft == null ? Prisma.AnyNull : json(row.draft) } } : {}), ...(row.sectionDeadline ? { sectionDeadline: { gte: new Date(now - mockGrace(row.papers)) } } : {}) },
    data: { draft: json(stored) },
  });
  if (r.count === 1) return { ok: true, revision: nextRevision };
  const fresh = await loadRow(studentId, attemptId);
  const currentRevision = asRec(asRec(fresh?.draft)?.__mock)?.revision;
  return { ok: false, conflict: true, ...(typeof currentRevision === "number" ? { revision: currentRevision } : {}) };
}

function isBlankSection(skill: MockSection, payload: unknown): boolean {
  const p = asRec(payload);
  const filled = (v: unknown) => (typeof v === "string" ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : false);
  if (skill === "LISTENING" || skill === "READING") {
    const answers = asRec(p?.answers ?? payload);
    return !answers || !Object.values(answers).some(filled);
  }
  if (skill === "WRITING") {
    const essays = asRec(p?.essays ?? payload);
    return !essays || (!filled(essays.task1) && !filled(essays.task2));
  }
  const answers = Array.isArray(p?.answers) ? (p!.answers as unknown[]) : [];
  return !answers.some((a) => filled(asRec(a)?.transcript));
}

/**
 * A teacher can review a Writing / Speaking test the moment it is saved, i.e.
 * while this section is still being marked (the review then finds no mock
 * section to update). Use the reviewed bands in that case.
 */
async function withTeacherReviews(skill: MockSection, result: MockSectionResult): Promise<MockSectionResult> {
  if ((skill !== "WRITING" && skill !== "SPEAKING") || !result.testIds.length) return result;
  try {
    const rows: { id: string; score: number; review: { band: number; criteria: unknown } | null }[] = await db.iELTSTest.findMany({
      where: { id: { in: result.testIds } },
      select: { id: true, score: true, review: { select: { band: true, criteria: true } } },
    });
    if (!rows.some((r) => r.review)) return result;
    const bandOf = (id: string | undefined) => rows.find((r) => r.id === id)?.score;
    if (skill === "WRITING") {
      const t1 = bandOf(result.testIds[0]);
      const t2 = bandOf(result.testIds[1]);
      if (typeof t1 !== "number" || typeof t2 !== "number") return result;
      return { ...result, task1Band: t1, task2Band: t2, band: writingBand(t1, t2), reviewed: true };
    }
    const row = rows.find((r) => r.id === result.testIds[0]);
    if (!row?.review) return result;
    const c = readCriteria("SPEAKING", row.review.criteria);
    return {
      ...result,
      band: row.review.band,
      criteria: {
        fluency: c.fluency ?? result.criteria?.fluency ?? 0,
        lexical: c.lexical ?? result.criteria?.lexical ?? 0,
        grammar: c.grammar ?? result.criteria?.grammar ?? 0,
        pronunciation: c.pronunciation ?? null,
      },
      reviewed: true,
    };
  } catch {
    return result;
  }
}

export type SectionSubmitResult =
  | { ok: true; done: boolean; section: MockSection }
  | { ok: false; error: string; status: number };

/**
 * Grade and save one section, then move the sitting on. Idempotent: a retry of
 * an already-graded section returns ok, and every save uses a per-section
 * idempotency key, so XP is never paid twice.
 */
export async function submitMockSection(o: {
  studentId: string;
  userId: string;
  attemptId: string;
  section: number;
  payload: unknown;
  revision?: number;
  /** Force grading from the autosave (the deadline passed). */
  fromDraft?: boolean;
}): Promise<SectionSubmitResult> {
  const row = await loadRow(o.studentId, o.attemptId);
  if (!row) return { ok: false, error: "This mock exam couldn't be found.", status: 404 };
  const skill = mockSections(row.papers)[o.section];
  if (!skill) return { ok: false, error: "Unknown section.", status: 400 };
  const results = resultsOf(row.results);
  if (results[skill] || row.current > o.section || row.status === "finished") {
    return { ok: true, done: row.status === "finished", section: skill };
  }
  if (row.status !== "active") return { ok: false, error: "This mock exam is no longer active.", status: 409 };
  if (row.current !== o.section) return { ok: false, error: "Finish the earlier sections first.", status: 409 };
  if (!row.sectionStartedAt) return { ok: false, error: "Start the section first.", status: 409 };
  const papers = papersOf(row.papers);
  if (!papers) return { ok: false, error: "This mock exam is damaged. Please start a new one.", status: 500 };

  const now = Date.now();
  const deadline = row.sectionDeadline?.getTime() ?? now;
  const late = now > deadline + mockGrace(papers);
  if (o.fromDraft && now < deadline) return { ok: false, status: 409, error: "The section clock has not ended yet." };
  if (isCdMock(papers) && !o.fromDraft && !late) {
    const meta = asRec(asRec(row.draft)?.__mock);
    const version = typeof meta?.revision === "number" ? meta.revision : 0;
    if (o.revision !== version) return { ok: false, status: 409, error: "The account draft changed. Reload and compare both copies before submitting." };
    if (!validMockDraft(o.section, o.payload)) return { ok: false, status: 400, error: "Invalid section answers." };
  }
  const auto = o.fromDraft || late;
  // After the deadline only the autosaved answers count — papers are collected.
  // Speaking has no autosave (answers are spoken live, not edited), so a late
  // Speaking submission is still marked from what the student said.
  const payload = o.fromDraft || (late && skill !== "SPEAKING") ? row.draft : o.payload;
  const timeSpent = Math.max(0, Math.round((Math.min(now, deadline) - row.sectionStartedAt.getTime()) / 1000));
  const key = `mock:${row.id}:${skill}`;

  let result: MockSectionResult;
  const submittedAt = new Date(now).toISOString();
  // Recorded Speaking answers live on the server (SpeakingRecording), not in the
  // payload / autosave — a section is only blank when nothing was recorded either.
  let blank = isBlankSection(skill, payload);
  if (blank && skill === "SPEAKING") blank = !(await hasRecordedSpeech(o.studentId, `${row.id}-S`, papers.speaking));
  if (blank) {
    // Nothing was answered (time ran out while away): the section scores 0, as
    // in the real exam, but no empty attempt is written into the student's
    // skill history.
    result = { band: 0, testIds: [], correct: 0, answered: 0, xp: 0, auto, submittedAt };
  } else if (skill === "LISTENING" || skill === "READING") {
    const test = skill === "LISTENING" ? await getListeningExam(papers.listening) : await getReadingExam(papers.reading);
    if (!test) return { ok: false, error: "This paper is no longer available.", status: 410 };
    const r = await submitObjectiveExam({
      studentId: o.studentId,
      test,
      partIndex: null,
      rawAnswers: asRec(payload)?.answers ?? payload,
      timeSpent,
      idempotencyKey: key,
      mockAttemptId: row.id,
      auto,
    });
    result = { band: r.band, testIds: [r.testId], correct: r.correct, total: r.total, answered: r.answered, xp: r.xpAwarded, auto, submittedAt };
  } else if (skill === "WRITING") {
    const [task1, task2] = await Promise.all([getWritingTask("task1", papers.task1), getWritingTask("task2", papers.task2)]);
    if (!task1 || !task2) return { ok: false, error: "This Writing paper is no longer available.", status: 410 };
    const essays = asRec(asRec(payload)?.essays ?? payload) ?? {};
    const r = await submitWritingExam({
      studentId: o.studentId,
      userId: o.userId,
      task1,
      task2,
      essays: { task1: essays.task1, task2: essays.task2 },
      timeSpent,
      idempotencyKey: key,
      mockAttemptId: row.id,
      auto,
    });
    result = {
      band: r.band,
      testIds: [r.task1.testId, r.task2.testId],
      xp: r.task1.xpAwarded + r.task2.xpAwarded,
      task1Band: r.task1.band,
      task2Band: r.task2.band,
      auto,
      submittedAt,
    };
  } else {
    const set = await getSpeakingSet(papers.speaking);
    if (!set) return { ok: false, error: "This Speaking set is no longer available.", status: 410 };
    const p = asRec(payload) ?? {};
    const r = await submitSpeakingTest({
      studentId: o.studentId,
      userId: o.userId,
      set,
      rawAnswers: p.answers,
      inputMode: p.inputMode,
      idempotencyKey: key,
      mockAttemptId: row.id,
      auto,
      // Late Speaking is still marked, so bound it by the real elapsed time, not the deadline.
      maxSeconds: Math.max(0, Math.round((now - row.sectionStartedAt.getTime()) / 1000)),
      // Answers recorded by the runner (attempt id "<mockAttemptId>-S", see the orchestrator).
      recordingKey: `${row.id}-S`,
    });
    result = {
      band: r.band,
      testIds: [r.testId],
      xp: r.xpAwarded,
      criteria: { fluency: r.criteria.fluency, lexical: r.criteria.lexical, grammar: r.criteria.grammar },
      feedback: r.feedback.slice(0, 4),
      assessedBy: r.assessedBy,
      auto,
      submittedAt,
    };
  }

  result = await withTeacherReviews(skill, result);
  const next = o.section + 1;
  const done = next >= mockSections(papers).length;
  // Re-read: grading can take ~30 s (AI examiner) and a teacher may have reviewed
  // an earlier section meanwhile — never write back a stale copy of the results.
  // The write is guarded by the row's updatedAt too: a review (lib/review/save
  // updateMock) that commits between this read and the write makes it match no
  // row, and the results are re-read and merged again — same loop as updateMock.
  for (let attempt = 0; attempt < 4; attempt++) {
    const fresh = await loadRow(o.studentId, o.attemptId);
    if (!fresh || fresh.status !== "active" || fresh.current !== o.section || resultsOf(fresh.results)[skill]) {
      return { ok: true, done: fresh?.status === "finished", section: skill };
    }
    // A review of this section's own tests saved since the last look.
    if (attempt > 0) result = await withTeacherReviews(skill, result);
    const merged: MockResults = { ...resultsOf(fresh.results), [skill]: result };
    const overall = done && !isCdMock(papers) ? overallBand(MOCK_SECTIONS.map((s) => merged[s]?.band ?? 0)) : null;
    const continueClock = isCdMock(papers) && !done;
    const nextStart = nextClock(deadline, now);
    const nextMinutes = continueClock ? await sectionMinutes(mockSections(papers)[next], papers) : 0;
    const r: { count: number } = await db.mockAttempt.updateMany({
      where: { id: row.id, current: o.section, status: "active", updatedAt: fresh.updatedAt },
      data: {
        current: next,
        results: json(merged),
        draft: Prisma.DbNull,
        sectionStartedAt: continueClock ? new Date(nextStart) : null,
        sectionDeadline: continueClock ? new Date(nextStart + nextMinutes * 60_000) : null,
        ...(done ? { status: "finished", finishedAt: new Date(now), overall } : {}),
      },
    });
    if (r.count > 0) return { ok: true, done, section: skill };
  }
  console.warn(`Mock attempt ${row.id}: the ${skill} section kept changing while it was saved; not moved on.`);
  // Retryable: the section's tests are saved under per-section keys, so a retry only redoes this write.
  return { ok: false, error: "Your answers were marked, but the exam couldn't move on. Press Try again — nothing is lost.", status: 503 };
}

// ---------------------------------------------------------------------------
// Views for the pages
// ---------------------------------------------------------------------------

export interface MockSectionView {
  skill: MockSection;
  index: number;
  title: string;
  detail: string;
  minutes: number;
  status: "done" | "current" | "upcoming";
  band?: number;
}

export type MockContent =
  | { skill: "LISTENING"; test: ClientListeningTest }
  | { skill: "READING"; test: ClientReadingTest }
  | { skill: "WRITING"; task1: WritingPrompt; task2: WritingPrompt }
  | { skill: "SPEAKING"; set: SpeakingExamSet };

export type MockStage =
  | { kind: "intro"; section: MockSection; index: number; soundCheckUrl?: string }
  | { kind: "running"; section: MockSection; index: number; deadline: number; content: MockContent; draft: unknown }
  | { kind: "finished" }
  | { kind: "abandoned" };

export interface MockView {
  attemptId: string;
  sections: MockSectionView[];
  stage: MockStage;
  startedAt: string;
  mode?: typeof CD_MOCK_MODE;
}

const SECTION_TITLE: Record<MockSection, string> = {
  LISTENING: "Listening",
  READING: "Reading",
  WRITING: "Writing",
  SPEAKING: "Speaking",
};

async function sectionViews(papers: MockPapers, current: number, results: MockResults): Promise<MockSectionView[]> {
  const [listening, reading] = await Promise.all([listListeningExams(), listReadingExams()]);
  const l = listening.find((t) => t.id === papers.listening);
  const r = reading.find((t) => t.id === papers.reading);
  const detail: Record<MockSection, { detail: string; minutes: number }> = {
    LISTENING: { detail: `4 parts · ${l?.questions ?? 40} questions · the recording plays once`, minutes: isCdMock(papers) ? Math.ceil(await sectionMinutes("LISTENING", papers).catch(() => l?.timeLimit ?? 35)) : l?.timeLimit ?? 35 },
    READING: { detail: `3 passages · ${r?.questions ?? 40} questions`, minutes: r?.timeLimit ?? 60 },
    WRITING: { detail: "Task 1 (150+ words) and Task 2 (250+ words)", minutes: 60 },
    SPEAKING: { detail: "Parts 1–3 with the examiner", minutes: 14 },
  };
  return mockSections(papers).map((skill, index) => ({
    skill,
    index,
    title: SECTION_TITLE[skill],
    ...detail[skill],
    status: index < current ? "done" : index === current ? "current" : "upcoming",
    band: results[skill]?.band,
  }));
}

async function sectionContent(section: MockSection, papers: MockPapers): Promise<MockContent | null> {
  switch (section) {
    case "LISTENING": {
      const t = await getListeningExam(papers.listening);
      if (!t) return null;
      const content = isCdMock(papers) ? await listeningClientContent(t, { recordingsOnly: true }) : await listeningClientContent(t);
      return content ? { skill: "LISTENING", test: content } : null;
    }
    case "READING": {
      const t = await getReadingExam(papers.reading);
      return t ? { skill: "READING", test: toClientReading(t) } : null;
    }
    case "WRITING": {
      const [t1, t2] = await Promise.all([getWritingTask("task1", papers.task1), getWritingTask("task2", papers.task2)]);
      return t1 && t2 ? { skill: "WRITING", task1: examPrompt(t1), task2: examPrompt(t2) } : null;
    }
    case "SPEAKING": {
      const s = await getSpeakingSet(papers.speaking);
      return s ? { skill: "SPEAKING", set: s } : null;
    }
  }
}

/**
 * Everything the run page needs. A section whose clock ran out while the
 * student was away is graded from its autosave first, so the view is always
 * consistent with the server clock.
 */
export async function getMockView(studentId: string, userId: string, attemptId: string): Promise<MockView | null> {
  let row = await loadRow(studentId, attemptId);
  if (!row) return null;

  for (let guard = 0; guard < MOCK_SECTIONS.length && row && row.status === "active"; guard++) {
    const deadline = row.sectionDeadline?.getTime();
    if (!row.sectionStartedAt || !deadline || Date.now() <= deadline + mockGrace(row.papers)) break;
    // Never let grading break the page: on a failure the running section is
    // shown as usual — its runner submits at once (the clock is over) and
    // offers Try again if marking fails again.
    try {
      const r = await submitMockSection({ studentId, userId, attemptId: row.id, section: row.current, payload: null, fromDraft: true });
      if (!r.ok) {
        if (r.status === 410) await abandonMock(studentId, row.id); // its paper was removed from the library
        row = await loadRow(studentId, attemptId);
        break;
      }
    } catch (e) {
      console.error("Mock auto-grade failed:", e);
      break;
    }
    row = await loadRow(studentId, attemptId);
  }
  if (!row) return null;

  const papers = papersOf(row.papers);
  if (!papers) return null;
  const results = resultsOf(row.results);
  const sections = await sectionViews(papers, row.current, results);
  const base = { attemptId: row.id, sections, startedAt: row.startedAt.toISOString(), ...(isCdMock(papers) ? { mode: CD_MOCK_MODE } : {}) };

  if (row.status === "finished" || row.current >= mockSections(papers).length) return { ...base, stage: { kind: "finished" } };
  if (row.status !== "active") return { ...base, stage: { kind: "abandoned" } };

  const section = mockSections(papers)[row.current];
  if (!row.sectionStartedAt || !row.sectionDeadline) {
    const preflight = isCdMock(papers) && section === "LISTENING" ? await sectionContent(section, papers) : null;
    return { ...base, stage: { kind: "intro", section, index: row.current, ...(preflight?.skill === "LISTENING" ? { soundCheckUrl: preflight.test.parts[0]?.audio?.url } : {}) } };
  }
  const content = await sectionContent(section, papers);
  if (!content) {
    // The paper was removed from the library mid-sitting: close the attempt so
    // the hub doesn't keep offering a Resume that can't open.
    await abandonMock(studentId, row.id).catch(() => false);
    return { ...base, stage: { kind: "abandoned" } };
  }
  return {
    ...base,
    stage: {
      kind: "running",
      section,
      index: row.current,
      deadline: row.sectionDeadline.getTime(),
      content,
      draft: row.draft ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Results + history
// ---------------------------------------------------------------------------

export interface MockResultView {
  attemptId: string;
  status: string;
  overall: number | null;
  startedAt: string;
  finishedAt: string | null;
  results: MockResults;
  papers: { listening: string; reading: string; task1: string; task2: string; speaking: string };
  sections: MockSection[];
  mode?: typeof CD_MOCK_MODE;
}

export async function getMockResult(studentId: string, attemptId: string): Promise<MockResultView | null> {
  const row = await loadRow(studentId, attemptId);
  if (!row) return null;
  const papers = papersOf(row.papers);
  if (!papers) return null;
  const [listening, reading, t1, t2, speaking] = await Promise.all([
    listListeningExams(),
    listReadingExams(),
    getWritingTask("task1", papers.task1),
    getWritingTask("task2", papers.task2),
    listSpeakingSets(),
  ]);
  return {
    attemptId: row.id,
    status: row.status,
    overall: isCdMock(papers) ? null : row.overall,
    sections: [...mockSections(papers)],
    ...(isCdMock(papers) ? { mode: CD_MOCK_MODE } : {}),
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    results: resultsOf(row.results),
    papers: {
      listening: listening.find((t) => t.id === papers.listening)?.title ?? "Listening paper",
      reading: reading.find((t) => t.id === papers.reading)?.title ?? "Reading paper",
      task1: t1?.title ?? "Writing Task 1",
      task2: t2?.title ?? "Writing Task 2",
      speaking: speaking.find((s) => s.id === papers.speaking)?.title ?? "Speaking set",
    },
  };
}

export interface MockHistoryItem {
  attemptId: string;
  status: string;
  overall: number | null;
  current: number;
  startedAt: string;
  finishedAt: string | null;
  bands: Partial<Record<MockSection, number>>;
  sections: MockSection[];
}

export async function listMockAttempts(studentId: string, take = 12): Promise<MockHistoryItem[]> {
  const rows = await db.mockAttempt
    .findMany({
      where: { studentId, status: { in: ["active", "finished"] } },
      orderBy: { startedAt: "desc" },
      take,
      select: { id: true, status: true, overall: true, current: true, startedAt: true, finishedAt: true, results: true, papers: true },
    })
    .catch(() => [] as never[]);
  return (rows as { id: string; status: string; overall: number | null; current: number; startedAt: Date; finishedAt: Date | null; results: unknown; papers: unknown }[]).map((r) => {
    const res = resultsOf(r.results);
    const bands: Partial<Record<MockSection, number>> = {};
    for (const s of MOCK_SECTIONS) if (res[s]) bands[s] = res[s]!.band;
    return {
      attemptId: r.id,
      status: r.status,
      overall: isCdMock(r.papers) ? null : r.overall,
      current: r.current,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
      bands,
      sections: [...mockSections(r.papers)],
    };
  });
}
