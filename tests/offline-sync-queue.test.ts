/**
 * The grade queue (lib/offline/sync-queue.ts, idea 7): order, idempotent replay against the
 * server's decision rule (lib/srs-sync.ts), failures keep grades, grades queued during a sync
 * are never lost.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Rating } from "@/lib/srs";
import { replayGrades, type ExistingReview } from "@/lib/srs-sync";
import { drainQueue, enqueue, memoryQueue, nextBatch, pendingFor, requestBody, settle, type QueuedGrade } from "@/lib/offline/sync-queue";

const NOW = Date.parse("2026-05-12T09:00:00Z");
const grade = (id: string, extra: Partial<QueuedGrade> = {}): QueuedGrade => ({
  id,
  ownerId: "u1",
  itemKey: `w${id}`,
  rating: "good",
  source: "vocab",
  reviewedAt: NOW,
  attempts: 0,
  ...extra,
});

/** A model of POST /api/srs/review: the same per-review rule, applied to a ledger. */
function server(initial: Record<string, ExistingReview> = {}) {
  const s = {
    ledger: { ...initial },
    calls: 0,
    send: async (batch: QueuedGrade[]) => {
      s.calls += 1;
      s.ledger = replayGrades(s.ledger, batch, NOW + 60_000);
      return batch.map((g) => g.id);
    },
  };
  return s;
}

describe("queue operations", () => {
  it("keeps grades in the order they were made and ignores a re-queued id", () => {
    let q: QueuedGrade[] = [];
    q = enqueue(q, grade("a"));
    q = enqueue(q, grade("b"));
    q = enqueue(q, grade("a", { rating: "again" }));
    expect(q.map((g) => g.id)).toEqual(["a", "b"]);
    expect(q[0].rating).toBe("good");
  });

  it("sends only the signed-in user's grades, oldest first, in batches", () => {
    const q = [grade("a"), grade("b", { ownerId: "u2" }), grade("c"), grade("d")];
    expect(pendingFor(q, "u1").map((g) => g.id)).toEqual(["a", "c", "d"]);
    expect(nextBatch(q, "u1", 2).map((g) => g.id)).toEqual(["a", "c"]);
    expect(requestBody([grade("a")])).toEqual({ reviews: [{ itemKey: "wa", rating: "good", source: "vocab", clientId: "a", reviewedAt: NOW }] });
  });

  it("settle drops answered grades and counts an attempt on the rest of the batch", () => {
    const q = [grade("a"), grade("b"), grade("c")];
    const next = settle(q, ["a", "b"], ["a"]);
    expect(next.map((g) => [g.id, g.attempts])).toEqual([["b", 1], ["c", 0]]);
  });

  it("a failed request keeps every grade (with one more attempt) and stops", async () => {
    const io = memoryQueue([grade("a"), grade("b")]);
    const result = await drainQueue(io, "u1", async () => {
      throw new Error("offline");
    });
    expect(result.failed).toBe(true);
    expect(result.synced).toBe(0);
    expect(io.items.map((g) => [g.id, g.attempts])).toEqual([["a", 1], ["b", 1]]);
  });

  it("grades queued while a request is in flight are kept and sent next", async () => {
    const io = memoryQueue([grade("a")]);
    const seen: string[][] = [];
    await drainQueue(io, "u1", async (batch) => {
      seen.push(batch.map((g) => g.id));
      if (seen.length === 1) io.write(enqueue(io.read(), grade("b")));
      return batch.map((g) => g.id);
    });
    expect(seen).toEqual([["a"], ["b"]]);
    expect(io.items).toEqual([]);
  });

  it("leaves another user's grades alone", async () => {
    const io = memoryQueue([grade("a"), grade("x", { ownerId: "u2" })]);
    const s = server();
    await drainQueue(io, "u1", s.send);
    expect(io.items.map((g) => g.id)).toEqual(["x"]);
  });
});

// --- property tests ---------------------------------------------------------------------------

const rating = fc.constantFrom<Rating>("again", "hard", "good", "easy");
/** A device's grades: a few cards, increasing moments (as they are made on one device). */
const grades = fc
  .array(fc.record({ card: fc.integer({ min: 0, max: 4 }), rating, gap: fc.integer({ min: 1, max: 3 * 86_400_000 }) }), { minLength: 1, maxLength: 30 })
  .map((list) => {
    let at = NOW - 20 * 86_400_000;
    return list.map((g, i) => {
      at += g.gap;
      return grade(`g${i}`, { itemKey: `card-${g.card}`, rating: g.rating, reviewedAt: Math.min(at, NOW) + i });
    });
  });

describe("properties", () => {
  it("drains every grade in order, whatever the batch size", async () => {
    await fc.assert(
      fc.asyncProperty(grades, fc.integer({ min: 1, max: 8 }), async (list, size) => {
        const io = memoryQueue(list);
        const sent: string[] = [];
        const result = await drainQueue(io, "u1", async (batch) => (sent.push(...batch.map((g) => g.id)), batch.map((g) => g.id)), size);
        return !result.failed && result.synced === list.length && io.items.length === 0 && sent.join() === list.map((g) => g.id).join();
      }),
      { numRuns: 100 },
    );
  });

  it("replaying the same queue twice leaves the server exactly where one replay did", async () => {
    await fc.assert(
      fc.asyncProperty(grades, fc.integer({ min: 1, max: 8 }), async (list, size) => {
        const once = server();
        await drainQueue(memoryQueue(list), "u1", once.send, size);
        const twice = server();
        await drainQueue(memoryQueue(list), "u1", twice.send, size);
        await drainQueue(memoryQueue(list), "u1", twice.send, size); // e.g. the response was lost: the device sends again
        expect(twice.ledger).toEqual(once.ledger);
        return true;
      }),
      { numRuns: 100 },
    );
  });

  it("a failure partway keeps the unsent grades in order; retrying reaches the same server state", async () => {
    await fc.assert(
      fc.asyncProperty(grades, fc.integer({ min: 1, max: 5 }), fc.nat(10), async (list, size, failAt) => {
        const reference = server();
        await drainQueue(memoryQueue(list), "u1", reference.send, size);

        const flaky = server();
        const io = memoryQueue(list);
        let call = 0;
        const first = await drainQueue(
          io,
          "u1",
          async (batch) => {
            if (call++ === failAt) throw new Error("network");
            return flaky.send(batch);
          },
          size,
        );
        const sentBeforeFailure = list.length - io.items.length;
        const keptInOrder = io.items.map((g) => g.id).join() === list.slice(sentBeforeFailure).map((g) => g.id).join();
        await drainQueue(io, "u1", flaky.send, size);
        expect(flaky.ledger).toEqual(reference.ledger);
        return keptInOrder && (first.failed ? first.synced === sentBeforeFailure : io.items.length === 0);
      }),
      { numRuns: 100 },
    );
  });
});
