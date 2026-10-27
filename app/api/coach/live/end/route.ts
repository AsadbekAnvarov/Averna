import { z } from "zod";
import { boundedJson } from "@/lib/security/json-body";
import { reply, liveStudent } from "@/lib/realtime/http";
import { liveLimits, remainingSeconds } from "@/lib/realtime/limits";
import { finishCall, findCall, usageToday } from "@/lib/realtime/live-store";
import { LIVE_XP_HOLD_TEXT, awardLiveCall } from "@/lib/realtime/live-xp";

export const dynamic = "force-dynamic";

/**
 * POST { id, reason?, speechSec?, words? } — the student ended a live call (or it hit
 * its limit, or the network dropped it). Settles the call to the server-measured length
 * (never the client's), hangs it up at OpenAI, and awards XP when the student spoke at
 * least a minute (lib/realtime/live-xp.ts). Idempotent: a repeat changes nothing.
 * The page also sends it with keepalive on pagehide (without stats → no XP).
 */
const endSchema = z.object({
  id: z.string().min(1).max(64),
  reason: z.enum(["student", "limit", "network"]).default("student"),
  speechSec: z.number().finite().min(0).max(3600).optional(),
  words: z.number().int().min(0).max(20_000).optional(),
});

export async function POST(request: Request) {
  const gate = await liveStudent(request);
  if (!gate.ok) return gate.res;
  const { student } = gate.who;

  let raw: unknown;
  try {
    raw = await boundedJson(request, 4_000);
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }
  const parsed = endSchema.safeParse(raw);
  if (!parsed.success) return reply({ error: "Invalid request." }, 400);
  const { id, reason, speechSec } = parsed.data;

  try {
    const row = await findCall(id);
    if (!row || row.studentId !== student.id) return reply({ error: "That call wasn't found." }, 404);
    const done = await finishCall(row, reason);
    const xp =
      speechSec != null
        ? await awardLiveCall({ callRowId: row.id, studentId: student.id, speechSec, callSec: done.seconds, mode: row.details.mode })
        : { xp: 0, hold: null };
    const usage = await usageToday(student.id);
    return reply({
      ok: true,
      seconds: done.seconds,
      xp: xp.xp,
      xpNote: xp.hold ? LIVE_XP_HOLD_TEXT[xp.hold] : null,
      remainingSec: remainingSeconds(liveLimits(), usage.student, usage.global),
    });
  } catch (e) {
    console.error("Live call end failed", e instanceof Error ? e.name : "unknown");
    return reply({ error: "The call ended, but it couldn't be saved. Your summary is still here." }, 503);
  }
}
