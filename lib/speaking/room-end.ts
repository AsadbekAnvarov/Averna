/** Side effects of a peer room reaching done, and ending a room on a block (docs/peer-speaking.md). Server only. */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { advance, isPeerSessionState, type PeerSessionState, type Seat } from "./session";

/** Best effort: the room's queue rows and WebRTC signals are no longer needed once it is done. Never throws. */
export async function cleanupEndedRoom(roomId: string): Promise<void> {
  await Promise.all([
    Promise.resolve()
      .then(() => db.speakingQueue.deleteMany({ where: { roomId } }))
      .catch(() => undefined),
    Promise.resolve()
      .then(() => db.speakingSignal.deleteMany({ where: { roomId } }))
      .catch(() => undefined),
  ]);
}

interface EndableRoom {
  id: string;
  status: string;
  state: unknown;
  version: number;
}

/**
 * End an ACTIVE room through the session state machine (`end` by `by`), with the same
 * optimistic version check as the session API; one retry on a lost race.
 * Returns the saved state/version, or null when the room was not active.
 */
export async function endRoomBy(room: EndableRoom, by: Seat, now = Date.now()): Promise<{ state: PeerSessionState; version: number } | null> {
  let current = room;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (current.status !== "ACTIVE") return null;
    const data: Prisma.SpeakingRoomUpdateManyMutationInput = { status: "ENDED", endedAt: new Date(now) };
    let next: PeerSessionState | null = null;
    if (isPeerSessionState(current.state)) {
      next = advance(current.state, "end", by, now);
      data.state = next as unknown as Prisma.InputJsonValue;
      data.version = current.version + 1;
    }
    const saved = await db.speakingRoom.updateMany({ where: { id: current.id, version: current.version, status: "ACTIVE" }, data });
    if (saved.count === 1) {
      await cleanupEndedRoom(current.id);
      return next ? { state: next, version: current.version + 1 } : null;
    }
    const latest = (await db.speakingRoom.findUnique({ where: { id: current.id } })) as EndableRoom | null;
    if (!latest) return null;
    current = latest;
  }
  return null;
}
