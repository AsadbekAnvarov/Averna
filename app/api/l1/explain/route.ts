import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { auth } from "@/lib/auth";
import { hasOpenAI, translateExplanationL1 } from "@/lib/ai";
import { guardAi } from "@/lib/engine/ai-guard";
import { L1_EXPLAIN_MAX_CHARS, L1_EXPLAIN_PER_DAY, l1ExplainSchema } from "@/lib/l1/explain-policy";
import { boundedJson } from "@/lib/security/json-body";
import { trustedMutation } from "@/lib/security/same-origin";

export const dynamic = "force-dynamic";

/**
 * POST { text, lang: "uz" | "ru" } → { translation, lang } — "Explain in
 * Oʻzbekcha / по-русски" under a wrong answer's explanation on the result
 * pages (native-language hints, docs/elegance-roadmap.md idea 8). Students
 * only; at most 1200 characters; 40 a day per student (guardAi "l1-explain");
 * identical (text, lang) pairs are served from the data cache, keyed by a
 * sha256 of the pair. The text is never logged.
 */
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

const CACHE_SECONDS = 60 * 60 * 24 * 30;

function cachedTranslation(text: string, lang: "uz" | "ru"): Promise<string> {
  const key = createHash("sha256").update(`${lang}\u0000${text}`).digest("hex");
  return unstable_cache(
    async () => {
      const out = await translateExplanationL1(text, lang);
      // Throwing keeps a failed call out of the cache.
      if (!out) throw new Error("empty translation");
      return out;
    },
    ["l1-explain-v1", lang, key],
    { revalidate: CACHE_SECONDS }
  )();
}

export async function POST(request: Request) {
  if (!trustedMutation(request)) return reply({ error: "Untrusted origin" }, 403);
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return reply({ error: "Sign in to use translations." }, 401);
  if (user.role !== "STUDENT") return reply({ error: "Translations are available to students." }, 403);

  let raw: unknown;
  try {
    raw = await boundedJson(request, 16_000);
  } catch {
    return reply({ error: "Invalid request" }, 400);
  }
  const parsed = l1ExplainSchema.safeParse(raw);
  if (!parsed.success) {
    const text = (raw as { text?: unknown } | null)?.text;
    const tooLong = typeof text === "string" && text.trim().length > L1_EXPLAIN_MAX_CHARS;
    return reply({ error: tooLong ? "That explanation is too long to translate." : "Invalid request" }, 400);
  }
  if (!hasOpenAI()) return reply({ error: "Translation isn't available right now. The English explanation is above." }, 503);

  const guard = await guardAi(user.id, "l1-explain");
  if (!guard.ok)
    return reply({ error: `You've used today's translations (${L1_EXPLAIN_PER_DAY} a day), or the service is busy. Try again later.` }, 429);

  try {
    const translation = await cachedTranslation(parsed.data.text, parsed.data.lang);
    return reply({ translation, lang: parsed.data.lang });
  } catch (e) {
    console.error("L1 explain route failed", e instanceof Error ? e.name : "unknown");
    return reply({ error: "The translation didn't come through. Try again in a moment." }, 502);
  }
}
