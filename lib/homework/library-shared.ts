/**
 * Exam homework — the client-safe half: labels, links, the test-library payload
 * the teacher's picker receives, and the small derivations (scope options,
 * minutes, suggested titles) shared by the picker, the create route and the
 * student / teacher pages.
 *
 * Pure: no database, no server imports (`import type` only), so it is safe in
 * "use client" components, server components, API routes and offline checks.
 */

import type { ExamDifficulty, ExamSource, ExamTestSummary, GroupKind } from "../ielts/types";

/**
 * Same union as ExamHomeworkKind in ./exam-homework (declared here so this
 * module stays dependency-free; lib/homework/library.ts asserts the two match).
 */
export type ExamHomeworkKind = "READING" | "LISTENING" | "WRITING_TASK1" | "WRITING_TASK2" | "WRITING_EXAM" | "SPEAKING";

/** Every exam-homework kind, in picker order (mirrors EXAM_HOMEWORK_KINDS). */
export const LIBRARY_KINDS: readonly ExamHomeworkKind[] = [
  "READING",
  "LISTENING",
  "WRITING_TASK1",
  "WRITING_TASK2",
  "WRITING_EXAM",
  "SPEAKING",
];

/** Client-safe twin of isExamHomeworkKind (exam-homework.ts is server-only). */
export function isLibraryKind(x: unknown): x is ExamHomeworkKind {
  return typeof x === "string" && (LIBRARY_KINDS as readonly string[]).includes(x);
}

export type HomeworkSkill = "READING" | "LISTENING" | "WRITING" | "SPEAKING";

export interface ExamKindInfo {
  /** Short label for badges: "Reading", "Writing Task 2", "Full Writing test". */
  label: string;
  skill: HomeworkSkill;
  /** One line for the kind picker. */
  blurb: string;
  /** "auto" = marked by the key; "review" = AI estimate, then the teacher's review. */
  graded: "auto" | "review";
}

export const EXAM_KIND_INFO: Record<ExamHomeworkKind, ExamKindInfo> = {
  READING: { label: "Reading", skill: "READING", blurb: "A full paper or one passage · marked automatically", graded: "auto" },
  LISTENING: { label: "Listening", skill: "LISTENING", blurb: "A full test or one part · marked automatically", graded: "auto" },
  WRITING_TASK1: { label: "Writing Task 1", skill: "WRITING", blurb: "One chart / diagram report · 150 words · 20 min", graded: "review" },
  WRITING_TASK2: { label: "Writing Task 2", skill: "WRITING", blurb: "One essay · 250 words · 40 min", graded: "review" },
  WRITING_EXAM: { label: "Full Writing test", skill: "WRITING", blurb: "Task 1 + Task 2 in 60 minutes", graded: "review" },
  SPEAKING: { label: "Speaking test", skill: "SPEAKING", blurb: "Parts 1–3 · 11–14 min · recorded answers", graded: "review" },
};

/** Real-exam timings used by the runners. */
export const WRITING_TASK = {
  task1: { words: 150, minutes: 20 },
  task2: { words: 250, minutes: 40 },
  examMinutes: 60,
} as const;
export const READING_PASSAGE_MINUTES = 20;
export const SPEAKING_MINUTES = "11–14";

/** "Full test" / "Passage 2" / "Part 3" for Reading / Listening; null for the other kinds. */
export function examScopeLabel(kind: string | null | undefined, part: number | null | undefined): string | null {
  if (kind === "READING") return part == null ? "Full test" : `Passage ${part + 1}`;
  if (kind === "LISTENING") return part == null ? "Full test" : `Part ${part + 1}`;
  return null;
}

/** "Reading · Passage 2", "Writing Task 2", "Speaking test" — or null for classic homework. */
export function examHomeworkLabel(h: { contentKind?: string | null; contentPart?: number | null }): string | null {
  if (!isLibraryKind(h.contentKind)) return null;
  const scope = examScopeLabel(h.contentKind, h.contentPart ?? null);
  return [EXAM_KIND_INFO[h.contentKind].label, scope].filter(Boolean).join(" · ");
}

/** The student's result page for an attempt (teachers of the student's group may open it too). */
export function examResultHref(kind: ExamHomeworkKind, testId: string): string {
  const id = encodeURIComponent(testId);
  switch (EXAM_KIND_INFO[kind].skill) {
    case "READING":
      return `/learning/reading/result/${id}`;
    case "LISTENING":
      return `/learning/listening/result/${id}`;
    case "WRITING":
      return `/learning/writing/result/${id}`;
    case "SPEAKING":
      return `/learning/speaking-test/result/${id}`;
  }
}

/** The content in the normal practice runner, without the homework link (a teacher's preview). */
export function examPreviewHref(h: { contentKind: string | null; contentId: string | null; contentPart: number | null }): string | null {
  if (!isLibraryKind(h.contentKind) || !h.contentId) return null;
  const id = encodeURIComponent(h.contentId);
  switch (h.contentKind) {
    case "READING":
    case "LISTENING": {
      const base = `/learning/${h.contentKind === "READING" ? "reading" : "listening"}/${id}`;
      return h.contentPart != null ? `${base}?part=${h.contentPart}` : base;
    }
    case "WRITING_TASK1":
      return `/learning/writing/task1?p=${id}`;
    case "WRITING_TASK2":
      return `/learning/writing/task2?p=${id}`;
    case "WRITING_EXAM": {
      const [t1, t2] = h.contentId.split("|");
      return t1 && t2 ? `/learning/writing/exam?t1=${encodeURIComponent(t1)}&t2=${encodeURIComponent(t2)}` : null;
    }
    case "SPEAKING":
      return `/learning/speaking-test/${id}`;
  }
}

/** The teacher's review screen for a Writing / Speaking attempt. */
export function examReviewHref(testId: string): string {
  return `/teacher/reviews/${encodeURIComponent(testId)}`;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
/** Averna runs on Asia/Tashkent: UTC+5 all year (no daylight saving). */
const TASHKENT_OFFSET_MS = 5 * HOUR_MS;
const tashkentDay = (t: number) => Math.floor((t + TASHKENT_OFFSET_MS) / DAY_MS);

/**
 * Due-date state shown to students and teachers, in Tashkent calendar days:
 * due 23:59 tomorrow is "Due tomorrow", whatever the time is now.
 */
export function dueState(due: Date | string, now: Date = new Date()): { overdue: boolean; label: string; urgent: boolean } {
  const dueMs = new Date(due).getTime();
  const nowMs = now.getTime();
  const ms = dueMs - nowMs;
  const days = tashkentDay(dueMs) - tashkentDay(nowMs);
  if (ms < 0) {
    const late = -days;
    return { overdue: true, urgent: true, label: late >= 1 ? `Overdue · ${late} day${late === 1 ? "" : "s"}` : "Overdue" };
  }
  if (days <= 0) {
    const hours = Math.ceil(ms / HOUR_MS);
    return { overdue: false, urgent: true, label: hours <= 1 ? "Due within the hour" : hours <= 12 ? `Due in ${hours} hours` : "Due today" };
  }
  if (days === 1) return { overdue: false, urgent: true, label: "Due tomorrow" };
  if (days === 2) return { overdue: false, urgent: true, label: "Due in 2 days" };
  return { overdue: false, urgent: false, label: `Due in ${days} days` };
}

/**
 * A retried Writing submission may only complete homework when the attempt it
 * points at is that homework's own essay (saved with answers.homeworkId and
 * answers.promptId) — never another skill's or another prompt's attempt.
 */
export function isHomeworkRetryOf(
  previous: { module?: unknown; answers?: unknown } | null | undefined,
  homeworkId: string,
  promptId: string
): boolean {
  if (!previous || previous.module !== "WRITING") return false;
  const a = previous.answers;
  if (!a || typeof a !== "object" || Array.isArray(a)) return false;
  const rec = a as Record<string, unknown>;
  return rec.homeworkId === homeworkId && rec.promptId === promptId;
}

// ---------------------------------------------------------------------------
// Library payload (GET /api/teacher/homework/library) — summaries, no answers.
// ---------------------------------------------------------------------------

export interface LibraryPart {
  title: string;
  from: number;
  to: number;
  questions: number;
  minutes: number;
}

/** A Reading or Listening paper. */
export interface LibraryObjective {
  id: string;
  title: string;
  description: string;
  difficulty: ExamDifficulty;
  questions: number;
  /** Whole paper (Reading: time limit; Listening: estimated audio + checking time). */
  minutes: number;
  full: boolean;
  source: ExamSource;
  kinds: GroupKind[];
  topics: string[];
  parts: LibraryPart[];
}

export interface LibraryWriting {
  id: string;
  title: string;
  /** "Bar Chart", "Opinion essay" … */
  type: string;
  /** The start of the task wording. */
  excerpt: string;
  /** Task 1 renders a chart / image with the prompt. */
  visual: boolean;
}

export interface LibrarySpeaking {
  id: string;
  title: string;
  topics: string[];
  cue: string;
  source: ExamSource;
}

export interface HomeworkLibrary {
  reading: LibraryObjective[];
  listening: LibraryObjective[];
  task1: LibraryWriting[];
  task2: LibraryWriting[];
  speaking: LibrarySpeaking[];
}

function partMinutes(s: Pick<ExamTestSummary, "skill" | "timeLimit" | "parts">): number {
  if (s.skill === "READING") return READING_PASSAGE_MINUTES;
  // Listening: whole = Σ parts + 2 min checking; one part carries ~1 min of its own.
  const parts = Math.max(1, s.parts);
  return Math.max(1, Math.round((s.timeLimit - 2) / parts + 1));
}

export function toLibraryObjective(s: ExamTestSummary): LibraryObjective {
  const minutes = partMinutes(s);
  return {
    id: s.id,
    title: s.title,
    description: (s.description || "").slice(0, 240),
    difficulty: s.difficulty,
    questions: s.questions,
    minutes: s.timeLimit,
    full: s.full,
    source: s.source,
    kinds: s.kinds,
    topics: (s.topics ?? []).slice(0, 6),
    parts: s.partInfo.map((p) => ({
      title: p.title,
      from: p.from,
      to: p.to,
      questions: p.to > 0 ? p.to - p.from + 1 : 0,
      minutes,
    })),
  };
}

export interface ScopeOption {
  /** 0-based part, or null = the whole paper. */
  part: number | null;
  /** "Full test" / "Passage 2" / "Part 3". */
  label: string;
  /** The passage title (Reading) or a custom part title (Listening). */
  title: string | null;
  questions: number;
  minutes: number;
  /** "Questions 14–26" when known. */
  range: string | null;
}

/** Whole paper first, then each passage / part (only when there is more than one). */
export function scopeOptions(kind: "READING" | "LISTENING", item: LibraryObjective): ScopeOption[] {
  const known = item.parts.filter((p) => p.to > 0);
  const from = known.length ? Math.min(...known.map((p) => p.from)) : 0;
  const to = known.length ? Math.max(...known.map((p) => p.to)) : 0;
  const whole: ScopeOption = {
    part: null,
    label: "Full test",
    title: null,
    questions: item.questions,
    minutes: item.minutes,
    range: to > 0 ? `Questions ${from}–${to}` : null,
  };
  if (item.parts.length <= 1) return [whole];
  return [
    whole,
    ...item.parts.map((p, i): ScopeOption => {
      const custom = p.title && !/^part\s*\d+$/i.test(p.title.trim()) ? p.title.trim() : null;
      return {
        part: i,
        label: kind === "READING" ? `Passage ${i + 1}` : `Part ${i + 1}`,
        title: custom,
        questions: p.questions,
        minutes: p.minutes,
        range: p.to > 0 ? (p.from === p.to ? `Question ${p.from}` : `Questions ${p.from}–${p.to}`) : null,
      };
    }),
  ];
}

/** "13 questions · 20 min" (Listening minutes are estimates: "~8 min"). */
export function scopeFacts(kind: "READING" | "LISTENING", o: Pick<ScopeOption, "questions" | "minutes">): string {
  const q = `${o.questions} question${o.questions === 1 ? "" : "s"}`;
  return `${q} · ${kind === "LISTENING" ? "~" : ""}${o.minutes} min`;
}

/** Homework.difficulty (1–5) suggested for a paper's difficulty. */
export function suggestedDifficulty(d: ExamDifficulty | null | undefined): number {
  return d === "Easy" ? 2 : d === "Hard" ? 4 : 3;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Suggested homework title for a selection (the teacher can edit it). */
export function suggestedTitle(kind: ExamHomeworkKind, content: { title: string; scope?: string | null; second?: string | null }): string {
  const t = content.title.trim();
  switch (kind) {
    case "READING":
    case "LISTENING": {
      const scope = content.scope && content.scope !== "Full test" ? ` (${content.scope})` : "";
      return clip(`${EXAM_KIND_INFO[kind].label}: ${t}${scope}`, 200);
    }
    case "WRITING_EXAM":
      return clip(`Writing test: ${t}${content.second ? ` + ${content.second.trim()}` : ""}`, 200);
    default:
      return clip(`${EXAM_KIND_INFO[kind].label}: ${t}`, 200);
  }
}

/** Lower-case search text; every whitespace-separated token of a query must appear. */
export function matchesQuery(haystack: string, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.every((t) => haystack.includes(t));
}
