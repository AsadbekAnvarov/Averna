import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { boundedJson } from "@/lib/security/json-body";
import { trustedMutation } from "@/lib/security/same-origin";
import { CRITERIA, checkNote, feedbackDto, isRating, packTip, strengthById, tipById, type Ratings } from "@/lib/speaking/feedback-presets";
import { reply, roomMember } from "@/lib/speaking/room-member";
import { isPeerSessionState } from "@/lib/speaking/session";
import { feedbackAllowed } from "@/lib/speaking/session-view";

export const dynamic = "force-dynamic";

/**
 * Peer feedback, "give to get" (docs/peer-speaking.md, Phase C). Members of the room only.
 *   POST { roomId, fluency, lexical, grammar, pronunciation (1–5), strength?, tip?, note? }
 *        → about the partner, once per room, ENDED rooms whose first timed phase was reached.
 *   GET ?roomId= → { allowed, mine, received } — `received` is the partner's feedback only
 *        after I sent mine, else { locked: true, partnerSubmitted }.
 */

const select = { fluency: true, lexical: true, grammar: true, pronunciation: true, strength: true, tip: true, createdAt: true } as const;

async function payload(roomId: string, studentId: string, partnerId: string, allowed: boolean) {
  const [mine, theirs] = await Promise.all([
    db.speakingPeerFeedback.findUnique({ where: { roomId_fromStudentId: { roomId, fromStudentId: studentId } }, select }),
    db.speakingPeerFeedback.findUnique({ where: { roomId_fromStudentId: { roomId, fromStudentId: partnerId } }, select }),
  ]);
  return {
    allowed,
    mine: mine ? feedbackDto(mine) : null,
    received: mine ? (theirs ? feedbackDto(theirs) : null) : { locked: true, partnerSubmitted: !!theirs },
  };
}

export async function GET(request: NextRequest) {
  try {
    const m = await roomMember(request.nextUrl.searchParams.get("roomId"));
    if (m.fail) return m.fail;
    const state = isPeerSessionState(m.room.state) ? m.room.state : null;
    return reply(await payload(m.room.id, m.studentId, m.partnerId, feedbackAllowed(m.room.status, state)));
  } catch (e) {
    console.error("Peer feedback read failed", e instanceof Error ? e.name : "unknown");
    return reply({ error: "Feedback is unavailable right now." }, 503);
  }
}

const isUniqueViolation = (e: unknown) => !!e && typeof e === "object" && (e as { code?: unknown }).code === "P2002";

export async function POST(request: Request) {
  if (!trustedMutation(request)) return reply({ error: "Untrusted origin" }, 403);
  let body: Record<string, unknown>;
  try {
    const raw = await boundedJson(request, 2000);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("shape");
    body = raw as Record<string, unknown>;
  } catch {
    return reply({ error: "Invalid request" }, 400);
  }
  try {
    const m = await roomMember(body.roomId);
    if (m.fail) return m.fail;

    if (!CRITERIA.every((c) => isRating(body[c]))) return reply({ error: "Rate each of the four criteria from 1 to 5." }, 400);
    const strength = body.strength ?? null;
    const tip = body.tip ?? null;
    if (strength !== null && (typeof strength !== "string" || !strengthById(strength))) return reply({ error: "Choose a strength from the list." }, 400);
    if (tip !== null && (typeof tip !== "string" || !tipById(tip))) return reply({ error: "Choose a tip from the list." }, 400);
    const note = checkNote(body.note);
    if (!note.ok) return reply({ error: note.error }, 400);

    const state = isPeerSessionState(m.room.state) ? m.room.state : null;
    if (!feedbackAllowed(m.room.status, state)) return reply({ error: "Feedback opens when a started session has ended." }, 409);

    const ratings = Object.fromEntries(CRITERIA.map((c) => [c, body[c] as number])) as Ratings;
    try {
      await db.speakingPeerFeedback.create({
        data: {
          roomId: m.room.id,
          fromStudentId: m.studentId,
          toStudentId: m.partnerId,
          ...ratings,
          strength: strength as string | null,
          tip: packTip(tip as string | null, note.note),
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) return reply({ error: "You already sent feedback for this session.", ...(await payload(m.room.id, m.studentId, m.partnerId, true)) }, 409);
      throw e;
    }
    return reply(await payload(m.room.id, m.studentId, m.partnerId, true));
  } catch (e) {
    console.error("Peer feedback save failed", e instanceof Error ? e.name : "unknown");
    return reply({ error: "Feedback couldn't be saved. Try again." }, 503);
  }
}
