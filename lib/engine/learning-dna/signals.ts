import { db } from "@/lib/db";
import { getSkillStages, getMemoryTimeline, type SkillStageInfo, type MemoryEntry } from "@/lib/student-intel";
import {
  ANALYSIS_WINDOW_DAYS,
  DAY_MS,
  MAX_EVENTS,
  MAX_ROWS,
  SKILL_CHANNEL,
  TZ_OFFSET_MS,
} from "./config";
import type { Channel, DnaEvent, EventKind, SkillKey } from "./types";

/**
 * Learning DNA Engine — the data collection layer.
 *
 * This module answers one question: "everything we know about how this person
 * behaved, in one comparable shape." It is the only file in the engine that
 * touches the database, which keeps all of the statistics downstream pure and
 * testable.
 *
 * Two sources are merged into a single event stream:
 *
 *  1. THE SENSOR STREAM (`LearningEvent`) — rich, deliberate observations
 *     recorded at the moment learning happened.
 *  2. DERIVED HISTORY — the same shape reconstructed from the outcome rows the
 *     platform has always written (IELTSTest, ActivityLog, HomeworkSubmission,
 *     SpeakingSession, ReviewItem).
 *
 * Deriving history is what makes the engine useful on the day it ships instead
 * of six weeks later: an existing student's timing, focus and skill profile can
 * be computed from data already on disk. As the sensor stream fills in, it takes
 * over — per kind, so a partially-wired sensor never loses a signal family.
 *
 * Every read is individually fault-tolerant. A missing table (a migration not
 * yet applied in one environment) degrades one signal family to empty; it never
 * fails a page load or a learning action.
 */

// ---------------------------------------------------------------------------
// Time — Tashkent (UTC+5, no DST)
// ---------------------------------------------------------------------------

export interface TashkentParts {
  hour: number;
  weekday: number;
  dayKey: string;
}

/**
 * Local time parts for an instant, without constructing an Intl formatter.
 *
 * Averna runs in a single fixed-offset timezone, so shifting the epoch and
 * reading UTC fields is exact — and fast enough to run over thousands of rows
 * per request, which an `Intl.DateTimeFormat` per row is not.
 */
export function tashkentParts(date: Date | number): TashkentParts {
  const t = typeof date === "number" ? date : date.getTime();
  const shifted = new Date(t + TZ_OFFSET_MS);
  return {
    hour: shifted.getUTCHours(),
    weekday: shifted.getUTCDay(),
    dayKey: shifted.toISOString().slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Row shapes (kept local so the engine never leaks Prisma types outward)
// ---------------------------------------------------------------------------

export interface TestRow {
  id: string;
  module: string;
  score: number;
  timeSpent: number;
  completedAt: Date;
  answers: unknown;
  aiAnalysis: unknown;
}

export interface ReviewRow {
  itemKey: string;
  source: string;
  ease: number;
  interval: number;
  reps: number;
  lapses: number;
  dueAt: Date;
  lastReviewedAt: Date;
  createdAt: Date;
}

export interface ActivityRow {
  action: string;
  points: number;
  details: unknown;
  createdAt: Date;
}

export interface HomeworkRow {
  status: string;
  pointsAwarded: number;
  submittedAt: Date;
  gradedAt: Date | null;
  dueDate: Date | null;
  module: string | null;
  contentLength: number;
}

export interface SpeakingRow {
  duration: number;
  rating: number | null;
  date: Date;
}

export interface AttendanceRow {
  status: string;
  date: Date;
}

export interface StudentRow {
  id: string;
  currentStreak: number;
  longestStreak: number;
  totalPoints: number;
  lastActiveDate: Date;
  targetBand: string | null;
  level: string | null;
  createdAt: Date;
}

/** Everything the metric layer is allowed to see. */
export interface DnaSignals {
  studentId: string;
  now: number;
  windowDays: number;
  /** Merged, de-duplicated, ascending by time. */
  events: DnaEvent[];
  sensorCount: number;
  tests: TestRow[];
  reviews: ReviewRow[];
  activity: ActivityRow[];
  homework: HomeworkRow[];
  speaking: SpeakingRow[];
  attendance: AttendanceRow[];
  stages: SkillStageInfo[];
  memory: MemoryEntry[];
  achievements: number;
  student: StudentRow | null;
}

// ---------------------------------------------------------------------------
// Safe JSON access
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

/**
 * Normalised 0-1 accuracy for a test attempt.
 *
 * Prefers the real question-level percentage the submit route stored, because a
 * band is a coarse, stepped mapping of accuracy and loses the resolution that
 * time-of-day and fatigue comparisons depend on. Falls back to band/9 for
 * modules that are graded holistically (Writing, Speaking).
 */
export function testAccuracy(aiAnalysis: unknown, score: number): number | null {
  const a = asRecord(aiAnalysis);
  if (a) {
    const pct = num(a.percentage);
    if (pct != null && pct >= 0 && pct <= 100) return pct / 100;
    const correct = num(a.correctCount);
    const total = num(a.totalQuestions);
    if (correct != null && total != null && total > 0) {
      return Math.max(0, Math.min(1, correct / total));
    }
  }
  if (score > 0) return Math.max(0, Math.min(1, score / 9));
  return null;
}

/** Questions answered vs available — the signal behind "ran out of time". */
export function testCompletion(answers: unknown, aiAnalysis: unknown): { answered: number | null; total: number | null } {
  const root = asRecord(answers);
  const inner = root ? asRecord(root.answers) : null;
  const answered = inner ? Object.keys(inner).length : null;
  const analysis = asRecord(aiAnalysis);
  let total = analysis ? num(analysis.totalQuestions) : null;
  if (total == null) {
    const results = root ? asRecord(root.results) : null;
    total = results ? Object.keys(results).length : null;
  }
  return { answered, total };
}

// ---------------------------------------------------------------------------
// Event construction
// ---------------------------------------------------------------------------

function isSkillKey(value: unknown): value is SkillKey {
  return (
    value === "READING" ||
    value === "LISTENING" ||
    value === "WRITING" ||
    value === "SPEAKING" ||
    value === "GRAMMAR" ||
    value === "VOCABULARY"
  );
}

function clamp01(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function makeEvent(input: {
  at: Date;
  kind: EventKind;
  channel: Channel;
  skill?: SkillKey | null;
  accuracy?: number | null;
  durationMin?: number | null;
  items?: number | null;
  correct?: number | null;
  words?: number | null;
  diversity?: number | null;
  confidence?: number | null;
  difficulty?: string | null;
  errorTags?: string[];
  origin: "sensor" | "derived";
}): DnaEvent {
  const parts = tashkentParts(input.at);
  return {
    at: input.at,
    hour: parts.hour,
    weekday: parts.weekday,
    dayKey: parts.dayKey,
    kind: input.kind,
    skill: input.skill ?? null,
    channel: input.channel,
    accuracy: clamp01(input.accuracy),
    // Guard against a client-reported duration that is impossible (or negative):
    // an inflated session length would otherwise distort the whole focus curve.
    durationMin:
      input.durationMin != null && Number.isFinite(input.durationMin)
        ? Math.max(0, Math.min(300, input.durationMin))
        : null,
    items: input.items ?? null,
    correct: input.correct ?? null,
    words: input.words ?? null,
    diversity: clamp01(input.diversity),
    confidence: clamp01(input.confidence),
    difficulty: input.difficulty ?? null,
    errorTags: input.errorTags ?? [],
    origin: input.origin,
  };
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * Await a read, degrading to `fallback` on any failure.
 *
 * The type parameter is always supplied explicitly at the call site so the
 * result is checked against the engine's own row shapes rather than inferred
 * from Prisma's generated types — which keeps the engine compiling if a
 * generated field is widened, and documents exactly what each read must provide.
 */
async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

interface SensorRow {
  kind: string;
  skill: string | null;
  channel: string;
  accuracy: number | null;
  durationMin: number | null;
  items: number | null;
  correct: number | null;
  words: number | null;
  diversity: number | null;
  confidence: number | null;
  difficulty: string | null;
  errorTags: string[];
  origin: string;
  createdAt: Date;
}

interface HomeworkQueryRow {
  status: string;
  pointsAwarded: number;
  submittedAt: Date;
  gradedAt: Date | null;
  content: string;
  homework: { module: string; dueDate: Date } | null;
}

/**
 * Read the sensor stream. Returns [] (not an error) when the table hasn't been
 * migrated yet, so the engine still works on the derived history alone.
 */
async function loadSensorEvents(studentId: string, since: Date): Promise<DnaEvent[]> {
  const rows = await safe<SensorRow[]>(
    db.learningEvent.findMany({
      where: { studentId, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      take: MAX_EVENTS,
      select: {
        kind: true,
        skill: true,
        channel: true,
        accuracy: true,
        durationMin: true,
        items: true,
        correct: true,
        words: true,
        diversity: true,
        confidence: true,
        difficulty: true,
        errorTags: true,
        origin: true,
        createdAt: true,
      },
    }),
    []
  );

  return rows.map((r) =>
    makeEvent({
      at: r.createdAt,
      kind: r.kind as EventKind,
      channel: r.channel as Channel,
      skill: isSkillKey(r.skill) ? r.skill : null,
      accuracy: r.accuracy,
      durationMin: r.durationMin,
      items: r.items,
      correct: r.correct,
      words: r.words,
      diversity: r.diversity,
      confidence: r.confidence,
      difficulty: r.difficulty,
      errorTags: r.errorTags ?? [],
      origin: r.origin === "derived" ? "derived" : "sensor",
    })
  );
}

/**
 * Derive the behavioural stream from outcome rows.
 *
 * `cutoffs` holds, per event kind, the instant the sensor started covering that
 * kind. Anything at or after its cutoff is dropped, because the sensor already
 * recorded it with more detail — this is what keeps a test from being counted
 * twice while a partially-wired sensor still lets homework be reconstructed.
 */
function deriveEvents(
  signals: {
    tests: TestRow[];
    activity: ActivityRow[];
    homework: HomeworkRow[];
    speaking: SpeakingRow[];
  },
  cutoffs: Map<EventKind, number>
): DnaEvent[] {
  const out: DnaEvent[] = [];
  const covered = (kind: EventKind, at: Date) => {
    const cutoff = cutoffs.get(kind);
    return cutoff != null && at.getTime() >= cutoff;
  };

  // --- Tests: the richest historical signal (module, score, duration, timing) ---
  for (const t of signals.tests) {
    if (covered("test", t.completedAt)) continue;
    const skill = isSkillKey(t.module) ? t.module : null;
    const { answered, total } = testCompletion(t.answers, t.aiAnalysis);
    const errorTags: string[] = [];
    // Reconstructable mistake category: a materially incomplete paper is a
    // time-management signal, not a knowledge signal.
    if (answered != null && total != null && total >= 5 && answered / total < 0.9) {
      errorTags.push("time_pressure");
    }
    const analysis = asRecord(t.aiAnalysis);
    out.push(
      makeEvent({
        at: t.completedAt,
        kind: "test",
        channel: skill ? SKILL_CHANNEL[skill] : "reading",
        skill,
        accuracy: testAccuracy(t.aiAnalysis, t.score),
        durationMin: t.timeSpent > 0 ? t.timeSpent / 60 : null,
        items: total,
        correct: analysis ? num(analysis.correctCount) : null,
        words: analysis ? num(analysis.wordCount) : null,
        errorTags,
        origin: "derived",
      })
    );
  }

  // --- Spaced repetition: retention behaviour, from the audit trail ---
  for (const a of signals.activity) {
    if (a.action !== "SRS_REVIEW") continue;
    if (covered("review", a.createdAt)) continue;
    const d = asRecord(a.details);
    const source = d && typeof d.source === "string" ? d.source : "vocab";
    out.push(
      makeEvent({
        at: a.createdAt,
        kind: "review",
        channel: "flashcard",
        skill: source === "mistake" ? "GRAMMAR" : "VOCABULARY",
        items: d ? num(d.count) : null,
        origin: "derived",
      })
    );
  }

  // --- Daily challenges: engagement + retrieval practice ---
  for (const a of signals.activity) {
    if (a.action !== "CHALLENGE_COMPLETED") continue;
    if (covered("game", a.createdAt)) continue;
    out.push(
      makeEvent({ at: a.createdAt, kind: "game", channel: "flashcard", origin: "derived" })
    );
  }

  // --- Homework: sustained, deliberate production ---
  for (const h of signals.homework) {
    if (covered("homework", h.submittedAt)) continue;
    const skill = isSkillKey(h.module) ? h.module : null;
    const errorTags: string[] = [];
    // Submitted after the deadline → a planning signal worth surfacing.
    if (h.dueDate && h.submittedAt.getTime() > h.dueDate.getTime()) errorTags.push("time_pressure");
    out.push(
      makeEvent({
        at: h.submittedAt,
        kind: "homework",
        channel: skill ? SKILL_CHANNEL[skill] : "writing",
        skill,
        // Only a graded submission carries a defensible accuracy.
        accuracy: null,
        words: h.contentLength > 0 ? Math.round(h.contentLength / 5.5) : null,
        errorTags,
        origin: "derived",
      })
    );
  }

  // --- Speaking sessions: duration is real, rating is a teacher's judgement ---
  for (const s of signals.speaking) {
    if (covered("speaking", s.date)) continue;
    out.push(
      makeEvent({
        at: s.date,
        kind: "speaking",
        channel: "speaking",
        skill: "SPEAKING",
        accuracy: s.rating != null ? s.rating / 5 : null,
        durationMin: s.duration > 0 ? s.duration : null,
        origin: "derived",
      })
    );
  }

  return out;
}

/**
 * Gather every behavioural signal for one student.
 *
 * One call, one batch of parallel reads, one merged stream. Callers should treat
 * this as the expensive step and the metric layer as free.
 */
export async function collectSignals(studentId: string): Promise<DnaSignals> {
  const now = Date.now();
  const since = new Date(now - ANALYSIS_WINDOW_DAYS * DAY_MS);

  const [sensorEvents, tests, reviews, activity, homeworkRows, speaking, attendance, achievements, student] =
    await Promise.all([
      loadSensorEvents(studentId, since),
      safe<TestRow[]>(
        db.iELTSTest.findMany({
          where: { studentId, completedAt: { gte: since } },
          orderBy: { completedAt: "asc" },
          take: MAX_ROWS,
          select: {
            id: true,
            module: true,
            score: true,
            timeSpent: true,
            completedAt: true,
            answers: true,
            aiAnalysis: true,
          },
        }),
        []
      ),
      safe<ReviewRow[]>(
        db.reviewItem.findMany({
          where: { studentId },
          take: MAX_ROWS,
          select: {
            itemKey: true,
            source: true,
            ease: true,
            interval: true,
            reps: true,
            lapses: true,
            dueAt: true,
            lastReviewedAt: true,
            createdAt: true,
          },
        }),
        []
      ),
      safe<ActivityRow[]>(
        db.activityLog.findMany({
          where: { studentId, createdAt: { gte: since } },
          orderBy: { createdAt: "asc" },
          take: MAX_EVENTS,
          select: { action: true, points: true, details: true, createdAt: true },
        }),
        []
      ),
      safe<HomeworkQueryRow[]>(
        db.homeworkSubmission.findMany({
          where: { studentId, submittedAt: { gte: since } },
          orderBy: { submittedAt: "asc" },
          take: MAX_ROWS,
          select: {
            status: true,
            pointsAwarded: true,
            submittedAt: true,
            gradedAt: true,
            content: true,
            homework: { select: { module: true, dueDate: true } },
          },
        }),
        []
      ),
      safe<SpeakingRow[]>(
        db.speakingSession.findMany({
          where: { studentId, date: { gte: since } },
          orderBy: { date: "asc" },
          take: MAX_ROWS,
          select: { duration: true, rating: true, date: true },
        }),
        []
      ),
      safe<AttendanceRow[]>(
        db.attendance.findMany({
          where: { studentId, date: { gte: since } },
          orderBy: { date: "asc" },
          take: MAX_ROWS,
          select: { status: true, date: true },
        }),
        []
      ),
      safe<number>(db.studentAchievement.count({ where: { studentId } }), 0),
      safe<StudentRow | null>(
        db.student.findUnique({
          where: { id: studentId },
          select: {
            id: true,
            currentStreak: true,
            longestStreak: true,
            totalPoints: true,
            lastActiveDate: true,
            targetBand: true,
            level: true,
            createdAt: true,
          },
        }),
        null
      ),
    ]);

  // Mastery ladder + forgetting curve are already modelled elsewhere; reusing
  // them keeps every surface in the platform telling the same story about a
  // skill instead of inventing a second, competing definition of mastery.
  const [stages, memory] = await Promise.all([
    safe<SkillStageInfo[]>(getSkillStages(studentId), []),
    safe<MemoryEntry[]>(getMemoryTimeline(studentId), []),
  ]);

  const homework: HomeworkRow[] = homeworkRows.map((h) => ({
    status: h.status,
    pointsAwarded: h.pointsAwarded,
    submittedAt: h.submittedAt,
    gradedAt: h.gradedAt,
    dueDate: h.homework?.dueDate ?? null,
    module: h.homework?.module ?? null,
    contentLength: (h.content ?? "").length,
  }));

  // Per-kind sensor coverage boundary — see deriveEvents.
  const cutoffs = new Map<EventKind, number>();
  for (const e of sensorEvents) {
    if (e.origin !== "sensor") continue;
    const existing = cutoffs.get(e.kind);
    const t = e.at.getTime();
    if (existing == null || t < existing) cutoffs.set(e.kind, t);
  }

  const derived = deriveEvents({ tests, activity, homework, speaking }, cutoffs);
  const events = [...sensorEvents, ...derived].sort((a, b) => a.at.getTime() - b.at.getTime());

  return {
    studentId,
    now,
    windowDays: ANALYSIS_WINDOW_DAYS,
    events,
    sensorCount: sensorEvents.filter((e) => e.origin === "sensor").length,
    tests,
    reviews,
    activity,
    homework,
    speaking,
    attendance,
    stages,
    memory,
    achievements,
    student,
  };
}
