/**
 * The grade queue (idea 7): flashcard grades waiting to reach POST /api/srs/review.
 *
 * Every grade is queued first and sent in the background, so the card advances at once
 * and nothing is lost when the connection drops. Each grade carries a client id and the
 * moment it was made; the server ignores replays (lib/srs-sync.ts), so sending the same
 * grades twice is harmless. Grades belong to the user who made them and are only sent
 * while that user is signed in.
 *
 * Pure: plain arrays in, plain arrays out (persistence: lib/offline/queue-store.ts).
 */
import type { Rating } from "@/lib/srs";

export interface QueuedGrade {
  /** Client-made id (UUID). */
  id: string;
  /** The signed-in user who made the grade. */
  ownerId: string;
  itemKey: string;
  rating: Rating;
  source: "vocab" | "mistake";
  /** Epoch ms when the grade was made on the device. */
  reviewedAt: number;
  /** Failed send attempts so far. */
  attempts: number;
}

/** At most this many grades wait on one device (the oldest go first beyond it). */
export const QUEUE_MAX = 2000;
/** Grades per request: the review endpoint accepts up to 60. */
export const SYNC_BATCH = 60;

/** Adds a grade at the end. A grade whose id is already queued is ignored (enqueue is idempotent). */
export function enqueue(queue: readonly QueuedGrade[], grade: QueuedGrade): QueuedGrade[] {
  if (queue.some((g) => g.id === grade.id)) return [...queue];
  const next = [...queue, grade];
  return next.length > QUEUE_MAX ? next.slice(next.length - QUEUE_MAX) : next;
}

/** This user's grades, oldest first. */
export function pendingFor(queue: readonly QueuedGrade[], ownerId: string): QueuedGrade[] {
  return queue.filter((g) => g.ownerId === ownerId);
}

/** The next request's grades for this user, in queue order. */
export function nextBatch(queue: readonly QueuedGrade[], ownerId: string, size = SYNC_BATCH): QueuedGrade[] {
  return pendingFor(queue, ownerId).slice(0, Math.max(1, size));
}

/**
 * After a request: grades the server answered (`doneIds`, whatever their status) leave the
 * queue; grades that were sent but not answered stay, in order, with one more attempt.
 */
export function settle(queue: readonly QueuedGrade[], sentIds: readonly string[], doneIds: readonly string[]): QueuedGrade[] {
  const done = new Set(doneIds);
  const sent = new Set(sentIds);
  return queue.filter((g) => !done.has(g.id)).map((g) => (sent.has(g.id) ? { ...g, attempts: g.attempts + 1 } : g));
}

/** The request body for a batch (the review endpoint's batch form). */
export function requestBody(batch: readonly QueuedGrade[]) {
  return {
    reviews: batch.map((g) => ({ itemKey: g.itemKey, rating: g.rating, source: g.source, clientId: g.id, reviewedAt: g.reviewedAt })),
  };
}

/** Where the queue lives. Read again before every step, so grades queued during a sync are kept. */
export interface QueueIO {
  read: () => QueuedGrade[];
  write: (queue: QueuedGrade[]) => void;
}

/** An in-memory queue (tests, and a fallback when storage is blocked). */
export function memoryQueue(initial: readonly QueuedGrade[] = []): QueueIO & { items: QueuedGrade[] } {
  const io = {
    items: [...initial],
    read: () => [...io.items],
    write: (queue: QueuedGrade[]) => {
      io.items = [...queue];
    },
  };
  return io;
}

export interface DrainResult {
  /** Grades answered by the server. */
  synced: number;
  /** True when a request failed: the remaining grades are kept for the next try. */
  failed: boolean;
  /** The error `send` threw, if any. */
  error?: unknown;
}

/**
 * Sends this user's grades in batches, oldest first, until none are left or a request
 * fails. `send` returns the ids the server answered (whatever their status); it throws on a
 * network or server error, and the batch then stays queued with one more attempt.
 */
export async function drainQueue(
  io: QueueIO,
  ownerId: string,
  send: (batch: QueuedGrade[]) => Promise<string[]>,
  size = SYNC_BATCH,
): Promise<DrainResult> {
  let synced = 0;
  for (;;) {
    const batch = nextBatch(io.read(), ownerId, size);
    if (!batch.length) return { synced, failed: false };
    const ids = batch.map((g) => g.id);
    let done: string[];
    try {
      done = await send(batch);
    } catch (error) {
      io.write(settle(io.read(), ids, []));
      return { synced, failed: true, error };
    }
    const answered = done.filter((id) => ids.includes(id));
    io.write(settle(io.read(), ids, answered));
    synced += answered.length;
    // No progress (the server answered none of them): stop rather than loop.
    if (!answered.length) return { synced, failed: true };
  }
}
