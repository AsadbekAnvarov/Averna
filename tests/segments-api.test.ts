// @vitest-environment node
import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  resolve: vi.fn(),
  save: vi.fn(),
  load: vi.fn(),
  revalidate: vi.fn(),
  audioRow: vi.fn(),
  user: vi.fn(),
  writes: [] as string[],
}));
vi.mock("@/lib/auth", () => ({ requireTeacherOrAdmin: m.auth }));
vi.mock("next/cache", () => ({ revalidateTag: m.revalidate }));
vi.mock("@/lib/ielts/catalog", () => ({ EXAM_CATALOG_TAG: "exam-catalog" }));
vi.mock("@/lib/db", () => ({
  db: {
    listeningAudio: { findUnique: m.audioRow, update: () => m.writes.push("listening_audio"), upsert: () => m.writes.push("listening_audio") },
    generatedTest: { update: () => m.writes.push("generated_test") },
    user: { findUnique: m.user },
  },
}));
vi.mock("@/lib/ielts/audio/store", () => ({ resolveSegmentsTest: m.resolve, boundaryInfoOf: () => ({ revision: 1 }) }));
vi.mock("@/lib/ielts/segments-store", () => ({ saveSegments: m.save, loadSegmentRecords: m.load }));

import { PUT } from "@/app/api/admin/listening-audio/segments/route";
import { segmentRanges, segmentsFromBoundaries } from "@/lib/ielts/segments";

const SHA = "d".repeat(64);
const D = 1_600_000;
const PAPER = {
  id: "cdi-v10-listening-04",
  recordingMode: "whole",
  recordingSha256: SHA,
  recordingDurationMs: D,
  parts: [0, 1, 2, 3].map(() => ({ groups: [] })),
  evidenceWindows: {},
};

function body(over: Record<string, unknown> = {}) {
  const segments = segmentsFromBoundaries([400_000, 800_000, 1_200_000], D);
  const frames = Math.round(D / 24);
  const offsets = Array.from({ length: frames + 1 }, (_, i) => 100 + i * 576);
  return {
    testId: PAPER.id,
    revision: 0,
    confirm: true,
    segments,
    index: { fileSha256: SHA, sampleRate: 48000, samplesPerFrame: 1152, ranges: segmentRanges({ offsets, frames, frameMs: 24 }, segments) },
    ...over,
  };
}

const req = (b: unknown) => new Request("http://x/api/admin/listening-audio/segments", { method: "PUT", body: JSON.stringify(b), headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  m.writes.length = 0;
  m.auth.mockResolvedValue({ id: "staff-1", role: "ADMIN" });
  m.resolve.mockResolvedValue(PAPER);
  m.audioRow.mockResolvedValue({ bytes: 1e9, url: "https://x.github.io/a.mp3", status: "ready" });
  m.save.mockResolvedValue({ ok: true, next: { revision: 1 }, verified: true });
  m.load.mockResolvedValue(new Map());
  m.user.mockResolvedValue({ name: "Staff", email: "s@x" });
});

describe("PUT /api/admin/listening-audio/segments", () => {
  it("saves, confirms and revalidates the catalog (11.4, 12.5)", async () => {
    const res = await PUT(req(body()));
    expect(res.status).toBe(200);
    expect(m.save).toHaveBeenCalledWith(expect.objectContaining({ testId: PAPER.id, actorId: "staff-1", confirm: true }));
    expect(m.revalidate).toHaveBeenCalledWith("exam-catalog");
    expect(m.writes).toEqual([]);
  });

  it("checks session, role, body, paper and rules in that order (11.6)", async () => {
    m.auth.mockRejectedValueOnce(new Error("Unauthorized"));
    expect((await PUT(req(body()))).status).toBe(401);
    m.auth.mockRejectedValueOnce(new Error("Forbidden: Insufficient permissions"));
    expect((await PUT(req(body()))).status).toBe(403);
    expect((await PUT(req({ ...body(), extra: 1 }))).status).toBe(400);
    m.resolve.mockResolvedValueOnce(null);
    expect((await PUT(req(body()))).status).toBe(404);
    const bad = segmentsFromBoundaries([100_000, 800_000, 1_200_000], D);
    const res = await PUT(req(body({ segments: bad })));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("min-length");
    expect((await PUT(req(body({ index: { ...body().index, fileSha256: "e".repeat(64) } })))).status).toBe(422);
    m.save.mockResolvedValueOnce({ ok: false, reason: "conflict" });
    expect((await PUT(req(body()))).status).toBe(409);
  });

  // Feature: new-tests-articles-listening-parts, Property 18: Rejected requests write nothing
  it("never writes for rejected requests", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("signed-out", "student", "schema", "unknown", "rules"),
        fc.integer({ min: 0, max: 119_999 }),
        async (why, short) => {
          m.save.mockClear();
          if (why === "signed-out") m.auth.mockRejectedValueOnce(new Error("Unauthorized"));
          if (why === "student") m.auth.mockRejectedValueOnce(new Error("Forbidden: Insufficient permissions"));
          if (why === "unknown") m.resolve.mockResolvedValueOnce(null);
          const b = why === "schema" ? { ...body(), revision: -1 } : why === "rules" ? body({ segments: segmentsFromBoundaries([short + 1, 800_000, 1_200_000], D) }) : body();
          const res = await PUT(req(b));
          expect(res.status).toBeGreaterThanOrEqual(400);
          expect(res.status).toBeLessThan(500);
          expect(m.save).not.toHaveBeenCalled();
          expect(m.writes).toEqual([]);
        },
      ),
      { numRuns: 60 },
    );
  });

  // Feature: new-tests-articles-listening-parts, Property 16: Saving boundaries never touches the paper or the recording
  it("only writes through saveSegments (never the paper or listening_audio)", async () => {
    for (let i = 0; i < 5; i++) await PUT(req(body({ revision: i })));
    expect(m.writes).toEqual([]);
    expect(m.save).toHaveBeenCalledTimes(5);
  });
});
