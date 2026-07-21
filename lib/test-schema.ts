import { z } from "zod";

/**
 * Validation schema for a generated IELTS Academic Reading test. Mirrors the
 * shape in lib/reading-tests-data.ts (ReadingTest), so generated content is
 * structurally identical to the hand-authored tests and plugs into the same UI.
 * Used to validate AI output before it is trusted/stored.
 */
export const readingQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(["multiple-choice", "true-false-not-given", "sentence-completion"]),
  question: z.string().min(3),
  options: z.array(z.string()).optional(),
  correctAnswer: z.union([z.number(), z.string()]),
  explanation: z.string().optional(),
});

export const readingPassageSchema = z.object({
  id: z.string(),
  title: z.string().min(2),
  text: z.string().min(200),
  questions: z.array(readingQuestionSchema).min(6),
});

export const readingTestSchema = z.object({
  id: z.string(),
  title: z.string().min(2),
  description: z.string(),
  timeLimit: z.number().int().positive(),
  passages: z.array(readingPassageSchema).min(1),
});

export type GeneratedReadingTest = z.infer<typeof readingTestSchema>;
