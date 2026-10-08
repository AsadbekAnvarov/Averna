import { z } from "zod";
const band = z.number().finite().min(0).max(9);
const lines = z.array(z.string().min(1).max(1200)).max(12);
export const writingAssessmentSchema = z.object({
  taskAchievement: band,
  coherenceCohesion: band,
  lexicalResource: band,
  grammarAccuracy: band,
  overallBand: band,
  aiDetectionScore: z.number().min(0).max(100).default(0),
  strengths: lines,
  weaknesses: lines,
  recommendations: lines,
  detailedFeedback: z.string().min(1).max(10000),
  issues: z
    .array(
      z.object({
        text: z.string().min(1).max(300),
        type: z.enum([
          "grammar",
          "vocabulary",
          "spelling",
          "cohesion",
          "punctuation",
          "good",
        ]),
        suggestion: z.string().min(1).max(1000),
      }),
    )
    .max(20)
    .optional(),
});
export function validateWritingAssessment(raw: unknown, essay: string) {
  const parsed = writingAssessmentSchema.parse(raw);
  const mean =
    (parsed.taskAchievement +
      parsed.coherenceCohesion +
      parsed.lexicalResource +
      parsed.grammarAccuracy) /
    4;
  return {
    ...parsed,
    overallBand: Math.round(mean * 2) / 2,
    source: "ai" as const,
    issues: parsed.issues?.filter((issue) => essay.includes(issue.text)),
  };
}
