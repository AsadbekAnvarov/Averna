import { z } from "zod";
import { hasOpenAI, liveSpeakingTips } from "@/lib/ai";
import { guardAi } from "@/lib/engine/ai-guard";
import { boundedJson } from "@/lib/security/json-body";
import { reply, liveStudent } from "@/lib/realtime/http";
import { liveModeLabel } from "@/lib/realtime/modes";

export const dynamic = "force-dynamic";

/**
 * POST { mode, topic, turns, stats } → { tips: [3 strings], source: "ai" } — "How it
 * went" after a live call: ONE cheap text-model call over the call's transcript
 * (guardAi "live-speaking-tips", 8 a day). The transcript is sent here once, never
 * stored or logged. 503 without a key, 429 at the limit, 502 when the model fails —
 * the page then shows its stats-based tips (lib/realtime/stats.ts fallbackTips).
 */
const MAX_TRANSCRIPT_CHARS = 8_000;

const tipsSchema = z.object({
  mode: z.enum(["casual", "part1", "part3"]),
  topic: z.string().trim().min(1).max(100),
  turns: z
    .array(z.object({ who: z.enum(["me", "ai"]), text: z.string().max(1_500) }))
    .min(1)
    .max(120)
    .refine((t) => t.reduce((n, x) => n + x.text.length, 0) <= MAX_TRANSCRIPT_CHARS)
    .refine((t) => t.some((x) => x.who === "me" && x.text.trim().length > 0)),
  stats: z.object({
    words: z.number().int().min(0).max(20_000),
    wpm: z.number().int().min(0).max(1_000).nullable(),
    fillers: z.number().int().min(0).max(20_000),
    longestAnswerWords: z.number().int().min(0).max(20_000),
    callSec: z.number().int().min(0).max(3_600),
  }),
});

export async function POST(request: Request) {
  const gate = await liveStudent(request);
  if (!gate.ok) return gate.res;

  let raw: unknown;
  try {
    raw = await boundedJson(request, 40_000);
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }
  const parsed = tipsSchema.safeParse(raw);
  if (!parsed.success) return reply({ error: "Invalid request." }, 400);
  if (!hasOpenAI()) return reply({ error: "AI tips aren't available right now." }, 503);

  const guard = await guardAi(gate.who.userId, "live-speaking-tips");
  if (!guard.ok) return reply({ error: "You've used today's AI tips. These tips come from your numbers." }, 429);

  const { mode, topic, turns, stats } = parsed.data;
  const tips = await liveSpeakingTips({ mode: liveModeLabel(mode), topic, turns, stats });
  if (!tips) return reply({ error: "The AI tips didn't come through." }, 502);
  return reply({ tips, source: "ai" });
}
