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



/**
 * Validation schema for a generated IELTS Listening test. Mirrors the shape in
 * lib/listening-tests-data.ts (ListeningTest). Audio is produced from the
 * transcript by the browser's text-to-speech, so no audio files are needed.
 */
export const listeningQuestionSchema = z.object({
  question: z.string().min(3),
  options: z.array(z.string()).min(2),
  answer: z.number().int().min(0),
});

export const listeningSectionSchema = z.object({
  title: z.string().min(2),
  transcript: z.string().min(100),
  questions: z.array(listeningQuestionSchema).min(3),
});

export const listeningTestSchema = z.object({
  id: z.string(),
  title: z.string().min(2),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  description: z.string(),
  sections: z.array(listeningSectionSchema).min(1),
});

export type GeneratedListeningTest = z.infer<typeof listeningTestSchema>;
