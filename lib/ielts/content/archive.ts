/**
 * ARCHIVE — the built-in content the CDI materials replaced: the hand-written
 * Averna exam papers (READING_SEED / LISTENING_SEED / WRITING_SEED), the old
 * short practice tests (lib/reading-tests-data, lib/listening-tests-data,
 * converted as source "legacy") and the original Writing prompts
 * (lib/writing-data WRITING_PROMPTS).
 *
 * None of it is LISTED any more (library pages, homework picker, mock exam,
 * recommendations — see lib/ielts/catalog.ts). It stays resolvable BY ID so
 * past results, old homework links and mock sittings that point at these ids
 * keep rendering and grading. Don't delete it, and don't list it again.
 *
 * The AI generator does not read these seeds (lib/ielts/generate.ts carries its
 * own trimmed format examples), so nothing else depends on them.
 */

import { READING_TESTS } from "@/lib/reading-tests-data";
import { LISTENING_TESTS } from "@/lib/listening-tests-data";
import { WRITING_PROMPTS, type WritingPrompt } from "@/lib/writing-data";
import { convertLegacyListening, convertLegacyReading } from "../convert";
import type { ExamListeningTest, ExamReadingTest } from "../types";
import { LISTENING_SEED, READING_SEED, WRITING_SEED } from "./index";

/** Built-in Reading papers (Averna seeds first, then the converted short practice tests). */
export const ARCHIVED_READING: ExamReadingTest[] = [
  ...READING_SEED,
  ...Object.values(READING_TESTS).map((t) => convertLegacyReading(t, "legacy")),
];

/** Built-in Listening papers (Averna seeds first, then the converted short practice tests). */
export const ARCHIVED_LISTENING: ExamListeningTest[] = [
  ...LISTENING_SEED,
  ...LISTENING_TESTS.map((t) => convertLegacyListening(t, "legacy")),
];

/** Built-in Writing prompts (the original prompts, then the Averna exam tasks). */
export const ARCHIVED_WRITING: Record<"task1" | "task2", WritingPrompt[]> = {
  task1: [...WRITING_PROMPTS.task1, ...WRITING_SEED.task1],
  task2: [...WRITING_PROMPTS.task2, ...WRITING_SEED.task2],
};
