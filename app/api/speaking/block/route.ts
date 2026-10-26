import { db } from "@/lib/db";
import { boundedJson } from "@/lib/security/json-body";
import { trustedMutation } from "@/lib/security/same-origin";
import { endRoomBy } from "@/lib/speaking/room-end";
import { reply, roomMember } from "@/lib/speaking/room-member";

export const dynamic = "force-dynamic";

/**
 * POST { roomId } — block the partner of a peer room (docs/peer-speaking.md, Phase C).
 * Members only. Matching never pairs the two again (either direction). An ACTIVE room
 * ends through the session state machine (`end` by the blocker), so both clients see done.
 *   → { ok: true, state?, version? } (the ended state when this call ended the room)
 */
export async function POST(request: Request) {
  if (!trustedMutation(request)) return reply({ error: "Untrusted origin" }, 403);
  let body: Record<string, unknown>;
  try {
    const raw = await boundedJson(request, 500);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("shape");
    body = raw as Record<string, unknown>;
  } catch {
    return reply({ error: "Invalid request" }, 400);
  }
  try {
    const m = await roomMember(body.roomId);
    if (m.fail) return m.fail;
    await db.speakingBlock.upsert({
      where: { blockerId_blockedId: { blockerId: m.studentId, blockedId: m.partnerId } },
      create: { blockerId: m.studentId, blockedId: m.partnerId },
      update: {},
    });
    const ended = m.room.status === "ACTIVE" ? await endRoomBy(m.room, m.seat) : null;
    return reply({ ok: true, ...(ended ?? {}) });
  } catch (e) {
    console.error("Peer block failed", e instanceof Error ? e.name : "unknown");
    return reply({ error: "Blocking didn't work. Try again." }, 503);
  }
}
