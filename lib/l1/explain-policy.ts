import { z } from "zod";

/** Longest answer explanation POST /api/l1/explain translates. */
export const L1_EXPLAIN_MAX_CHARS = 1200;

/** Per-student translations a day (AI_LIMITS["l1-explain"] in lib/engine/ai-guard.ts). */
export const L1_EXPLAIN_PER_DAY = 40;

export const l1ExplainSchema = z.object({
  text: z.string().trim().min(1).max(L1_EXPLAIN_MAX_CHARS),
  lang: z.enum(["uz", "ru"]),
});

export type L1ExplainRequest = z.infer<typeof l1ExplainSchema>;
