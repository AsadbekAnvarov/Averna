/**
 * Browser helpers for the in-text dictionary: API calls (with a small
 * in-memory cache so re-opening a word is instant), the student's translation
 * language (localStorage) and British English speech.
 *
 * Client-safe: imports only the pure lib/dictionary-core.
 */

import {
  isDictLang,
  normalizeWord,
  type DictLang,
  type LookupResponse,
  type MyWordsResponse,
} from "@/lib/dictionary-core";

const LANG_KEY = "averna-dict-lang";
const MEMO_MAX = 200;

export type ApiError = { ok: false; status: number; error: string; aborted?: boolean };
export type LookupResult = { ok: true; data: LookupResponse } | ApiError;

const memo = new Map<string, LookupResponse>();

function remember(key: string, data: LookupResponse) {
  memo.delete(key);
  memo.set(key, data);
  if (memo.size > MEMO_MAX) {
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
}

function defaultError(status: number): string {
  if (status === 401) return "Please sign in to use the dictionary.";
  if (status === 404) return "No dictionary entry for this word.";
  if (status === 429) return "Lots of lookups — take a short break and try again.";
  if (status >= 500) return "The dictionary isn't reachable right now. Please try again in a moment.";
  return "Couldn't look that up.";
}

function isAbort(e: unknown): boolean {
  return !!e && typeof e === "object" && (e as { name?: string }).name === "AbortError";
}

const OFFLINE = "You seem to be offline. Check your connection and try again.";

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const j: unknown = await res.json();
    return j && typeof j === "object" ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The preferred translation language saved in this browser, or null (then the server uses the profile). */
export function getPreferredLang(): DictLang | null {
  try {
    const v = window.localStorage.getItem(LANG_KEY);
    return isDictLang(v) ? v : null;
  } catch {
    return null;
  }
}

export function setPreferredLang(lang: DictLang): void {
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* private mode — the choice lasts for this page only */
  }
}

/** Look a word up (cached per word + language for this page session). */
export async function fetchLookup(
  text: string,
  lang: DictLang | null,
  context?: string | null,
  signal?: AbortSignal
): Promise<LookupResult> {
  const word = normalizeWord(text);
  if (!word) return { ok: false, status: 400, error: "Select one English word or a short phrase (up to 3 words)." };
  const hit = memo.get(`${lang ?? "auto"}:${word}`);
  if (hit) return { ok: true, data: hit };

  const qs = new URLSearchParams({ word });
  if (lang) qs.set("lang", lang);
  if (context) qs.set("context", context.slice(0, 300));
  try {
    const res = await fetch(`/api/dictionary?${qs.toString()}`, { signal, cache: "no-store", headers: { Accept: "application/json" } });
    const body = await readJson(res);
    if (!res.ok || !body || !body.entry) {
      const error = typeof body?.error === "string" && body.error ? body.error : defaultError(res.status);
      return { ok: false, status: res.ok ? 500 : res.status, error };
    }
    const data = body as unknown as LookupResponse;
    remember(`${data.lang}:${word}`, data);
    if (!lang) remember(`auto:${word}`, data);
    return { ok: true, data };
  } catch (e) {
    if (isAbort(e)) return { ok: false, status: 0, error: "", aborted: true };
    return { ok: false, status: 0, error: OFFLINE };
  }
}

/** Mark a word saved / unsaved in the lookup cache (all languages). */
export function markSavedInCache(word: string, saved: boolean): void {
  for (const [k, v] of memo) if (v.word === word) memo.set(k, { ...v, saved });
}

/** POST /api/dictionary/words — idempotent. */
export async function saveMyWord(word: string, lang: DictLang): Promise<{ ok: true } | ApiError> {
  try {
    const res = await fetch("/api/dictionary/words", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ word, lang }),
    });
    if (res.ok) {
      markSavedInCache(word, true);
      return { ok: true };
    }
    const body = await readJson(res);
    return { ok: false, status: res.status, error: typeof body?.error === "string" ? body.error : "Couldn't save the word. Please try again." };
  } catch {
    return { ok: false, status: 0, error: OFFLINE };
  }
}

/** DELETE /api/dictionary/words?word= */
export async function removeMyWord(word: string): Promise<{ ok: true } | ApiError> {
  try {
    const res = await fetch(`/api/dictionary/words?${new URLSearchParams({ word }).toString()}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      markSavedInCache(word, false);
      return { ok: true };
    }
    const body = await readJson(res);
    return { ok: false, status: res.status, error: typeof body?.error === "string" ? body.error : "Couldn't remove the word. Please try again." };
  } catch {
    return { ok: false, status: 0, error: OFFLINE };
  }
}

/** GET /api/dictionary/words */
export async function fetchMyWords(lang: DictLang | null, signal?: AbortSignal): Promise<{ ok: true; data: MyWordsResponse } | ApiError> {
  try {
    const qs = lang ? `?${new URLSearchParams({ lang }).toString()}` : "";
    const res = await fetch(`/api/dictionary/words${qs}`, { signal, cache: "no-store", headers: { Accept: "application/json" } });
    const body = await readJson(res);
    if (!res.ok || !body || !Array.isArray(body.words)) {
      return { ok: false, status: res.status, error: typeof body?.error === "string" ? body.error : "Your words couldn't be loaded." };
    }
    return { ok: true, data: body as unknown as MyWordsResponse };
  } catch (e) {
    if (isAbort(e)) return { ok: false, status: 0, error: "", aborted: true };
    return { ok: false, status: 0, error: OFFLINE };
  }
}

// ---------------------------------------------------------------------------
// Speech (browser speechSynthesis, en-GB)
// ---------------------------------------------------------------------------

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/** Speak English text with a British voice when the device has one. Returns false when speech isn't available. */
export function speakEnglish(text: string): boolean {
  if (!canSpeak() || !text.trim()) return false;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    u.rate = 0.9;
    const voices = synth.getVoices();
    const gb = voices.find((v) => v.lang === "en-GB") ?? voices.find((v) => v.lang.toLowerCase().startsWith("en-gb"));
    if (gb) u.voice = gb;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking(): void {
  try {
    if (canSpeak()) window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
