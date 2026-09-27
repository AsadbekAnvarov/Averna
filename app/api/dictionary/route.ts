import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { dictStudent, isWordSaved, lookupTooFast, lookupWord } from "@/lib/dictionary";
import { hasTranslations, isDictLang, normalizeWord, sanitizeContext, type LookupResponse } from "@/lib/dictionary-core";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

function fail(status: number, error: string, extra?: Record<string, unknown>, headers?: Record<string, string>) {
  return NextResponse.json({ error, ...extra }, { status, headers: { ...NO_STORE, ...headers } });
}

/**
 * GET /api/dictionary?word=&lang=uz|ru&context=
 *
 * One dictionary entry for a word or short phrase (1–3 words) selected in a
 * text. `lang` defaults to the student's language (Student.nativeLanguage,
 * Uzbek unless it says Russian); `context` (the sentence around the word) only
 * orders the senses. 400 invalid word · 404 no entry · 429 rate-limited ·
 * 503 no dictionary reachable.
 */
export async function GET(req: NextRequest) {
  let user: { id: string };
  try {
    user = await requireAuth();
    if (!user?.id) throw new Error("Unauthorized");
  } catch {
    return fail(401, "Please sign in to use the dictionary.");
  }

  try {
    const params = req.nextUrl.searchParams;
    const word = normalizeWord(params.get("word") ?? "");
    if (!word) return fail(400, "Select one English word or a short phrase (up to 3 words).");

    const langParam = params.get("lang");
    if (langParam && !isDictLang(langParam)) return fail(400, "Translation language must be uz or ru.");

    if (lookupTooFast(user.id)) {
      return fail(429, "That's a lot of lookups in a minute — give it a few seconds and try again.", { retryAfter: 30 }, { "Retry-After": "30" });
    }

    const student = await dictStudent(user.id);
    const lang = isDictLang(langParam) ? langParam : student?.lang ?? "uz";
    const context = sanitizeContext(params.get("context"), word);

    const [outcome, saved] = await Promise.all([
      lookupWord({ userId: user.id, word, lang, context }),
      student ? isWordSaved(student.id, word) : Promise.resolve(false),
    ]);

    switch (outcome.kind) {
      case "ok": {
        const body: LookupResponse = {
          word,
          lang,
          entry: outcome.entry,
          source: outcome.source,
          translated: hasTranslations(outcome.entry),
          saved,
          canSave: !!student,
        };
        return NextResponse.json(body, { headers: NO_STORE });
      }
      case "not_found":
        return fail(404, `No dictionary entry for “${word}”. Try the base form of the word.`, { word });
      case "limited": {
        const retry = outcome.retryAfterSeconds ?? 600;
        return fail(429, outcome.message, { retryAfter: retry }, { "Retry-After": String(retry) });
      }
      default:
        return fail(503, "The dictionary isn't reachable right now. Please try again in a moment.");
    }
  } catch (error) {
    console.error("[dictionary] GET failed:", error instanceof Error ? error.message : error);
    return fail(500, "Something went wrong looking up that word. Please try again.");
  }
}
