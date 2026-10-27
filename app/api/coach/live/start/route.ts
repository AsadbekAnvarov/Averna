import { after } from "next/server";
import { z } from "zod";
import { hasOpenAI } from "@/lib/ai";
import { guardAi } from "@/lib/engine/ai-guard";
import { boundedJson } from "@/lib/security/json-body";
import { studentPeerLevel } from "@/lib/speaking/peer-store";
import { cefrForBand } from "@/lib/speaking/level";
import { reply, liveStudent } from "@/lib/realtime/http";
import {
  HARD_STOP_GRACE_SECONDS,
  MIN_CALL_SECONDS,
  SDP_MAX_BYTES,
  capExceeded,
  liveLimits,
  remainingSeconds,
  reservationSeconds,
} from "@/lib/realtime/limits";
import {
  attachCallId,
  deleteReservation,
  finishCall,
  hardStop,
  insertReservation,
  openCallsOf,
  todayCalls,
  usageOf,
} from "@/lib/realtime/live-store";
import { buildLiveInstructions, buildSessionConfig } from "@/lib/realtime/prompt";
import { resolveLiveTopic } from "@/lib/realtime/topics";
import {
  RealtimeError,
  createRealtimeCall,
  hangupRealtimeCall,
  realtimeModel,
  realtimeTranscribeModel,
  realtimeVoice,
} from "@/lib/realtime/openai-realtime";

export const dynamic = "force-dynamic";

/**
 * POST { sdp, mode, topicId, resumed? } → the SDP answer (application/sdp) for the
 * live speaking partner (docs/elegance-roadmap.md, idea 3). Students only.
 *
 *   1. An open call of this student is settled and hung up (a newer start replaces it).
 *   2. Minutes left today (per student and for everyone) → the call's length; under
 *      30 s → 429. guardAi("realtime-speaking") caps the number of calls → 429.
 *   3. The full length is reserved in ActivityLog, then counted again WITH the
 *      reservation; over a cap → the reservation is removed and 429 (races refuse,
 *      never overspend).
 *   4. POST /v1/realtime/calls (key and session config stay on the server); its call id
 *      is stored, and after() hangs the call up at OpenAI when the reserved length
 *      (+ 5 s) has passed and the client hasn't ended it — a tampered client can't run
 *      up costs. The length is clamped to ≤ 270 s so that wait fits the 300 s default.
 *
 * Headers: X-Live-Call (our call id for /end), X-Live-Seconds (the call's length),
 * X-Live-Remaining (seconds left today after this call), X-Live-Topic (the topic's
 * label, URI-encoded). The SDP is never logged.
 */
const startSchema = z.object({
  // Passed through untouched: SDP lines end in CRLF, including the last one.
  sdp: z.string().min(10).max(SDP_MAX_BYTES).refine((s) => s.startsWith("v=")),
  mode: z.enum(["casual", "part1", "part3"]),
  topicId: z.string().min(1).max(80),
  resumed: z.boolean().optional(),
});

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  const gate = await liveStudent(request);
  if (!gate.ok) return gate.res;
  const { userId, student } = gate.who;

  let raw: unknown;
  try {
    raw = await boundedJson(request, SDP_MAX_BYTES + 2_000);
  } catch {
    return reply({ error: "That request was too large or not valid." }, 400);
  }
  const parsed = startSchema.safeParse(raw);
  if (!parsed.success) return reply({ error: "Invalid request." }, 400);
  const { sdp, mode, topicId, resumed } = parsed.data;
  const topic = resolveLiveTopic(mode, topicId);
  if (!topic) return reply({ error: "Pick a topic from the list." }, 400);

  if (!hasOpenAI()) return reply({ error: "Live partner isn't available right now. The AI Examiner works any time." }, 503);

  const limits = liveLimits();
  let row: Awaited<ReturnType<typeof insertReservation>>;
  let reserved = 0;
  let remainingAfter = 0;
  try {
    const now = new Date();
    for (const open of await openCallsOf(student.id, now)) await finishCall(open, "replaced", now);

    const before = usageOf(await todayCalls(now), student.id, now);
    reserved = reservationSeconds(limits, before.student, before.global);
    if (reserved < MIN_CALL_SECONDS) {
      const own = limits.studentSecondsPerDay - before.student < MIN_CALL_SECONDS;
      return reply(
        {
          error: own
            ? `You've used today's ${Math.round(limits.studentSecondsPerDay / 60)} live minutes. They come back tomorrow, and the AI Examiner is open any time.`
            : "The live partner is fully booked for today. Try again tomorrow, or practise with the AI Examiner.",
          reason: own ? "student-limit" : "global-limit",
        },
        429,
      );
    }

    const guard = await guardAi(userId, "realtime-speaking");
    if (!guard.ok)
      return reply({ error: "You've started the most live calls for today. Try again tomorrow, or use the AI Examiner.", reason: "call-limit" }, 429);

    row = await insertReservation({ studentId: student.id, reservedSec: reserved, mode, topicId: topic.id, now });
    const withRow = usageOf(await todayCalls(now), student.id, now);
    const over = capExceeded(limits, withRow.student, withRow.global);
    if (over) {
      await deleteReservation(row.id);
      return reply(
        {
          error:
            over === "student"
              ? "Another call is using your live minutes right now. End it first, or try again in a moment."
              : "The live partner is fully booked for today. Try again tomorrow, or practise with the AI Examiner.",
          reason: over === "student" ? "student-limit" : "global-limit",
        },
        429,
      );
    }
    remainingAfter = remainingSeconds(limits, withRow.student, withRow.global);
  } catch (e) {
    console.error("Live call reservation failed", e instanceof Error ? e.name : "unknown");
    return reply({ error: "Live partner isn't available right now. Try again in a moment." }, 503);
  }

  const level = await studentPeerLevel(student).catch(() => ({ band: 5, cefr: cefrForBand(5) }));
  const session = buildSessionConfig({
    instructions: buildLiveInstructions({ mode, topic, level, resumed }),
    model: realtimeModel(),
    transcribeModel: realtimeTranscribeModel(),
    voice: realtimeVoice(),
  });

  let created: { callId: string; answer: string };
  try {
    created = await createRealtimeCall({ sdp, session, userId });
  } catch (e) {
    await deleteReservation(row.id).catch(() => undefined);
    console.error("Live call create failed", e instanceof RealtimeError ? e.status : e instanceof Error ? e.name : "unknown");
    return reply({ error: "The live partner didn't pick up. Check your connection and try again." }, 502);
  }

  try {
    if (!(await attachCallId(row, created.callId))) {
      await hangupRealtimeCall(created.callId);
      return reply({ error: "Another live call started on your account. Try again." }, 409);
    }
  } catch (e) {
    await hangupRealtimeCall(created.callId);
    await deleteReservation(row.id).catch(() => undefined);
    console.error("Live call attach failed", e instanceof Error ? e.name : "unknown");
    return reply({ error: "Live partner isn't available right now. Try again in a moment." }, 503);
  }

  // Server-side hard stop: runs after the response, inside the same function invocation.
  const rowId = row.id;
  after(async () => {
    await sleep((reserved + HARD_STOP_GRACE_SECONDS) * 1000);
    await hardStop(rowId);
  });

  return new Response(created.answer, {
    status: 201,
    headers: {
      "Content-Type": "application/sdp",
      "Cache-Control": "private, no-store",
      "X-Live-Call": row.id,
      "X-Live-Seconds": String(reserved),
      "X-Live-Remaining": String(remainingAfter),
      // The chosen topic ("Surprise me" is picked here), URI-encoded for the header.
      "X-Live-Topic": encodeURIComponent(topic.label),
    },
  });
}
