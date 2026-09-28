/**
 * Server-side scoring + saving for exam-format attempts (format "exam-v2").
 *
 * Shared by the practice routes (/api/learning/{reading,listening}/submit,
 * /api/learning/speaking/test, /api/learning/writing/exam) and the mock exam,
 * so an attempt is graded, rewarded and stored the same way wherever it was
 * taken:
 *   answers → sanitised → graded against the key → IELTS band →
 *   integrity check → Progression Engine XP → saveIELTSTest (ledger, streak,
 *   missions, Learning DNA).
 *
 * SERVER ONLY — touches the database and the AI provider.
 */

import { db } from "@/lib/db";
import { saveIELTSTest } from "@/lib/db-helpers";
import {
  analyzeWritingIssues,
  assessSpeakingExam,
  assessWritingTask,
  heuristicWritingAssessment,
  type WritingAssessment,
} from "@/lib/ai";
import { isGenuineWriting, isOnTopic, scoreSpeaking } from "@/lib/utils";
import { guardAi } from "@/lib/engine/ai-guard";
import { applyTrust, assessSubmission, logAssessment } from "@/lib/engine/integrity-engine";
import { XP_CONFIG } from "@/lib/engine/progression/config";
import { hashString } from "@/lib/engine/progression/missions";
import { findSubmittedTest, loadXpHistory } from "@/lib/engine/progression/service";
import { computeObjectiveXp, computeSpeakingXp, computeWritingXp } from "@/lib/engine/progression/xp";
import type { WritingPrompt } from "@/lib/writing-data";
import type { SpeakingAnswer, SpeakingCriteria } from "@/components/exam/types";
import { answersFromRecordings, typedAnswersBesides } from "@/lib/speaking/answers";
import {
  fluencyFromMetrics,
  metricsFeedback,
  totalSpeechMetrics,
  type SpeechMetrics,
  type SpeechMetricsTotal,
} from "@/lib/speaking/metrics";
import { loadAttemptRecordings } from "@/lib/speaking/recording";
import { flattenSpeakingQuestions } from "@/lib/speaking/shared";
import { listeningBand, readingBand, roundBand, writingBand } from "./bands";
import { partWordCount, wordCount } from "./format";
import { expandOptional, gradeGroups, normalizeAnswer, sanitizeAnswers } from "./grading";
import type {
  ExamGroup,
  ExamListeningTest,
  ExamReadingTest,
  GradeResult,
  GroupKind,
  ReadingPart,
  SpeakingExamSet,
} from "./types";

const MAX_TIME = 3 * 60 * 60;
const clampTime = (x: unknown) => Math.max(0, Math.min(Math.round(Number(x) || 0), MAX_TIME));

/**
 * A client-supplied attempt id usable as an idempotency key. Practice ids are
 * the pages' random attempt ids; anything else (e.g. "mock:<id>:READING", the
 * mock's own server-side keys) is refused, so a practice submission can never
 * occupy another attempt's ledger key.
 */
export function clientAttemptKey(raw: unknown): string | undefined {
  return typeof raw === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(raw) ? raw : undefined;
}
const asRec = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

// ---------------------------------------------------------------------------
// Reading / Listening
// ---------------------------------------------------------------------------

/** A valid single-part index for practice, or null for the whole test. */
export function resolvePartIndex(test: { parts: unknown[] }, raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 0 || n >= test.parts.length) return null;
  return test.parts.length > 1 ? n : null;
}

/**
 * Repeat-decay key stored as `answers.testId`: the whole paper, or one part of
 * it — practising Passage 2 after Passage 1 is new material, not a retake.
 */
export function objectiveContentKey(testId: string, partIndex: number | null): string {
  return partIndex == null ? testId : `${testId}#p${partIndex + 1}`;
}

/** Probability of guessing one question of this group (Integrity Engine input). */
function chanceOf(g: ExamGroup): number {
  switch (g.kind) {
    case "tfng":
    case "ynng":
      return 1 / 3;
    case "mcq":
      return 1 / Math.max(2, g.questions[0]?.options?.length ?? 4);
    case "mcq-multi":
    case "matching":
    case "gap-box":
      return 1 / Math.max(2, g.options?.length ?? 5);
    default:
      return 0.02; // typed answers are effectively unguessable
  }
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}

const TAG_OF: Record<GroupKind, string> = {
  tfng: "inference",
  ynng: "inference",
  mcq: "detail_questions",
  "mcq-multi": "detail_questions",
  matching: "detail_questions",
  gap: "vocabulary_recall",
  "gap-box": "vocabulary_recall",
};

/**
 * Learning DNA mistake categories this paper actually shows — a pattern, not a
 * single slip: 2+ wrong AND a 40%+ failure rate within the category. Typed
 * answers that are one or two letters away from an accepted answer count as
 * spelling instead (a real IELTS mark lost to spelling).
 */
export function errorTagsFor(grade: GradeResult): string[] {
  const stats = new Map<string, { wrong: number; total: number }>();
  let spellingSlips = 0;
  for (const it of grade.items) {
    const tag = TAG_OF[it.kind];
    const s = stats.get(tag) ?? { wrong: 0, total: 0 };
    s.total += 1;
    if (!it.correct) {
      const given = normalizeAnswer(it.given);
      const nearMiss =
        it.kind === "gap" &&
        given.length >= 4 &&
        it.accepted.some((acc) =>
          expandOptional(acc).some((v) => {
            const d = levenshtein(given, normalizeAnswer(v));
            return d > 0 && d <= (v.length >= 7 ? 2 : 1);
          })
        );
      if (nearMiss) spellingSlips += 1;
      else s.wrong += 1;
    }
    stats.set(tag, s);
  }
  const tags: string[] = [];
  for (const [tag, s] of stats) if (s.wrong >= 2 && s.wrong / s.total >= 0.4) tags.push(tag);
  if (spellingSlips >= 2) tags.push("spelling");
  return tags;
}

export interface ObjectiveSubmission {
  studentId: string;
  test: ExamReadingTest | ExamListeningTest;
  /** One practised part (index into test.parts) or null for the whole paper. */
  partIndex: number | null;
  rawAnswers: unknown;
  timeSpent: unknown;
  /** Client attempt id — a retried submission returns the original result. */
  idempotencyKey?: string;
  /** Mock exam section: XP multiplier, answers tagged with the attempt. */
  mockAttemptId?: string;
  /** Submitted automatically when the time ran out. */
  auto?: boolean;
}

export interface ObjectiveOutcome {
  testId: string;
  duplicate: boolean;
  band: number;
  correct: number;
  total: number;
  answered: number;
  xpAwarded: number;
  xpNotes: string[];
  integrityNotice?: string;
}

/** XP the ledger paid for a saved attempt (a retried submission reports the original award). */
async function paidFor(studentId: string, testId: string): Promise<number> {
  try {
    const row = await db.xpTransaction.findFirst({ where: { studentId, refId: testId }, select: { amount: true } });
    return typeof row?.amount === "number" ? Math.max(0, row.amount) : 0;
  } catch {
    return 0;
  }
}

async function outcomeFromRow(studentId: string, row: { id: string; score: number; aiAnalysis: unknown }): Promise<ObjectiveOutcome> {
  const ai = asRec(row.aiAnalysis) ?? {};
  return {
    testId: row.id,
    duplicate: true,
    band: row.score,
    correct: num(ai.correctCount) ?? 0,
    total: num(ai.totalQuestions) ?? 0,
    answered: num(ai.answeredCount) ?? 0,
    xpAwarded: await paidFor(studentId, row.id),
    xpNotes: [],
  };
}

export async function submitObjectiveExam(s: ObjectiveSubmission): Promise<ObjectiveOutcome> {
  const previous = s.idempotencyKey ? await findSubmittedTest(s.studentId, s.idempotencyKey) : null;
  if (previous) return outcomeFromRow(s.studentId, previous);

  const { test } = s;
  const skill = test.skill;
  const parts = s.partIndex == null ? test.parts : [test.parts[s.partIndex]];
  const groups = parts.flatMap((p) => p.groups as ExamGroup[]);
  const answers = sanitizeAnswers(groups, s.rawAnswers);
  const grade = gradeGroups(groups, answers);
  const band = skill === "READING" ? readingBand(grade.correct, grade.total) : listeningBand(grade.correct, grade.total);
  const timeSpent = clampTime(s.timeSpent);
  const contentKey = objectiveContentKey(test.id, s.partIndex);
  const mock = !!s.mockAttemptId;

  // Integrity Engine — assessed BEFORE awarding so the verdict scales the XP
  // and the burst check doesn't count this attempt.
  const chances = groups.flatMap((g) => g.questions.map(() => chanceOf(g)));
  const facts = {
    studentId: s.studentId,
    module: mock ? `MOCK_${skill}` : skill,
    correct: grade.correct,
    total: grade.total,
    answered: grade.answered,
    timeSpent,
    chanceLevel: chances.length ? chances.reduce((a, b) => a + b, 0) / chances.length : 0.25,
  };
  const verdict = await assessSubmission(facts);
  const trust = applyTrust(verdict);

  const xp =
    grade.answered > 0 && grade.correct > 0
      ? computeObjectiveXp({
          skill,
          correct: grade.correct,
          total: grade.total,
          answered: grade.answered,
          band,
          difficulty: test.difficulty,
          multiplier: mock ? XP_CONFIG.mock.sectionMultiplier : undefined,
          history: { ...(await loadXpHistory(s.studentId, skill, contentKey)), trust: trust.multiplier },
        })
      : undefined;

  const percentage = grade.total ? Math.round((grade.correct / grade.total) * 1000) / 10 : 0;
  const words = skill === "READING" ? (parts as ReadingPart[]).reduce((sum, p) => sum + partWordCount(p), 0) : undefined;

  const saved = await saveIELTSTest(
    s.studentId,
    skill,
    band,
    {
      format: "exam-v2",
      testId: contentKey,
      examId: test.id,
      part: s.partIndex,
      title: test.title,
      answers,
      ...(mock ? { mock: true, mockAttemptId: s.mockAttemptId } : {}),
      ...(s.auto ? { auto: true } : {}),
    },
    {
      format: "exam-v2",
      correctCount: grade.correct,
      totalQuestions: grade.total,
      answeredCount: grade.answered,
      percentage,
      band,
      byKind: grade.byKind,
      items: grade.items,
      ...(mock ? { type: "mock" } : {}),
    },
    timeSpent,
    {
      contentKey,
      difficulty: test.difficulty,
      idempotencyKey: s.idempotencyKey,
      ...(xp ? { xp } : { pointsOverride: 0 }),
      logDetails: {
        accuracy: Math.round(percentage),
        questions: grade.total,
        ...(s.partIndex != null ? { part: s.partIndex + 1 } : {}),
        ...(mock ? { mock: true } : {}),
      },
      dna: { channel: skill === "READING" ? "reading" : "audio", words, errorTags: errorTagsFor(grade) },
    }
  );

  if (!saved.duplicate) await logAssessment(facts, verdict, saved.pointsAwarded ?? 0);

  return {
    testId: saved.id,
    duplicate: saved.duplicate,
    band,
    correct: grade.correct,
    total: grade.total,
    answered: grade.answered,
    xpAwarded: saved.pointsAwarded ?? 0,
    xpNotes: xp?.notes ?? (grade.answered > 0 ? ["Get at least one answer right to earn XP."] : ["Answer the questions to earn XP."]),
    integrityNotice: trust.reduced ? trust.notice : undefined,
  };
}

// ---------------------------------------------------------------------------
// Speaking (full test, Parts 1–3)
// ---------------------------------------------------------------------------

const normQ = (q: string) => q.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Keep only answers to questions that belong to this set (the part, the
 * question text and its `questionIndex` are taken from the set, never from the
 * client), one answer per question, with plausible per-answer durations.
 * `typed: true` is kept when the runner says the candidate typed the answer.
 */
export function validSpeakingAnswers(set: SpeakingExamSet, raw: unknown): SpeakingAnswer[] {
  // The runner's order (Part 1 → Part 2 cue → follow-up → Part 3); a repeated question counts once, where first asked.
  const allowed = new Map<string, { part: 1 | 2 | 3; index: number; question: string }>();
  for (const item of flattenSpeakingQuestions(set)) {
    const key = normQ(item.question);
    if (key && !allowed.has(key)) allowed.set(key, { part: item.part, index: item.index, question: item.question });
  }

  const out: SpeakingAnswer[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(raw) ? raw.slice(0, 60) : []) {
    const a = asRec(item);
    if (!a || typeof a.question !== "string") continue;
    const key = normQ(a.question);
    const q = allowed.get(key);
    if (!q || seen.has(key)) continue;
    seen.add(key);
    const transcript = typeof a.transcript === "string" ? a.transcript.trim().slice(0, 4000) : "";
    const cap = q.part === 2 ? 180 : 150;
    const seconds = Math.max(0, Math.min(Math.round(Number(a.seconds) || 0), cap));
    out.push({
      part: q.part,
      question: q.question.trim().slice(0, 400),
      transcript,
      seconds,
      questionIndex: q.index,
      ...(a.typed === true ? { typed: true } : {}),
    });
  }
  return out;
}

/** scoreSpeaking's pace tips — replaced by the recording's measured timing when it's known. */
const PACE_TIP = /\bpace\b|spoke very fast/i;

export interface SpeakingAssessmentResult {
  band: number;
  criteria: SpeakingCriteria;
  feedback: string[];
  perPart: { part: 1 | 2 | 3; words: number; seconds: number }[];
  assessedBy: "ai" | "heuristic";
  words: number;
  seconds: number;
}

export async function assessSpeakingAnswers(
  answers: SpeakingAnswer[],
  opts: {
    allowAi: boolean;
    /** Timing measured from the recordings (recorded attempts) — makes the heuristic fluency honest. */
    metrics?: SpeechMetricsTotal | null;
  }
): Promise<SpeakingAssessmentResult> {
  const perPart = ([1, 2, 3] as const).map((part) => {
    const mine = answers.filter((a) => a.part === part);
    return {
      part,
      words: mine.reduce((s, a) => s + wordCount(a.transcript), 0),
      seconds: mine.reduce((s, a) => s + a.seconds, 0),
    };
  });
  const words = perPart.reduce((s, p) => s + p.words, 0);
  const seconds = perPart.reduce((s, p) => s + p.seconds, 0);
  if (words === 0) {
    return {
      band: 0,
      criteria: { fluency: 0, lexical: 0, grammar: 0, pronunciation: null },
      feedback: ["We didn't receive any speech. Check your microphone permission and try the test again."],
      perPart,
      assessedBy: "heuristic",
      words,
      seconds,
    };
  }

  let criteria: SpeakingCriteria;
  let feedback: string[];
  let assessedBy: "ai" | "heuristic" = "heuristic";
  const ai = opts.allowAi ? await assessSpeakingExam(answers) : null;
  if (ai) {
    criteria = { fluency: ai.fluency, lexical: ai.lexical, grammar: ai.grammar, pronunciation: null };
    feedback = ai.feedback;
    assessedBy = "ai";
  } else {
    const joined = answers.map((a) => a.transcript).filter(Boolean).join(" ");
    const h = scoreSpeaking(joined, Math.max(1, seconds));
    // Recorded answers: fluency from the measured speech rate and pauses, not from words ÷ answer time.
    const timed = opts.metrics ? fluencyFromMetrics(opts.metrics, joined) : null;
    criteria = { fluency: timed ?? h.fluency, lexical: h.vocabulary, grammar: h.grammar, pronunciation: null };
    feedback =
      timed != null && opts.metrics
        ? [...metricsFeedback(opts.metrics), ...h.feedback.filter((f) => !PACE_TIP.test(f))]
        : [...h.feedback];
  }

  // A part left (almost) unanswered can't show fluency or coherence.
  const missing = perPart.filter((p) => p.words < 8);
  if (missing.length) {
    criteria.fluency = Math.max(0, criteria.fluency - 0.5 * missing.length);
    feedback.unshift(
      `Part ${missing.map((p) => p.part).join(" and Part ")} ${missing.length > 1 ? "were" : "was"} missing or very short — in the real test every part is assessed, so always give an answer.`
    );
  }
  const part2 = perPart[1];
  if (part2.words >= 8 && part2.seconds > 0 && part2.seconds < 60) {
    feedback.push("Your Part 2 talk was under a minute. Use the cue-card points to keep going for the full two minutes.");
  }
  const band = roundBand((criteria.fluency + criteria.lexical + criteria.grammar) / 3);
  return { band, criteria, feedback: feedback.slice(0, 6), perPart, assessedBy, words, seconds };
}

export interface SpeakingOutcome extends SpeakingAssessmentResult {
  testId: string;
  duplicate: boolean;
  xpAwarded: number;
  xpNotes: string[];
  /** Marked from the server's recordings (the teacher can listen to them). */
  recorded: boolean;
}

async function speakingOutcomeFromRow(
  studentId: string,
  row: { id: string; score: number; aiAnalysis: unknown; answers?: unknown }
): Promise<SpeakingOutcome> {
  const ai = asRec(row.aiAnalysis) ?? {};
  const c = asRec(ai.criteria) ?? {};
  const perPart = Array.isArray(ai.perPart) ? (ai.perPart as SpeakingOutcome["perPart"]) : [];
  return {
    testId: row.id,
    duplicate: true,
    band: row.score,
    criteria: {
      fluency: num(c.fluency) ?? 0,
      lexical: num(c.lexical) ?? 0,
      grammar: num(c.grammar) ?? 0,
      pronunciation: null,
    },
    feedback: Array.isArray(ai.feedback) ? (ai.feedback as unknown[]).filter((f): f is string => typeof f === "string") : [],
    perPart,
    assessedBy: ai.assessedBy === "ai" ? "ai" : "heuristic",
    words: num(ai.wordCount) ?? 0,
    seconds: num(ai.seconds) ?? 0,
    xpAwarded: await paidFor(studentId, row.id),
    xpNotes: [],
    recorded: asRec(row.answers)?.recorded === true,
  };
}

/**
 * The answers a Speaking attempt is marked from. When the runner recorded
 * them (SpeakingRecording rows under `recordingKey` for this set), the
 * server's transcripts and audio durations are used and whatever the browser
 * sent for those questions is ignored; a question without a recording keeps
 * the candidate's typed answer (the microphone failed and they typed instead).
 */
async function speakingAnswersFor(o: {
  studentId: string;
  set: SpeakingExamSet;
  rawAnswers: unknown;
  inputMode: unknown;
  recordingKey?: string;
}): Promise<{
  answers: SpeakingAnswer[];
  recorded: boolean;
  /** The typed half-XP rule applies. */
  typed: boolean;
  typedAnswers: number;
  metrics: SpeechMetricsTotal | null;
}> {
  const client = validSpeakingAnswers(o.set, o.rawAnswers);
  const rows = o.recordingKey ? await loadAttemptRecordings(o.studentId, o.recordingKey, o.set.id) : [];
  const recorded = answersFromRecordings(o.set, rows);
  if (!recorded.length) {
    // "recorded" with nothing recorded: the server heard none of it, so only the typed rule can apply.
    return { answers: client, recorded: false, typed: o.inputMode === "typed" || o.inputMode === "recorded", typedAnswers: 0, metrics: null };
  }
  const extra = typedAnswersBesides(recorded, client);
  const answers: SpeakingAnswer[] = [
    ...recorded.map((a) => ({ part: a.part, question: a.question, transcript: a.transcript, seconds: a.seconds, questionIndex: a.questionIndex })),
    ...extra,
  ].sort((x, y) => (x.questionIndex ?? 0) - (y.questionIndex ?? 0));
  const words = (list: { transcript: string }[]) => list.reduce((s, a) => s + wordCount(a.transcript), 0);
  const timed = recorded.map((a) => a.metrics).filter((m): m is SpeechMetrics => m !== null);
  return {
    answers,
    recorded: true,
    // Full XP for speaking (recorded, or the browser's transcripts after recording stopped); half only when most was typed.
    typed: words(extra.filter((a) => a.typed)) > words(recorded) + words(extra.filter((a) => !a.typed)),
    typedAnswers: extra.length,
    metrics: timed.length ? totalSpeechMetrics(timed) : null,
  };
}

export async function submitSpeakingTest(o: {
  studentId: string;
  userId: string;
  set: SpeakingExamSet;
  rawAnswers: unknown;
  inputMode: unknown;
  idempotencyKey?: string;
  mockAttemptId?: string;
  auto?: boolean;
  /** Server-measured upper bound for the total speaking time (the mock's section clock). */
  maxSeconds?: number;
  /**
   * The runner's attempt id. When the answers were recorded and transcribed on
   * the server (SpeakingRecording rows under this key), those transcripts and
   * durations are used instead of anything the browser sends.
   */
  recordingKey?: string;
}): Promise<SpeakingOutcome> {
  const previous = o.idempotencyKey ? await findSubmittedTest(o.studentId, o.idempotencyKey) : null;
  if (previous) return speakingOutcomeFromRow(o.studentId, previous);

  const picked = await speakingAnswersFor(o);
  let answers = picked.answers;
  const { recorded, typed, typedAnswers, metrics } = picked;
  // Durations (the browser's, or recordings made before the section started): never
  // let them add up to more time than the server saw pass.
  const claimed = answers.reduce((s, a) => s + a.seconds, 0);
  if (o.maxSeconds != null && o.maxSeconds >= 0 && claimed > o.maxSeconds) {
    const k = o.maxSeconds / claimed;
    answers = answers.map((a) => ({ ...a, seconds: Math.floor(a.seconds * k) }));
  }
  const allowAi = guardAi(o.userId, "speaking-test").ok;
  // The recordings' timing only speaks for a fully recorded attempt.
  const a = await assessSpeakingAnswers(answers, { allowAi, metrics: typedAnswers === 0 ? metrics : null });
  const inputMode = recorded ? "recorded" : typed ? "typed" : "speech";
  const mock = !!o.mockAttemptId;
  const contentKey = `speaking-test:${o.set.id}`;

  const xp = computeSpeakingXp({
    seconds: a.seconds,
    words: a.words,
    band: a.band,
    fullTest: true,
    typed,
    multiplier: mock ? XP_CONFIG.mock.sectionMultiplier : undefined,
    history: await loadXpHistory(o.studentId, "SPEAKING", contentKey),
  });

  const saved = await saveIELTSTest(
    o.studentId,
    "SPEAKING",
    a.band,
    {
      format: "exam-v2",
      testId: contentKey,
      examId: o.set.id,
      title: o.set.title,
      inputMode,
      answers,
      // Contract (lib/speaking/recording.ts): recorded attempts carry their recording key.
      ...(recorded ? { recorded: true, recordingKey: o.recordingKey } : {}),
      ...(typedAnswers > 0 ? { typedAnswers } : {}),
      ...(mock ? { mock: true, mockAttemptId: o.mockAttemptId } : {}),
      ...(o.auto ? { auto: true } : {}),
    },
    {
      format: "exam-v2",
      overall: a.band,
      fluency: a.criteria.fluency,
      vocabulary: a.criteria.lexical,
      grammar: a.criteria.grammar,
      criteria: a.criteria,
      wordCount: a.words,
      seconds: a.seconds,
      perPart: a.perPart,
      feedback: a.feedback,
      assessedBy: a.assessedBy,
      ...(metrics ? { metrics } : {}),
      ...(mock ? { type: "mock" } : {}),
    },
    a.seconds,
    {
      contentKey,
      idempotencyKey: o.idempotencyKey,
      xp,
      logDetails: { seconds: a.seconds, words: a.words, fullTest: true, ...(recorded ? { recorded: true } : {}), ...(mock ? { mock: true } : {}) },
      dna: { channel: "speaking", words: a.words },
    }
  );

  // Keep the legacy SpeakingSession tally (drives the Speaking Champion badge).
  if (!saved.duplicate && saved.pointsAwarded > 0) {
    await db.speakingSession
      .create({ data: { studentId: o.studentId, duration: Math.max(1, Math.round(a.seconds / 60)), points: saved.pointsAwarded } })
      .catch(() => {});
  }

  return { ...a, testId: saved.id, duplicate: saved.duplicate, xpAwarded: saved.pointsAwarded ?? 0, xpNotes: xp.notes, recorded };
}

// ---------------------------------------------------------------------------
// Writing (Task 1 + Task 2)
// ---------------------------------------------------------------------------

export type WritingTaskKey = "task1" | "task2";

const ISSUE_TAG: Record<string, string> = {
  grammar: "grammar_range",
  tense: "tenses",
  article: "articles",
  preposition: "prepositions",
  spelling: "spelling",
  vocabulary: "lexical_range",
  word: "word_form",
  cohesion: "coherence",
  linking: "coherence",
  task: "task_response",
};

function blankAssessment(task: WritingTaskKey): WritingAssessment {
  const label = task === "task1" ? "Task 1" : "Task 2";
  return {
    taskAchievement: 0,
    coherenceCohesion: 0,
    lexicalResource: 0,
    grammarAccuracy: 0,
    overallBand: 0,
    aiDetectionScore: 0,
    strengths: [],
    weaknesses: [`No ${label} response was written.`],
    recommendations: [
      task === "task1"
        ? "Spend about 20 minutes on Task 1 and write at least 150 words."
        : "Spend about 40 minutes on Task 2 and write at least 250 words — it carries twice the weight of Task 1.",
    ],
    detailedFeedback: `There was no ${label} answer to assess, so this task scores band 0 — exactly as in the real exam.`,
  };
}

export interface WritingAssessed {
  assessment: WritingAssessment;
  issues: { text: string; type: string; suggestion: string }[];
}

/** Examiner assessment of one essay (AI when allowed, transparent heuristics otherwise). */
export async function assessWritingEssay(
  task: WritingTaskKey,
  prompt: WritingPrompt,
  essay: string,
  allowAi: boolean
): Promise<WritingAssessed> {
  if (wordCount(essay) < 20) return { assessment: blankAssessment(task), issues: [] };
  let assessment: WritingAssessment;
  try {
    assessment = allowAi ? await assessWritingTask(essay, task, prompt.prompt) : heuristicWritingAssessment(essay, task);
  } catch (e) {
    // An AI outage must never fail a submission (the essay is saved and scored
    // with the transparent heuristic examiner instead).
    console.error("Writing assessment failed, using heuristics:", e);
    assessment = heuristicWritingAssessment(essay, task);
  }
  const heuristicIssues = analyzeWritingIssues(essay);
  const aiIssues = Array.isArray((assessment as { issues?: unknown }).issues)
    ? (assessment as { issues: { text: string; type: string; suggestion: string }[] }).issues
    : [];
  const seen = new Set(aiIssues.map((i) => String(i.text || "").toLowerCase()));
  const issues = [...aiIssues, ...heuristicIssues.filter((h) => !seen.has(String(h.text || "").toLowerCase()))].slice(0, 15);
  return { assessment, issues };
}

export interface WritingTaskOutcome {
  task: WritingTaskKey;
  testId: string;
  duplicate: boolean;
  band: number;
  words: number;
  xpAwarded: number;
  xpNotes: string[];
}

async function writingOutcomeFromRow(
  studentId: string,
  task: WritingTaskKey,
  row: { id: string; score: number; aiAnalysis: unknown }
): Promise<WritingTaskOutcome> {
  const ai = asRec(row.aiAnalysis) ?? {};
  return {
    task,
    testId: row.id,
    duplicate: true,
    band: row.score,
    words: num(ai.wordCount) ?? 0,
    xpAwarded: await paidFor(studentId, row.id),
    xpNotes: [],
  };
}

async function saveWritingTask(o: {
  studentId: string;
  task: WritingTaskKey;
  prompt: WritingPrompt;
  essay: string;
  assessed: WritingAssessed;
  timeSpent: number;
  idempotencyKey?: string;
  mockAttemptId?: string;
  examAttemptId?: string;
  auto?: boolean;
  skipSettle?: boolean;
}): Promise<WritingTaskOutcome> {
  const { task, essay, assessed } = o;
  const words = essay.trim().split(/\s+/).filter(Boolean);
  const minWords = XP_CONFIG.writing[task].minWords;
  const onTopic = isOnTopic(essay, o.prompt.prompt);
  const genuine = isGenuineWriting(essay, minWords);
  // Same key as the single-task route, so retakes decay across both surfaces.
  const contentKey = `${task}:${hashString(String(o.prompt.prompt))}`;
  const band = Number(assessed.assessment.overallBand) || 0;
  const mock = !!o.mockAttemptId;

  const facts = {
    studentId: o.studentId,
    module: mock ? "MOCK_WRITING" : "WRITING",
    timeSpent: o.timeSpent,
    essay: { genuine, onTopic },
  };
  const verdict = await assessSubmission(facts);

  const xp = computeWritingXp({
    task,
    words: words.length,
    band,
    genuine,
    onTopic,
    coherence: Number(assessed.assessment.coherenceCohesion) || null,
    multiplier: mock ? XP_CONFIG.mock.sectionMultiplier : undefined,
    history: await loadXpHistory(o.studentId, "WRITING", contentKey),
  });

  const unique = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z']/g, "")).filter(Boolean)).size;
  const tagCounts = new Map<string, number>();
  for (const issue of assessed.issues) {
    const type = String(issue?.type ?? "").toLowerCase();
    const key = Object.keys(ISSUE_TAG).find((k) => type.includes(k));
    if (key) tagCounts.set(ISSUE_TAG[key], (tagCounts.get(ISSUE_TAG[key]) ?? 0) + 1);
  }

  const saved = await saveIELTSTest(
    o.studentId,
    "WRITING",
    band,
    {
      essay: essay.slice(0, 20000),
      prompt: o.prompt.prompt,
      promptId: o.prompt.id,
      promptTitle: o.prompt.title,
      taskType: task,
      testId: contentKey,
      format: "exam-v2",
      ...(o.examAttemptId ? { examAttemptId: o.examAttemptId } : {}),
      ...(mock ? { mock: true, mockAttemptId: o.mockAttemptId } : {}),
      ...(o.auto ? { auto: true } : {}),
    },
    { ...assessed.assessment, issues: assessed.issues, wordCount: words.length, ...(mock ? { type: "mock" } : {}) },
    o.timeSpent,
    {
      contentKey,
      idempotencyKey: o.idempotencyKey,
      xp,
      skipSettle: o.skipSettle,
      logDetails: { words: words.length, task, ...(mock ? { mock: true } : {}) },
      dna: {
        channel: "writing",
        words: words.length,
        diversity: words.length > 0 ? unique / words.length : undefined,
        errorTags: Array.from(tagCounts.entries())
          .filter(([, n]) => n >= 2)
          .map(([tag]) => tag),
      },
    }
  );
  if (!saved.duplicate) await logAssessment(facts, verdict, saved.pointsAwarded ?? 0);

  return {
    task,
    testId: saved.id,
    duplicate: saved.duplicate,
    band,
    words: words.length,
    xpAwarded: saved.pointsAwarded ?? 0,
    xpNotes: xp.notes,
  };
}

export interface WritingExamOutcome {
  task1: WritingTaskOutcome;
  task2: WritingTaskOutcome;
  /** Writing band: Task 2 counts twice as much as Task 1. */
  band: number;
}

/**
 * Both Writing tasks of one sitting. Each task is saved as its own WRITING
 * test (the existing result page shows each one in full); the essays are
 * assessed in parallel so the request stays well inside the time limit.
 */
export async function submitWritingExam(o: {
  studentId: string;
  userId: string;
  task1: WritingPrompt;
  task2: WritingPrompt;
  essays: { task1: unknown; task2: unknown };
  timeSpent: unknown;
  idempotencyKey?: string;
  mockAttemptId?: string;
  auto?: boolean;
}): Promise<WritingExamOutcome> {
  const key = (t: "W1" | "W2") => (o.idempotencyKey ? `${o.idempotencyKey}:${t}` : undefined);
  const [prev1, prev2] = await Promise.all([
    key("W1") ? findSubmittedTest(o.studentId, key("W1")) : null,
    key("W2") ? findSubmittedTest(o.studentId, key("W2")) : null,
  ]);
  const essay1 = typeof o.essays.task1 === "string" ? o.essays.task1.slice(0, 20000) : "";
  const essay2 = typeof o.essays.task2 === "string" ? o.essays.task2.slice(0, 20000) : "";
  const total = clampTime(o.timeSpent);
  const allowAi = guardAi(o.userId, "writing-exam").ok;

  const [a1, a2] = await Promise.all([
    prev1 ? null : assessWritingEssay("task1", o.task1, essay1, allowAi),
    prev2 ? null : assessWritingEssay("task2", o.task2, essay2, allowAi),
  ]);

  const r1 = prev1
    ? await writingOutcomeFromRow(o.studentId, "task1", prev1)
    : await saveWritingTask({
        studentId: o.studentId,
        task: "task1",
        prompt: o.task1,
        essay: essay1,
        assessed: a1 as WritingAssessed,
        timeSpent: Math.round(total / 3),
        idempotencyKey: key("W1"),
        mockAttemptId: o.mockAttemptId,
        examAttemptId: o.idempotencyKey,
        auto: o.auto,
        skipSettle: true,
      });
  const r2 = prev2
    ? await writingOutcomeFromRow(o.studentId, "task2", prev2)
    : await saveWritingTask({
        studentId: o.studentId,
        task: "task2",
        prompt: o.task2,
        essay: essay2,
        assessed: a2 as WritingAssessed,
        timeSpent: total - Math.round(total / 3),
        idempotencyKey: key("W2"),
        mockAttemptId: o.mockAttemptId,
        examAttemptId: o.idempotencyKey,
        auto: o.auto,
      });

  return { task1: r1, task2: r2, band: writingBand(r1.band, r2.band) };
}

/** A Writing prompt as sent to the browser in exam conditions (no model answer or tips). */
export function examPrompt(p: WritingPrompt): WritingPrompt {
  return { ...p, sampleAnswer: "", usefulPhrases: [], strategyEn: "", strategyUz: "" };
}
