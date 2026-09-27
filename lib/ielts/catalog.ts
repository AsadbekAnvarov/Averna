import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { READING_TESTS } from "@/lib/reading-tests-data";
import { LISTENING_TESTS } from "@/lib/listening-tests-data";
import { readingTestSchema, listeningTestSchema, speakingTestSchema } from "@/lib/test-schema";
import { getWritingPrompts } from "@/lib/writing-content";
import type { WritingPrompt } from "@/lib/writing-data";
import { LISTENING_SEED, READING_SEED, SPEAKING_SEED } from "./content";
import { convertLegacyListening, convertLegacyReading } from "./convert";
import { summarizeListening, summarizeReading } from "./format";
import { validateListeningTest, validateReadingTest, validateSpeakingSet } from "./validate";
import type {
  ExamListeningTest,
  ExamReadingTest,
  ExamTestSummary,
  SpeakingExamSet,
} from "./types";

/**
 * The exam library — every Reading / Listening / Speaking / Writing item a
 * student can take, from three sources:
 *   1. hand-written Averna tests (lib/ielts/content),
 *   2. published AI-generated tests (GeneratedTest rows, exam-v2 or legacy JSON),
 *   3. the original short practice tests, converted (source "legacy").
 *
 * Lists are summaries only (no passages, scripts or answers) and are cached for
 * a few minutes across requests; publishing a test revalidates EXAM_CATALOG_TAG.
 */

export const EXAM_CATALOG_TAG = "exam-catalog";
const REVALIDATE_SECONDS = 300;

type Row = { id: string; data: unknown; title: string; createdAt: Date };

/**
 * Published rows of one module. Runs INSIDE unstable_cache, so it must throw on
 * a database error (an empty result would be cached for minutes); the list
 * functions below catch outside the cache and fall back to the built-in content.
 */
async function publishedRows(module: string): Promise<Row[]> {
  return db.generatedTest.findMany({
    where: { module, published: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, data: true, title: true, createdAt: true },
  });
}

function isV2(data: unknown): boolean {
  return !!data && typeof data === "object" && (data as { format?: unknown }).format === "exam-v2";
}

export function readingFromRow(row: { id: string; data: unknown }): ExamReadingTest | null {
  if (isV2(row.data)) {
    const t = { ...(row.data as ExamReadingTest), id: row.id, source: "generated" as const };
    return validateReadingTest(t).errors.length ? null : t;
  }
  const parsed = readingTestSchema.safeParse(row.data);
  return parsed.success ? convertLegacyReading({ ...parsed.data, id: row.id }, "generated") : null;
}

export function listeningFromRow(row: { id: string; data: unknown }): ExamListeningTest | null {
  if (isV2(row.data)) {
    const t = { ...(row.data as ExamListeningTest), id: row.id, source: "generated" as const };
    return validateListeningTest(t).errors.length ? null : t;
  }
  const parsed = listeningTestSchema.safeParse(row.data);
  return parsed.success ? convertLegacyListening({ ...parsed.data, id: row.id }, "generated") : null;
}

/** Older generated speaking sets (one Part 1 topic, one card, a few Part 3 questions). */
export function speakingFromRow(row: { id: string; data: unknown }): SpeakingExamSet | null {
  if (isV2(row.data)) {
    const s = { ...(row.data as SpeakingExamSet), id: row.id, source: "generated" as const };
    return validateSpeakingSet(s).errors.length ? null : s;
  }
  const parsed = speakingTestSchema.safeParse(row.data);
  if (!parsed.success) return null;
  const t = parsed.data;
  const points = t.part2.points.filter((p) => !/^and\b/i.test(p.trim()));
  const closing = t.part2.points.find((p) => /^and\b/i.test(p.trim())) ?? "and explain why it matters to you.";
  return {
    format: "exam-v2",
    skill: "SPEAKING",
    id: row.id,
    title: t.title || t.part2.topic,
    source: "generated",
    part1: [{ topic: t.part1.name, questions: t.part1.questions.map((q) => q.q) }],
    part2: { cue: t.part2.topic, points: points.slice(0, 4), closing },
    part3: { theme: t.part3[0]?.theme ?? t.part2.topic, questions: t.part3.map((q) => q.question).slice(0, 6) },
  };
}

const LEGACY_READING = Object.values(READING_TESTS).map((t) => convertLegacyReading(t, "legacy"));
const LEGACY_LISTENING = LISTENING_TESTS.map((t) => convertLegacyListening(t, "legacy"));

function order(a: ExamTestSummary, b: ExamTestSummary): number {
  // Full exam papers first, then Averna originals before generated, legacy last.
  if (a.full !== b.full) return a.full ? -1 : 1;
  const rank = { averna: 0, generated: 1, legacy: 2 } as const;
  return rank[a.source] - rank[b.source];
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

const cachedReadingSummaries = unstable_cache(
  async (): Promise<ExamTestSummary[]> => {
    const rows = await publishedRows("READING");
    const generated = rows.map(readingFromRow).filter((t): t is ExamReadingTest => t !== null);
    return [...READING_SEED, ...generated, ...LEGACY_READING].map(summarizeReading).sort(order);
  },
  ["exam-catalog-reading-v1"],
  { revalidate: REVALIDATE_SECONDS, tags: [EXAM_CATALOG_TAG] }
);

export const listReadingExams = cache(async (): Promise<ExamTestSummary[]> => {
  try {
    return await cachedReadingSummaries();
  } catch {
    return [...READING_SEED, ...LEGACY_READING].map(summarizeReading).sort(order);
  }
});

export const getReadingExam = cache(async (id: string): Promise<ExamReadingTest | null> => {
  const seed = READING_SEED.find((t) => t.id === id);
  if (seed) return seed;
  const legacy = LEGACY_READING.find((t) => t.id === id);
  if (legacy) return legacy;
  try {
    const row = await db.generatedTest.findUnique({ where: { id }, select: { id: true, data: true, module: true, published: true } });
    if (!row || row.module !== "READING" || !row.published) return null;
    return readingFromRow(row);
  } catch {
    return null;
  }
});

// ---------------------------------------------------------------------------
// Listening
// ---------------------------------------------------------------------------

const cachedListeningSummaries = unstable_cache(
  async (): Promise<ExamTestSummary[]> => {
    const rows = await publishedRows("LISTENING");
    const generated = rows.map(listeningFromRow).filter((t): t is ExamListeningTest => t !== null);
    return [...LISTENING_SEED, ...generated, ...LEGACY_LISTENING].map(summarizeListening).sort(order);
  },
  ["exam-catalog-listening-v1"],
  { revalidate: REVALIDATE_SECONDS, tags: [EXAM_CATALOG_TAG] }
);

export const listListeningExams = cache(async (): Promise<ExamTestSummary[]> => {
  try {
    return await cachedListeningSummaries();
  } catch {
    return [...LISTENING_SEED, ...LEGACY_LISTENING].map(summarizeListening).sort(order);
  }
});

export const getListeningExam = cache(async (id: string): Promise<ExamListeningTest | null> => {
  const seed = LISTENING_SEED.find((t) => t.id === id);
  if (seed) return seed;
  const legacy = LEGACY_LISTENING.find((t) => t.id === id);
  if (legacy) return legacy;
  try {
    const row = await db.generatedTest.findUnique({ where: { id }, select: { id: true, data: true, module: true, published: true } });
    if (!row || row.module !== "LISTENING" || !row.published) return null;
    return listeningFromRow(row);
  } catch {
    return null;
  }
});

// ---------------------------------------------------------------------------
// Speaking
// ---------------------------------------------------------------------------

export interface SpeakingSetSummary {
  id: string;
  title: string;
  topics: string[];
  cue: string;
  source: SpeakingExamSet["source"];
}

const summarizeSpeaking = (s: SpeakingExamSet): SpeakingSetSummary => ({
  id: s.id,
  title: s.title,
  topics: s.part1.map((p) => p.topic),
  cue: s.part2.cue,
  source: s.source,
});

const cachedSpeakingSets = unstable_cache(
  async (): Promise<SpeakingExamSet[]> => {
    const rows = await publishedRows("SPEAKING");
    const generated = rows.map(speakingFromRow).filter((s): s is SpeakingExamSet => s !== null);
    return [...SPEAKING_SEED, ...generated];
  },
  ["exam-catalog-speaking-v1"],
  { revalidate: REVALIDATE_SECONDS, tags: [EXAM_CATALOG_TAG] }
);

export const listSpeakingSets = cache(async (): Promise<SpeakingSetSummary[]> => {
  try {
    return (await cachedSpeakingSets()).map(summarizeSpeaking);
  } catch {
    return SPEAKING_SEED.map(summarizeSpeaking);
  }
});

export const getSpeakingSet = cache(async (id: string): Promise<SpeakingExamSet | null> => {
  const seed = SPEAKING_SEED.find((s) => s.id === id);
  if (seed) return seed;
  try {
    const row = await db.generatedTest.findUnique({ where: { id }, select: { id: true, data: true, module: true, published: true } });
    if (!row || row.module !== "SPEAKING" || !row.published) return null;
    return speakingFromRow(row);
  } catch {
    return null;
  }
});

// ---------------------------------------------------------------------------
// Writing (built-in + seeds + generated, via lib/writing-content)
// ---------------------------------------------------------------------------

export const listWritingTasks = cache(async (task: "task1" | "task2"): Promise<WritingPrompt[]> => {
  try {
    return await getWritingPrompts(task);
  } catch {
    return [];
  }
});

export const getWritingTask = cache(async (task: "task1" | "task2", id: string): Promise<WritingPrompt | null> => {
  const all = await listWritingTasks(task);
  return all.find((p) => p.id === id) ?? null;
});

// ---------------------------------------------------------------------------
// Library stats (hub pages)
// ---------------------------------------------------------------------------

export interface LibraryStats {
  reading: { total: number; full: number };
  listening: { total: number; full: number };
  writing: { task1: number; task2: number };
  speaking: { sets: number };
}

export const getLibraryStats = cache(async (): Promise<LibraryStats> => {
  const [reading, listening, t1, t2, speaking] = await Promise.all([
    listReadingExams(),
    listListeningExams(),
    listWritingTasks("task1"),
    listWritingTasks("task2"),
    listSpeakingSets(),
  ]);
  return {
    reading: { total: reading.length, full: reading.filter((r) => r.full).length },
    listening: { total: listening.length, full: listening.filter((r) => r.full).length },
    writing: { task1: t1.length, task2: t2.length },
    speaking: { sets: speaking.length },
  };
});
