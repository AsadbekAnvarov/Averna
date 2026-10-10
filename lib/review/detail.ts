/**
 * One Writing / Speaking attempt as the teacher reviews it: the student's work
 * (prompt, chart, essay and the AI's highlighted issues — or every Speaking
 * answer with its transcript and recording), the AI assessment, the sitting it
 * belongs to and the current review.
 *
 * SERVER ONLY.
 */

import { db } from "@/lib/db";
import { canReviewStudent, type Viewer } from "@/lib/access";
import { getSpeakingSet, getWritingTask } from "@/lib/ielts/catalog";
import { audioNotKeptReason } from "@/lib/speaking/recording";
import type { Task1ChartData } from "@/lib/writing-data";
import {
  aiBandOf,
  aiCriteriaOf,
  attemptLabel,
  isReviewSkill,
  MIN_TASK_WORDS,
  readCriteria,
  studentResultHref,
  type ReviewCriteria,
  type ReviewSkill,
  type WritingTask,
} from "./scoring";
import type { ReviewSource } from "./filters";
import {
  answersOf,
  asRec,
  attemptTitle,
  countWords,
  examAttemptIdOf,
  isFullSpeakingTest,
  isMockAttempt,
  mockAttemptIdOf,
  num,
  recordingKeyOf,
  str,
  taskTypeOf,
} from "./answers";

export interface ExistingReview {
  band: number;
  aiBand: number | null;
  criteria: ReviewCriteria;
  comment: string | null;
  reviewerName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WritingIssue {
  text: string;
  type: string;
  suggestion: string;
}

export interface WritingDetail {
  taskType: WritingTask | null;
  prompt: string;
  promptType: string | null;
  chart: Task1ChartData[] | null;
  imageUrl: string | null;
  essay: string;
  words: number;
  minWords: number;
  issues: WritingIssue[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  detailedFeedback: string;
  /** The other task written in the same sitting (full Writing test / mock). */
  sibling: { testId: string; label: string; reviewed: boolean; band: number } | null;
}

export interface SpeakingAnswerView {
  key: string;
  question: string;
  transcript: string;
  seconds: number;
  words: number;
  /** Playable recording (https, not expired). */
  audioUrl: string | null;
  mimeType: string | null;
  /** Recorded, but the audio file is no longer kept. */
  audioExpired: boolean;
  /**
   * Recorded, but no audio file was stored: "monthly-limit" — this month's
   * audio budget was used up (SPEAKING_AUDIO_MONTHLY_UPLOADS); "off" — audio
   * storage isn't set up or retention is 0. null otherwise.
   */
  audioNotKept: "monthly-limit" | "off" | null;
}

export interface SpeakingPartView {
  part: 1 | 2 | 3 | null;
  title: string;
  /** Part 2 cue card, when the set is still in the library. */
  cue: { cue: string; points: string[]; closing: string } | null;
  answers: SpeakingAnswerView[];
}

export interface SpeakingDetail {
  fullTest: boolean;
  inputMode: "speech" | "typed" | "in-person" | null;
  /** Some answers were recorded on the server. */
  recorded: boolean;
  /** When the first still-available recording expires. */
  audioUntil: Date | null;
  parts: SpeakingPartView[];
  words: number;
  seconds: number;
  feedback: string[];
}

export interface ReviewAttempt {
  testId: string;
  studentId: string;
  studentName: string;
  groupName: string | null;
  skill: ReviewSkill;
  label: string;
  title: string;
  completedAt: Date;
  timeSpent: number;
  source: ReviewSource;
  homeworkTitle: string | null;
  mockAttemptId: string | null;
  /** Submitted automatically when the clock ran out. */
  auto: boolean;
  /** The AI's band (kept in the review once a teacher has reviewed). */
  aiBand: number | null;
  aiCriteria: ReviewCriteria;
  assessedBy: "ai" | "heuristic" | null;
  review: ExistingReview | null;
  resultHref: string;
  writing: WritingDetail | null;
  speaking: SpeakingDetail | null;
}

export type LoadReviewResult = { ok: true; attempt: ReviewAttempt } | { ok: false; reason: "not-found" | "forbidden" };

const TEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const strings = (x: unknown, max = 12): string[] =>
  (Array.isArray(x) ? x : []).filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, max);
const normQ = (q: string) => q.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

type Row = {
  id: string;
  studentId: string;
  module: string;
  score: number;
  answers: unknown;
  aiAnalysis: unknown;
  timeSpent: number;
  completedAt: Date;
  student: { userId: string; user: { name: string | null } | null; group: { name: string } | null } | null;
  review: { band: number; aiBand: number | null; criteria: unknown; comment: string | null; reviewerId: string; createdAt: Date; updatedAt: Date } | null;
};

/** The attempt with everything the review page shows — only for a teacher of the student's group or an admin. */
export async function loadReviewAttempt(viewer: Viewer, testId: string): Promise<LoadReviewResult> {
  if (typeof testId !== "string" || !TEST_ID_RE.test(testId)) return { ok: false, reason: "not-found" };
  const t: Row | null = await db.iELTSTest.findUnique({
    where: { id: testId },
    select: {
      id: true,
      studentId: true,
      module: true,
      score: true,
      answers: true,
      aiAnalysis: true,
      timeSpent: true,
      completedAt: true,
      student: { select: { userId: true, user: { select: { name: true } }, group: { select: { name: true } } } },
      review: { select: { band: true, aiBand: true, criteria: true, comment: true, reviewerId: true, createdAt: true, updatedAt: true } },
    },
  });
  if (!t || !isReviewSkill(t.module)) return { ok: false, reason: "not-found" };
  if (!(await canReviewStudent(viewer, t.studentId))) return { ok: false, reason: "forbidden" };

  const skill: ReviewSkill = t.module;
  const a = answersOf(t.answers);
  const ai = asRec(t.aiAnalysis) ?? {};
  const taskType = skill === "WRITING" ? taskTypeOf(a) : null;

  const [reviewer, writing, speaking] = await Promise.all([
    t.review ? db.user.findUnique({ where: { id: t.review.reviewerId }, select: { name: true } }).catch(() => null) : null,
    skill === "WRITING" ? writingDetail(t, a, ai, taskType) : null,
    skill === "SPEAKING" ? speakingDetail(t, a, ai) : null,
  ]);

  // Homework: a submission points at this test — or, for Task 1 of a full
  // Writing test, at the sitting's Task 2.
  const homeworkIds = [t.id, ...(writing?.sibling ? [writing.sibling.testId] : [])];
  const sub: { homework: { title: string | null; contentTitle: string | null } | null } | null = await db.homeworkSubmission
    .findFirst({ where: { testId: { in: homeworkIds } }, select: { homework: { select: { title: true, contentTitle: true } } } })
    .catch(() => null);
  const mock = isMockAttempt(a);
  const source: ReviewSource = sub ? "homework" : mock ? "mock" : "practice";

  const aiBand = t.review ? t.review.aiBand ?? aiBandOf(skill, ai) : aiBandOf(skill, ai) ?? t.score;
  return {
    ok: true,
    attempt: {
      testId: t.id,
      studentId: t.studentId,
      studentName: t.student?.user?.name?.trim() || "Student",
      groupName: t.student?.group?.name ?? null,
      skill,
      label: attemptLabel(skill, taskType, isFullSpeakingTest(a)),
      title: attemptTitle(skill, a),
      completedAt: t.completedAt,
      timeSpent: t.timeSpent,
      source,
      homeworkTitle: sub ? (sub.homework?.title || sub.homework?.contentTitle || "Homework").trim() : null,
      mockAttemptId: mock ? mockAttemptIdOf(a) : null,
      auto: a.auto === true,
      aiBand,
      aiCriteria: aiCriteriaOf(skill, ai),
      assessedBy: ai.assessedBy === "ai" ? "ai" : ai.assessedBy === "heuristic" ? "heuristic" : null,
      review: t.review
        ? {
            band: t.review.band,
            aiBand: t.review.aiBand,
            criteria: readCriteria(skill, t.review.criteria),
            comment: t.review.comment,
            reviewerName: reviewer?.name ?? null,
            createdAt: t.review.createdAt,
            updatedAt: t.review.updatedAt,
          }
        : null,
      resultHref: studentResultHref(skill, t.id),
      writing,
      speaking,
    },
  };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

async function writingDetail(
  t: Row,
  a: Record<string, unknown>,
  ai: Record<string, unknown>,
  taskType: WritingTask | null
): Promise<WritingDetail> {
  const essay = str(a.essay);
  const promptId = str(a.promptId);
  const examAttemptId = examAttemptIdOf(a);

  const [prompt, sibling] = await Promise.all([
    taskType && promptId ? getWritingTask(taskType, promptId).catch(() => null) : null,
    examAttemptId
      ? (db.iELTSTest
          .findFirst({
            where: {
              studentId: t.studentId,
              module: "WRITING",
              id: { not: t.id },
              answers: { path: ["examAttemptId"], equals: examAttemptId },
            },
            select: { id: true, score: true, answers: true, review: { select: { id: true } } },
          })
          .catch(() => null) as Promise<{ id: string; score: number; answers: unknown; review: { id: string } | null } | null>)
      : null,
  ]);

  const frozenChart = typeof a.groupSessionId === "string" && Array.isArray(a.chart) ? a.chart as Task1ChartData[] : null;
  const chart = taskType === "task1" ? (frozenChart?.length ? frozenChart : prompt?.chart?.length ? prompt.chart : null) : null;
  const issues: WritingIssue[] = (Array.isArray(ai.issues) ? ai.issues : [])
    .map((x) => asRec(x))
    .filter((x): x is Record<string, unknown> => !!x && typeof x.text === "string" && x.text.trim().length > 0)
    .slice(0, 30)
    .map((x) => ({ text: str(x.text), type: str(x.type) || "note", suggestion: str(x.suggestion) }));

  return {
    taskType,
    prompt: str(a.prompt) || prompt?.prompt || "",
    promptType: prompt?.type || null,
    chart,
    imageUrl: taskType === "task1" && !chart ? (typeof a.groupSessionId === "string" && typeof a.imageUrl === "string" ? a.imageUrl : prompt?.imageUrl ?? null) : null,
    essay,
    words: num(ai.wordCount) ?? countWords(essay),
    minWords: MIN_TASK_WORDS[taskType ?? "task2"],
    issues,
    strengths: strings(ai.strengths),
    weaknesses: strings(ai.weaknesses),
    recommendations: strings(ai.recommendations),
    detailedFeedback: str(ai.detailedFeedback).trim(),
    sibling: sibling
      ? {
          testId: sibling.id,
          label: attemptLabel("WRITING", taskTypeOf(answersOf(sibling.answers))),
          reviewed: !!sibling.review,
          band: sibling.score,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Speaking
// ---------------------------------------------------------------------------

type Recording = {
  id: string;
  part: number;
  questionIndex: number;
  question: string;
  transcript: string;
  words: number;
  durationMs: number;
  audioUrl: string | null;
  mimeType: string | null;
  expiresAt: Date | null;
  metrics: unknown;
};

const PART_TITLE: Record<1 | 2 | 3, string> = {
  1: "Part 1 · Introduction and interview",
  2: "Part 2 · Long turn",
  3: "Part 3 · Discussion",
};

async function speakingDetail(t: Row, a: Record<string, unknown>, ai: Record<string, unknown>): Promise<SpeakingDetail> {
  const fullTest = isFullSpeakingTest(a);
  const recordingKey = recordingKeyOf(a);
  const examId = str(a.examId);
  const [recordings, set] = await Promise.all([
    recordingKey
      ? (db.speakingRecording
          .findMany({
            where: { studentId: t.studentId, attemptKey: recordingKey, ...(examId ? { setId: examId } : {}) },
            orderBy: { questionIndex: "asc" },
            select: {
              id: true,
              part: true,
              questionIndex: true,
              question: true,
              transcript: true,
              words: true,
              durationMs: true,
              audioUrl: true,
              mimeType: true,
              expiresAt: true,
              metrics: true,
            },
          })
          .catch(() => []) as Promise<Recording[]>)
      : Promise.resolve([] as Recording[]),
    fullTest && examId ? getSpeakingSet(examId).catch(() => null) : null,
  ]);

  const now = Date.now();
  const playable = (r: Recording | undefined) =>
    !!r && !!r.audioUrl && r.audioUrl.startsWith("https://") && (!r.expiresAt || r.expiresAt.getTime() > now);

  const byIndex = new Map(recordings.map((r) => [r.questionIndex, r]));
  const byQuestion = new Map(recordings.map((r) => [normQ(r.question), r]));
  const used = new Set<string>();

  type Item = { part: 1 | 2 | 3 | null; view: SpeakingAnswerView };
  const items: Item[] = [];
  const view = (id: string, question: string, transcript: string, seconds: number, rec?: Recording): SpeakingAnswerView => {
    const text = transcript.trim() || rec?.transcript?.trim() || "";
    return {
      key: id,
      question,
      transcript: text,
      seconds: rec && rec.durationMs > 0 ? Math.round(rec.durationMs / 1000) : Math.max(0, Math.round(seconds)),
      words: countWords(text),
      audioUrl: playable(rec) ? rec!.audioUrl : null,
      mimeType: rec?.mimeType ?? null,
      // Stored once (it had an expiry), gone now.
      audioExpired: !!rec && !playable(rec) && !!rec.expiresAt,
      // Never stored: the month's audio budget, or no audio storage.
      audioNotKept: rec && !playable(rec) && !rec.expiresAt ? (audioNotKeptReason(rec.metrics) ?? "off") : null,
    };
  };

  if (fullTest) {
    (a.answers as unknown[]).slice(0, 60).forEach((raw, i) => {
      const x = asRec(raw);
      if (!x) return;
      const part = x.part === 1 || x.part === 2 || x.part === 3 ? x.part : null;
      const question = str(x.question);
      const qi = num(x.questionIndex);
      const rec = (qi != null ? byIndex.get(qi) : undefined) ?? byQuestion.get(normQ(question));
      if (rec) used.add(rec.id);
      items.push({ part, view: view(`a${i}`, question, str(x.transcript), num(x.seconds) ?? 0, rec) });
    });
  } else {
    items.push({
      part: null,
      view: view("a0", str(a.question), str(a.transcript), num(ai.seconds) ?? t.timeSpent),
    });
  }
  // Recordings the saved answers don't mention (e.g. an answer dropped at submission) are still shown.
  for (const r of recordings) {
    if (used.has(r.id) || !fullTest) continue;
    const part = r.part === 1 || r.part === 2 || r.part === 3 ? r.part : null;
    items.push({ part, view: view(`r${r.questionIndex}`, r.question, r.transcript, r.durationMs / 1000, r) });
  }

  const parts: SpeakingPartView[] = [];
  const order: (1 | 2 | 3 | null)[] = fullTest ? [1, 2, 3, null] : [null];
  for (const p of order) {
    const answers = items.filter((i) => i.part === p).map((i) => i.view);
    if (!answers.length) continue;
    parts.push({
      part: p,
      title: p ? PART_TITLE[p] : fullTest ? "Other answers" : "Practice answer",
      cue: p === 2 && set ? { cue: set.part2.cue, points: set.part2.points ?? [], closing: set.part2.closing ?? "" } : null,
      answers,
    });
  }

  const live = recordings.filter((r) => playable(r) && r.expiresAt).map((r) => r.expiresAt!.getTime());
  const allAnswers = items.map((i) => i.view);
  return {
    fullTest,
    inputMode: a.inputMode === "in-person" && a.teacherConducted === true ? "in-person" : a.inputMode === "typed" ? "typed" : a.inputMode === "speech" ? "speech" : null,
    recorded: recordings.length > 0,
    audioUntil: live.length ? new Date(Math.min(...live)) : null,
    parts,
    words: num(ai.wordCount) ?? allAnswers.reduce((s, x) => s + x.words, 0),
    seconds: num(ai.seconds) ?? allAnswers.reduce((s, x) => s + x.seconds, 0),
    feedback: strings(ai.feedback, 8),
  };
}
