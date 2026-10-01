/**
 * Exam homework — the server half of the test-library integration:
 *  - buildHomeworkLibrary(): catalog summaries for the teacher's picker (no
 *    passages, scripts, answer keys or model answers);
 *  - resolveExamContent(): validates a picked kind / content id / part against
 *    the catalog and returns exactly what the Homework row stores;
 *  - describeExamHomework(): what a homework contains (question counts,
 *    minutes) for the student and teacher pages.
 *
 * SERVER ONLY (the catalog reads the database).
 */

import {
  findArchivedListening,
  findArchivedReading,
  findArchivedWritingTask,
  getListeningExam,
  getReadingExam,
  getSpeakingSet,
  getWritingTask,
  isArchivedContent,
  listListeningExams,
  listReadingExams,
  listSpeakingSets,
  listWritingTasks,
  type SpeakingSetSummary,
} from "@/lib/ielts/catalog";
import { summarizeListening, summarizeReading } from "@/lib/ielts/format";
import type { ExamListeningTest, ExamReadingTest, ExamTestSummary, SpeakingExamSet } from "@/lib/ielts/types";
import type { WritingPrompt } from "@/lib/writing-data";
import {
  MODULE_FOR_KIND,
  isExamHomeworkKind,
  splitWritingExamContentId,
  writingExamContentId,
  type ExamHomeworkKind,
} from "./exam-homework";
import {
  EXAM_KIND_INFO,
  READING_PASSAGE_MINUTES,
  SPEAKING_MINUTES,
  WRITING_TASK,
  examHomeworkLabel,
  suggestedDifficulty,
  suggestedTitle,
  toLibraryObjective,
  type ExamHomeworkKind as SharedKind,
  type HomeworkLibrary,
  type LibraryWriting,
} from "./library-shared";
import { writingHomeworkRule } from "./exam-attempt";

// library-shared.ts re-declares the kind union to stay dependency-free: keep the two identical.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const KINDS_MATCH: Same<SharedKind, ExamHomeworkKind> = true;
void KINDS_MATCH;

// ---------------------------------------------------------------------------
// Picker payload
// ---------------------------------------------------------------------------

function excerptOf(prompt: string): string {
  const text = String(prompt || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !/^write at least/i.test(p) && !/^summari[sz]e the information/i.test(p))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 220 ? `${text.slice(0, 219).trimEnd()}…` : text;
}

function writingItem(p: WritingPrompt): LibraryWriting {
  return {
    id: p.id,
    title: p.title,
    type: p.type,
    excerpt: excerptOf(p.prompt),
    visual: !!(p.chart?.length || p.imageUrl),
  };
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}

/** Everything a teacher can assign, as summaries (cached catalog lists). */
export async function buildHomeworkLibrary(): Promise<HomeworkLibrary> {
  const [reading, listening, task1, task2, speaking]: [
    ExamTestSummary[],
    ExamTestSummary[],
    WritingPrompt[],
    WritingPrompt[],
    SpeakingSetSummary[],
  ] = await Promise.all([
    listReadingExams(),
    listListeningExams(),
    listWritingTasks("task1"),
    listWritingTasks("task2"),
    listSpeakingSets(),
  ]);
  return {
    reading: uniqueById(reading).map(toLibraryObjective),
    listening: uniqueById(listening).map(toLibraryObjective),
    task1: uniqueById(task1).map(writingItem),
    task2: uniqueById(task2).map(writingItem),
    speaking: uniqueById(speaking).map((s) => ({
      id: s.id,
      title: s.title,
      topics: s.topics.slice(0, 4),
      cue: s.cue.length > 200 ? `${s.cue.slice(0, 199).trimEnd()}…` : s.cue,
      source: s.source,
    })),
  };
}

// ---------------------------------------------------------------------------
// Validation (create route)
// ---------------------------------------------------------------------------

export interface ResolvedExamContent {
  kind: ExamHomeworkKind;
  contentId: string;
  /** 0-based passage / part; null = the whole paper (and always for other kinds). */
  contentPart: number | null;
  contentTitle: string;
  module: (typeof MODULE_FOR_KIND)[ExamHomeworkKind];
  /** Suggested homework title when the teacher leaves it empty. */
  title: string;
  /** Default instructions for students when the teacher writes none. */
  description: string;
  /** Suggested Homework.difficulty (1–5), from the paper where it has one. */
  difficulty: number | null;
}

export type ResolveResult = { ok: true; content: ResolvedExamContent } | { ok: false; error: string };

const ID_MAX = 200;

function cleanId(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const s = x.trim();
  return s && s.length <= ID_MAX ? s : null;
}

function cleanPart(x: unknown): number | null | "invalid" {
  if (x == null || x === "") return null;
  const n = typeof x === "number" ? x : Number(x);
  return Number.isInteger(n) && n >= 0 && n < 20 ? n : "invalid";
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * Check a picked item against the library. Only content a student can
 * actually open is accepted, and a passage / part only on multi-part papers
 * (the practice pages treat a single-part paper as the whole test).
 */
export async function resolveExamContent(raw: {
  contentKind?: unknown;
  contentId?: unknown;
  contentPart?: unknown;
  task1Id?: unknown;
  task2Id?: unknown;
}): Promise<ResolveResult> {
  const kind = raw.contentKind;
  if (!isExamHomeworkKind(kind)) return { ok: false, error: "Choose what kind of test to set." };
  const skillModule = MODULE_FOR_KIND[kind];
  const part = cleanPart(raw.contentPart);
  if (part === "invalid") return { ok: false, error: "That passage / part doesn't exist." };

  if (kind === "READING" || kind === "LISTENING") {
    const id = cleanId(raw.contentId);
    if (!id) return { ok: false, error: "Choose a test from the library." };
    // Archived built-in tests still open by id (old homework) but can't be set again.
    if (isArchivedContent(id)) return { ok: false, error: `That ${kind === "READING" ? "Reading" : "Listening"} test is no longer in the library.` };
    // Counts and minutes come from the same summary the picker shows, so both always agree.
    const loaded =
      kind === "READING"
        ? await getReadingExam(id).then((t: ExamReadingTest | null) => t && { test: t, summary: summarizeReading(t) })
        : await getListeningExam(id).then((t: ExamListeningTest | null) => t && { test: t, summary: summarizeListening(t) });
    if (!loaded) return { ok: false, error: `That ${kind === "READING" ? "Reading" : "Listening"} test is no longer in the library.` };
    const { test } = loaded;
    const lib = toLibraryObjective(loaded.summary);
    let p: number | null = part;
    if (p != null && test.parts.length <= 1) p = null;
    if (p != null && p >= test.parts.length) return { ok: false, error: "That passage / part doesn't exist in this test." };

    const noun = kind === "READING" ? "Passage" : "Part";
    const partTitle = p == null ? null : test.parts[p].title?.trim() || null;
    const customPart = partTitle && !/^part\s*\d+$/i.test(partTitle) ? partTitle : null;
    const scope = p == null ? "Full test" : `${noun} ${p + 1}`;
    const questions = p == null ? lib.questions : lib.parts[p]?.questions ?? 0;
    const minutes = p == null ? lib.minutes : lib.parts[p]?.minutes ?? READING_PASSAGE_MINUTES;
    const contentTitle = p == null ? test.title : `${test.title} · ${scope}${customPart ? `: ${customPart}` : ""}`;
    const what = p == null ? `“${test.title}” — the full test` : `${scope}${customPart ? ` (“${customPart}”)` : ""} of “${test.title}”`;
    return {
      ok: true,
      content: {
        kind,
        contentId: test.id,
        contentPart: p,
        contentTitle: contentTitle.slice(0, 300),
        module: skillModule,
        title: suggestedTitle(kind, { title: test.title, scope }),
        description:
          `${EXAM_KIND_INFO[kind].label} homework: ${what}. ${plural(questions, "question")}, ${kind === "LISTENING" ? "about " : ""}${plural(minutes, "minute")}. ` +
          "Take it in exam conditions — it is marked as soon as you submit, and your first attempt that answers at least half of the questions counts.",
        difficulty: suggestedDifficulty(test.difficulty),
      },
    };
  }

  if (part != null) return { ok: false, error: "Only Reading and Listening homework can be a single passage / part." };

  if (kind === "WRITING_TASK1" || kind === "WRITING_TASK2") {
    const id = cleanId(raw.contentId);
    if (!id) return { ok: false, error: "Choose a Writing task from the library." };
    const task = kind === "WRITING_TASK1" ? "task1" : "task2";
    const prompt: WritingPrompt | null = isArchivedContent(id) ? null : await getWritingTask(task, id);
    if (!prompt) return { ok: false, error: "That Writing task is no longer in the library." };
    const spec = WRITING_TASK[task];
    return {
      ok: true,
      content: {
        kind,
        contentId: prompt.id,
        contentPart: null,
        contentTitle: prompt.title.slice(0, 300),
        module: skillModule,
        title: suggestedTitle(kind, { title: prompt.title }),
        description:
          `${EXAM_KIND_INFO[kind].label}: “${prompt.title}”. Write at least ${spec.words} words in ${spec.minutes} minutes. ` +
          `You get an AI band estimate as soon as you submit; your teacher then reviews it. ${writingHomeworkRule(kind)}`,
        difficulty: null,
      },
    };
  }

  if (kind === "WRITING_EXAM") {
    const t1Id = cleanId(raw.task1Id);
    const t2Id = cleanId(raw.task2Id);
    const pair =
      t1Id && t2Id
        ? { task1: t1Id, task2: t2Id }
        : typeof raw.contentId === "string" && raw.contentId.length <= ID_MAX * 2 + 1
          ? splitWritingExamContentId(raw.contentId)
          : null;
    if (!pair) return { ok: false, error: "Choose a Task 1 and a Task 2 for the Writing test." };
    if (isArchivedContent(pair.task1) || isArchivedContent(pair.task2)) {
      return { ok: false, error: "One of those Writing tasks is no longer in the library." };
    }
    const [t1, t2]: (WritingPrompt | null)[] = await Promise.all([getWritingTask("task1", pair.task1), getWritingTask("task2", pair.task2)]);
    if (!t1 || !t2) return { ok: false, error: "One of those Writing tasks is no longer in the library." };
    return {
      ok: true,
      content: {
        kind,
        contentId: writingExamContentId(t1.id, t2.id),
        contentPart: null,
        contentTitle: `${t1.title} + ${t2.title}`.slice(0, 300),
        module: skillModule,
        title: suggestedTitle(kind, { title: t1.title, second: t2.title }),
        description:
          `Full Writing test in ${WRITING_TASK.examMinutes} minutes: Task 1 “${t1.title}” (at least ${WRITING_TASK.task1.words} words) ` +
          `and Task 2 “${t2.title}” (at least ${WRITING_TASK.task2.words} words). ` +
          `You get an AI band estimate as soon as you submit; your teacher then reviews it. ${writingHomeworkRule(kind)}`,
        difficulty: null,
      },
    };
  }

  // SPEAKING
  const id = cleanId(raw.contentId);
  if (!id) return { ok: false, error: "Choose a Speaking set from the library." };
  const set: SpeakingExamSet | null = await getSpeakingSet(id);
  if (!set) return { ok: false, error: "That Speaking set is no longer in the library." };
  return {
    ok: true,
    content: {
      kind,
      contentId: set.id,
      contentPart: null,
      contentTitle: set.title.slice(0, 300),
      module: skillModule,
      title: suggestedTitle(kind, { title: set.title }),
      description:
        `Speaking test “${set.title}”: Parts 1–3, about ${SPEAKING_MINUTES} minutes. Find a quiet place and record your answers. ` +
        "You get an AI band estimate as soon as you submit; your teacher then reviews it. Your first real attempt counts — a blank or very short one doesn't.",
      difficulty: null,
    },
  };
}

// ---------------------------------------------------------------------------
// Description (student / teacher pages)
// ---------------------------------------------------------------------------

export interface ExamHomeworkInfo {
  kind: ExamHomeworkKind;
  /** "Reading · Passage 2", "Writing Task 2" … */
  label: string;
  /** What the content is (the paper / prompt / set title). */
  contentTitle: string;
  /** "13 questions", "20 min", "Medium" … */
  facts: string[];
  graded: "auto" | "review";
  /** The content is still in the library (the Start link works). */
  available: boolean;
}

function objectiveFacts(kind: "READING" | "LISTENING", s: ExamTestSummary, part: number | null): string[] {
  const lib = toLibraryObjective(s);
  if (part == null || lib.parts.length <= 1) {
    return [
      ...(kind === "LISTENING" ? [plural(lib.parts.length || 1, "part")] : []),
      plural(lib.questions, "question"),
      `${kind === "LISTENING" ? "~" : ""}${lib.minutes} min`,
      s.difficulty,
    ];
  }
  const p = lib.parts[part];
  if (!p) return [s.difficulty];
  return [plural(p.questions, "question"), `${kind === "LISTENING" ? "~" : ""}${p.minutes} min`, s.difficulty];
}

function archivedSummary(kind: "READING" | "LISTENING", id: string): ExamTestSummary | null {
  if (kind === "READING") {
    const t = findArchivedReading(id);
    return t ? summarizeReading(t) : null;
  }
  const t = findArchivedListening(id);
  return t ? summarizeListening(t) : null;
}

/** What an exam homework contains, or null for classic homework. Never throws. */
export async function describeExamHomework(h: {
  contentKind: string | null;
  contentId: string | null;
  contentPart: number | null;
  contentTitle?: string | null;
}): Promise<ExamHomeworkInfo | null> {
  const kind = h.contentKind;
  if (!isExamHomeworkKind(kind) || !h.contentId) return null;
  const contentId = h.contentId;
  const base = {
    kind,
    label: examHomeworkLabel(h) ?? EXAM_KIND_INFO[kind].label,
    graded: EXAM_KIND_INFO[kind].graded,
  };
  const stored = (h.contentTitle || "").trim();
  try {
    switch (kind) {
      case "READING":
      case "LISTENING": {
        const list: ExamTestSummary[] = kind === "READING" ? await listReadingExams() : await listListeningExams();
        // Archived built-in tests aren't listed any more but still open by id, so old homework keeps working.
        const s = list.find((x) => x.id === contentId) ?? archivedSummary(kind, contentId);
        if (!s) return { ...base, contentTitle: stored || "Test no longer available", facts: [], available: false };
        return { ...base, contentTitle: stored || s.title, facts: objectiveFacts(kind, s, h.contentPart), available: true };
      }
      case "WRITING_TASK1":
      case "WRITING_TASK2": {
        const task = kind === "WRITING_TASK1" ? "task1" : "task2";
        const p =
          ((await listWritingTasks(task)) as WritingPrompt[]).find((x) => x.id === contentId) ?? findArchivedWritingTask(task, contentId);
        const spec = WRITING_TASK[task];
        return {
          ...base,
          contentTitle: stored || p?.title || "Task no longer available",
          facts: p ? [p.type, `${spec.words}+ words`, `${spec.minutes} min`].filter(Boolean) : [],
          available: !!p,
        };
      }
      case "WRITING_EXAM": {
        const pair = splitWritingExamContentId(contentId);
        const [all1, all2]: WritingPrompt[][] = pair
          ? await Promise.all([listWritingTasks("task1"), listWritingTasks("task2")])
          : [[], []];
        const t1 = pair ? all1.find((x) => x.id === pair.task1) ?? findArchivedWritingTask("task1", pair.task1) : undefined;
        const t2 = pair ? all2.find((x) => x.id === pair.task2) ?? findArchivedWritingTask("task2", pair.task2) : undefined;
        const available = !!(t1 && t2);
        return {
          ...base,
          contentTitle: stored || (available ? `${t1?.title} + ${t2?.title}` : "Tasks no longer available"),
          facts: available ? ["Task 1 + Task 2", `${WRITING_TASK.examMinutes} min`] : [],
          available,
        };
      }
      case "SPEAKING": {
        const s = ((await listSpeakingSets()) as SpeakingSetSummary[]).find((x) => x.id === contentId);
        return {
          ...base,
          contentTitle: stored || s?.title || "Set no longer available",
          facts: s ? ["Parts 1–3", `${SPEAKING_MINUTES} min`] : [],
          available: !!s,
        };
      }
    }
  } catch {
    return { ...base, contentTitle: stored || EXAM_KIND_INFO[kind].label, facts: [], available: true };
  }
}
