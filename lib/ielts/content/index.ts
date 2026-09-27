import type { ExamListeningTest, ExamReadingTest, SpeakingExamSet } from "../types";
import { READING_SEED_A } from "./reading-a";
import { READING_SEED_B } from "./reading-b";
import { LISTENING_SEED_A } from "./listening-a";
import { LISTENING_SEED_B } from "./listening-b";
import { LISTENING_SEED_C } from "./listening-c";
import { SPEAKING_SEED } from "./speaking";
export { WRITING_SEED } from "./writing";

/** Hand-written Averna exam content (the generator's gold standard). */
export const READING_SEED: ExamReadingTest[] = [...READING_SEED_A, ...READING_SEED_B];
// Test 1 (listening-a), Test 2 (listening-c), Tests 3–4 (listening-b).
export const LISTENING_SEED: ExamListeningTest[] = [...LISTENING_SEED_A, ...LISTENING_SEED_C, ...LISTENING_SEED_B];
export { SPEAKING_SEED };
export type { SpeakingExamSet };
