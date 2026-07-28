import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordLearningEvent, tashkentParts, type Channel, type SkillKey } from "@/lib/engine/learning-dna";

export const dynamic = "force-dynamic";

/**
 * Sensor ingest for signals only the browser can observe.
 *
 * Two things the server genuinely cannot see on its own, and which the Learning
 * DNA Engine needs:
 *
 *  - `focus`   — a completed focus/Pomodoro sprint. This is the measurement that
 *                turns the attention-span curve from a by-product of test timings
 *                into a real signal about concentration.
 *  - `checkin` — the student's own read on their confidence. Self-report outweighs
 *                anything the engine can infer, so it deserves a first-class path.
 *
 * TRUST MODEL — the reason this endpoint is narrow rather than general:
 *
 *  1. Only the two kinds above are accepted. A client must never be able to post
 *     a `test` event, because `accuracy` drives the whole profile and a
 *     self-reported score would let anyone fabricate their Learning DNA.
 *  2. `accuracy` is never accepted from the client at all. Correctness is only
 *     ever established server-side, in the submit routes.
 *  3. Durations are clamped, and each kind has a per-day ceiling — so a script
 *     can't flood the stream and skew the statistics.
 */

const ALLOWED_KINDS = ["focus", "checkin"] as const;
type AllowedKind = (typeof ALLOWED_KINDS)[number];

const ALLOWED_CHANNELS: Channel[] = [
  "reading",
  "audio",
  "writing",
  "speaking",
  "flashcard",
  "conversation",
  "video",
  "grammar",
];

const ALLOWED_SKILLS: SkillKey[] = [
  "READING",
  "LISTENING",
  "WRITING",
  "SPEAKING",
  "GRAMMAR",
  "VOCABULARY",
];

/** Per-day ceilings. Generous for honest use, tight enough to stop flooding. */
const DAILY_CAP: Record<AllowedKind, number> = {
  focus: 24, // a 24-sprint day is already implausible
  checkin: 6,
};

/** A focus sprint shorter than this is noise, not a session. */
const MIN_FOCUS_MINUTES = 3;
const MAX_FOCUS_MINUTES = 180;

interface ParsedEvent {
  kind: AllowedKind;
  channel: Channel;
  skill: SkillKey | null;
  durationMin: number | null;
  confidence: number | null;
  errorTags: string[];
}

function parse(raw: unknown): { event: ParsedEvent } | { error: string } {
  const body = raw as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return { error: "Invalid body" };

  const kind = body.kind as AllowedKind;
  if (!ALLOWED_KINDS.includes(kind)) {
    return { error: `Unsupported event kind. Accepted: ${ALLOWED_KINDS.join(", ")}` };
  }

  const channelRaw = body.channel;
  const channel = ALLOWED_CHANNELS.includes(channelRaw as Channel)
    ? (channelRaw as Channel)
    : kind === "checkin"
      ? "conversation"
      : null;
  if (!channel) return { error: "Invalid channel" };

  const skillRaw = body.skill;
  const skill = ALLOWED_SKILLS.includes(skillRaw as SkillKey) ? (skillRaw as SkillKey) : null;

  let durationMin: number | null = null;
  if (kind === "focus") {
    const value = Number(body.durationMin);
    if (!Number.isFinite(value) || value < MIN_FOCUS_MINUTES) {
      return { error: `A focus session must be at least ${MIN_FOCUS_MINUTES} minutes` };
    }
    durationMin = Math.min(MAX_FOCUS_MINUTES, Math.round(value));
  }

  let confidence: number | null = null;
  if (kind === "checkin") {
    const value = Number(body.confidence);
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      return { error: "confidence must be a number between 0 and 1" };
    }
    confidence = value;
  }

  // Mistake categories a learner can legitimately self-report after a session.
  const tagsRaw = Array.isArray(body.errorTags) ? body.errorTags : [];
  const errorTags = tagsRaw
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim().toLowerCase().slice(0, 40))
    .filter((t) => /^[a-z_]+$/.test(t))
    .slice(0, 5);

  return { event: { kind, channel, skill, durationMin, confidence, errorTags } };
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const student = await db.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const parsed = parse(await req.json().catch(() => null));
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { event } = parsed;

    // Per-day ceiling, counted on the Tashkent calendar day so the limit resets
    // when the student's day does — not at UTC midnight, which is 05:00 for them.
    const dayKey = tashkentParts(new Date()).dayKey;
    const todayCount = await db.learningEvent
      .count({ where: { studentId: student.id, kind: event.kind, dayKey } })
      .catch(() => 0);

    if (todayCount >= DAILY_CAP[event.kind]) {
      return NextResponse.json(
        { error: "You've already logged plenty of these today — it resets tomorrow." },
        { status: 429 }
      );
    }

    await recordLearningEvent({
      studentId: student.id,
      kind: event.kind,
      channel: event.channel,
      skill: event.skill,
      // Never taken from the client: correctness is established server-side only.
      accuracy: null,
      durationMin: event.durationMin,
      confidence: event.confidence,
      errorTags: event.errorTags,
    });

    // The profile itself is refreshed lazily on read, so this stays a fast write.
    return NextResponse.json({ ok: true, recorded: event.kind });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record event";
    console.error("Learning DNA event error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
