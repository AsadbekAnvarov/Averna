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



/**
 * Validation schema for a generated IELTS Writing Task 2 prompt. Mirrors the
 * WritingPrompt shape in lib/writing-data.ts (chart/imageUrl are omitted — they
 * only apply to Task 1).
 */
export const writingPromptSchema = z.object({
  id: z.string(),
  title: z.string().min(2),
  prompt: z.string().min(20),
  type: z.string(),
  sampleAnswer: z.string().min(100),
  usefulPhrases: z.array(z.string()).min(3),
  strategyEn: z.string(),
  strategyUz: z.string(),
});

export type GeneratedWritingPrompt = z.infer<typeof writingPromptSchema>;



/**
 * Validation schema for a generated IELTS Speaking practice set. Bundles one
 * Part 1 topic (with sample answers), one Part 2 cue card and a few Part 3
 * discussion questions. Mirrors Part1Topic / Part2Card / Part3Question in
 * lib/speaking-data.ts — the inner `id` fields are assigned when the content is
 * merged (see lib/speaking-content.ts), so the model does not need to invent them.
 */
export const speakingPart1Schema = z.object({
  emoji: z.string().optional(),
  name: z.string().min(2),
  questions: z
    .array(
      z.object({
        q: z.string().min(3),
        sample: z.string().min(20),
        phrases: z.array(z.string()).optional(),
      })
    )
    .min(3),
});

export const speakingPart2Schema = z.object({
  topic: z.string().min(5),
  points: z.array(z.string()).min(3),
  sample: z.string().min(100),
  usefulPhrases: z.array(z.string()).min(3),
  tipUz: z.string(),
});

export const speakingPart3Schema = z.object({
  theme: z.string(),
  question: z.string().min(5),
  sample: z.string().min(50),
  usefulPhrases: z.array(z.string()).min(3),
  tipUz: z.string(),
});

export const speakingTestSchema = z.object({
  id: z.string(),
  title: z.string().min(2),
  topic: z.string(),
  part1: speakingPart1Schema,
  part2: speakingPart2Schema,
  part3: z.array(speakingPart3Schema).min(1),
});

export type GeneratedSpeakingTest = z.infer<typeof speakingTestSchema>;




/**
 * Validation schema for a generated IELTS Writing Task 1 task with structured
 * chart data. Mirrors WritingPrompt in lib/writing-data.ts with a required
 * `chart` (Task1ChartData[]) that the Task1Chart component renders as SVG.
 * A superRefine guarantees each series' value count matches its axis labels so
 * the chart always renders correctly.
 */
export const task1ChartSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("bar"),
    unit: z.string().optional(),
    groups: z.array(z.string()).min(2),
    series: z.array(z.object({ name: z.string(), values: z.array(z.number()) })).min(1),
  }),
  z.object({
    kind: z.literal("line"),
    unit: z.string().optional(),
    xLabels: z.array(z.string()).min(2),
    series: z.array(z.object({ name: z.string(), values: z.array(z.number()) })).min(1),
  }),
  z.object({
    kind: z.literal("pie"),
    unit: z.string().optional(),
    title: z.string().optional(),
    slices: z.array(z.object({ label: z.string(), value: z.number() })).min(2),
  }),
]);

export const writingTask1Schema = z
  .object({
    id: z.string(),
    title: z.string().min(2),
    prompt: z.string().min(20),
    type: z.string(),
    chart: z.array(task1ChartSchema).min(1),
    sampleAnswer: z.string().min(100),
    usefulPhrases: z.array(z.string()).min(3),
    strategyEn: z.string(),
    strategyUz: z.string(),
  })
  .superRefine((data, ctx) => {
    data.chart.forEach((c, i) => {
      if (c.kind === "bar" || c.kind === "line") {
        const labels = c.kind === "bar" ? c.groups : c.xLabels;
        c.series.forEach((s, j) => {
          if (s.values.length !== labels.length) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `chart[${i}].series[${j}] has ${s.values.length} values but there are ${labels.length} ${c.kind === "bar" ? "groups" : "xLabels"}.`,
              path: ["chart", i, "series", j, "values"],
            });
          }
        });
      }
    });
  });

export type GeneratedWritingTask1 = z.infer<typeof writingTask1Schema>;
