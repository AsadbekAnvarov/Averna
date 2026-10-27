import { hasOpenAI } from "@/lib/ai";
import { guardAi } from "@/lib/engine/ai-guard";
import { transcribeAudio } from "@/lib/openai-audio";
import { boundedBytes } from "@/lib/security/json-body";
import { sniffAudio } from "@/lib/speaking/audio-format";
import { reply, liveStudent } from "@/lib/realtime/http";
import { wordHeard } from "@/lib/realtime/pronunciation-map";

export const dynamic = "force-dynamic";

/**
 * POST ?word=<word>, body = a short recording (≤ 400 KB, webm / mp4 / ogg / wav) →
 * { clear, heard } — "Words to practise" → Say it. One transcription with the existing
 * helper (lib/openai-audio.ts), guardAi "live-word-check" (80 a day). The target word
 * is NOT given to the recogniser as a hint, so "Clear" means it really heard the word.
 * The audio is never stored; nothing is logged.
 */
const MAX_AUDIO_BYTES = 400_000;
const WORD_RE = /^[A-Za-z][A-Za-z'’-]{1,39}$/;

export async function POST(request: Request) {
  const gate = await liveStudent(request);
  if (!gate.ok) return gate.res;

  const word = new URL(request.url).searchParams.get("word")?.trim() ?? "";
  if (!WORD_RE.test(word)) return reply({ error: "Invalid word." }, 400);
  if (!hasOpenAI()) return reply({ error: "Checking isn't available right now. Listen and repeat instead." }, 503);

  let audio: Uint8Array;
  try {
    audio = await boundedBytes(request, MAX_AUDIO_BYTES);
  } catch {
    return reply({ error: "That recording was too long. Say just the word." }, 400);
  }
  const format = sniffAudio(audio.subarray(0, 16));
  if (!format || audio.byteLength < 200) return reply({ error: "That recording didn't come through. Try again." }, 400);

  const guard = await guardAi(gate.who.userId, "live-word-check");
  if (!guard.ok) return reply({ error: "You've used today's checks. Listen and repeat instead." }, 429);

  try {
    const t = await transcribeAudio({
      audio: new Blob([audio as BlobPart], { type: format.mime }),
      filename: `word.${format.ext}`,
      language: "en",
      timeoutMs: 20_000,
    });
    const heard = t.text.replace(/\s+/g, " ").trim().slice(0, 120);
    return reply({ clear: wordHeard(word, heard), heard });
  } catch (e) {
    console.error("Live word check failed", e instanceof Error ? e.name : "unknown");
    return reply({ error: "The check didn't come through. Try again." }, 502);
  }
}
