import { coachPeerSpeaking, hasOpenAI } from "@/lib/ai";
import { guardAi } from "@/lib/engine/ai-guard";
import { boundedJson } from "@/lib/security/json-body";
import { trustedMutation } from "@/lib/security/same-origin";
import { countWords } from "@/lib/speaking/fluency";
import { reply, roomMember } from "@/lib/speaking/room-member";

export const dynamic = "force-dynamic";

/**
 * POST { roomId, consent: true, transcript, stats: { words, wpm, fillers } } — opt-in AI
 * coach on the student's OWN captions (docs/peer-speaking.md, Phase C). Members of the
 * room only; 3 a day per student (guardAi "peer-coach"). The transcript is sent to the AI
 * provider for this one answer and is never stored or logged.
 *   → { bandEstimate: { low, high }, strengths[2], improvements[3], vocabularyUpgrades[3] }
 */

const COACH_TRANSCRIPT_MAX = 6000;
const MIN_WORDS = 25;

const num = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(max, Math.round(v)) : null);

export async function POST(request: Request) {
  if (!trustedMutation(request)) return reply({ error: "Untrusted origin" }, 403);
  let body: Record<string, unknown>;
  try {
    const raw = await boundedJson(request, 32_000);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("shape");
    body = raw as Record<string, unknown>;
  } catch {
    return reply({ error: "Invalid request" }, 400);
  }
  try {
    const m = await roomMember(body.roomId);
    if (m.fail) return m.fail;
    if (!hasOpenAI()) return reply({ error: "AI feedback isn't available right now." }, 503);
    if (body.consent !== true) return reply({ error: "Please agree to send your captions first.", code: "consent" }, 400);

    const transcript = typeof body.transcript === "string" ? body.transcript.replace(/\s+/g, " ").trim() : "";
    if (transcript.length > COACH_TRANSCRIPT_MAX) return reply({ error: "That transcript is too long." }, 400);
    if (countWords(transcript) < MIN_WORDS) return reply({ error: "Speak a little more with captions on first — there isn't enough to coach yet." }, 400);
    const s = (body.stats ?? {}) as Record<string, unknown>;
    const stats = { words: num(s.words, 100_000) ?? countWords(transcript), wpm: num(s.wpm, 400), fillers: num(s.fillers, 10_000) ?? 0 };

    const guard = await guardAi(m.userId, "peer-coach");
    if (!guard.ok) return reply({ error: "You've used today's AI feedback (3 a day), or AI help is busy. Try again later." }, 429);

    const result = await coachPeerSpeaking(transcript, stats);
    if (!result) return reply({ error: "The AI coach couldn't answer this time. Your session is saved — try again later." }, 502);
    return reply(result);
  } catch (e) {
    console.error("Peer coach route failed", e instanceof Error ? e.name : "unknown");
    return reply({ error: "The AI coach couldn't answer this time. Try again later." }, 503);
  }
}
