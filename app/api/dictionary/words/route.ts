import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { dictStudent, listSavedWords, removeWord, saveWord } from "@/lib/dictionary";
import {
  MAX_SAVED_WORDS,
  isDictLang,
  normalizeWord,
  wordItemKey,
  type MyWordsResponse,
} from "@/lib/dictionary-core";

export const dynamic = "force-dynamic";
// Saving a word the cache doesn't have yet looks it up first (model, then the free dictionary).
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "private, no-store" };
const INVALID_WORD = "Select one English word or a short phrase (up to 3 words).";

function fail(status: number, error: string, headers?: Record<string, string>) {
  return NextResponse.json({ error }, { status, headers: { ...NO_STORE, ...headers } });
}

async function signedIn(): Promise<{ id: string } | null> {
  try {
    const user = await requireAuth();
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

/** Small JSON bodies only ({ word, lang }). */
async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    if (Number(req.headers.get("content-length") ?? 0) > 2000) return null;
    const text = await req.text();
    if (!text || text.length > 2000) return null;
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** GET — the student's saved words with their dictionary data (?lang=uz|ru picks the translation language). */
export async function GET(req: NextRequest) {
  const user = await signedIn();
  if (!user) return fail(401, "Please sign in to see your words.");
  try {
    const langParam = req.nextUrl.searchParams.get("lang");
    const student = await dictStudent(user.id);
    const lang = isDictLang(langParam) ? langParam : student?.lang ?? "uz";
    const body: MyWordsResponse = {
      words: student ? await listSavedWords(student.id, lang) : [],
      lang,
      canSave: !!student,
      limit: MAX_SAVED_WORDS,
    };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (error) {
    console.error("[dictionary] words GET failed:", error instanceof Error ? error.message : error);
    return fail(503, "Your saved words couldn't be loaded right now. Please try again.");
  }
}

/** POST { word, lang } — add a word to "My words" (idempotent). */
export async function POST(req: NextRequest) {
  const user = await signedIn();
  if (!user) return fail(401, "Please sign in to save words.");
  try {
    const body = await readBody(req);
    const word = normalizeWord(body?.word);
    if (!word) return fail(400, INVALID_WORD);
    if (body?.lang != null && !isDictLang(body.lang)) return fail(400, "Translation language must be uz or ru.");

    const student = await dictStudent(user.id);
    if (!student) return fail(403, "Only students can keep a word list.");
    const lang = isDictLang(body?.lang) ? body.lang : student.lang;

    const res = await saveWord({ userId: user.id, studentId: student.id, word, lang });
    switch (res.kind) {
      case "saved":
        return NextResponse.json(
          { ok: true, word, itemKey: wordItemKey(word), created: res.created },
          { status: res.created ? 201 : 200, headers: NO_STORE }
        );
      case "not_found":
        return fail(404, `No dictionary entry for “${word}”, so it can't be saved.`);
      case "full":
        return fail(409, `You've saved ${MAX_SAVED_WORDS.toLocaleString("en-GB")} words — remove a few you know well to add new ones.`);
      case "limited":
        return fail(429, res.message, { "Retry-After": "600" });
      default:
        return fail(503, "Couldn't save the word right now. Please try again.");
    }
  } catch (error) {
    console.error("[dictionary] words POST failed:", error instanceof Error ? error.message : error);
    return fail(500, "Couldn't save the word right now. Please try again.");
  }
}

/** DELETE ?word= (or { word }) — remove a word from "My words". */
export async function DELETE(req: NextRequest) {
  const user = await signedIn();
  if (!user) return fail(401, "Please sign in to manage your words.");
  try {
    const fromQuery = req.nextUrl.searchParams.get("word");
    const raw = fromQuery != null ? fromQuery : (await readBody(req))?.word;
    const word = normalizeWord(raw);
    if (!word) return fail(400, INVALID_WORD);

    const student = await dictStudent(user.id);
    if (!student) return fail(403, "Only students can keep a word list.");

    const removed = await removeWord(student.id, word);
    return NextResponse.json({ ok: true, word, removed }, { headers: NO_STORE });
  } catch (error) {
    console.error("[dictionary] words DELETE failed:", error instanceof Error ? error.message : error);
    return fail(503, "Couldn't remove the word right now. Please try again.");
  }
}
