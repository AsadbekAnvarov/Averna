// @vitest-environment node
import fc from "fast-check";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const plan = require("../scripts/cdi-apply-plan.cjs") as {
  REQUIRED_SCHEMA: string[];
  missingColumns(c: string[]): string[];
  planApply(items: unknown[], rows: unknown[]): { ok: true; steps: { id: string; action: string }[] } | { ok: false; conflicts: { id: string; reason: string }[] };
  nextSegmentsRow(existing: unknown, item: unknown): Record<string, unknown>;
  audioRow(item: unknown): Record<string, unknown>;
  planPublish(ids: string[], rows: unknown[], audio: unknown[], publish: boolean): { ok: string[]; refused: { id: string; reason: string }[] };
};

const item = (id: string, module = "LISTENING", file = `${id}.html`) => ({ id, module, source: { file }, audio: { sha256: "a".repeat(64), durationMs: 1_500_000, url: "https://x.github.io/a.mp3", bytes: 9, scriptHash: "h", partIndex: -1 }, boundaryCandidates: [null, null, null] });
const row = (id: string, o: Partial<{ published: boolean; provider: string; module: string; file: string }> = {}) => ({
  id,
  module: o.module ?? "LISTENING",
  published: o.published ?? false,
  data: { imported: { provider: o.provider ?? "user-supplied-cdi", file: o.file ?? `${id}.html` } },
});

describe("apply plan", () => {
  // Feature: new-tests-articles-listening-parts, Property 36: The apply plan is all-or-nothing on conflicts and idempotent
  it("writes nothing when any id conflicts, otherwise only manifest ids", () => {
    const kinds = fc.constantFrom("none", "ok", "published", "foreign", "module", "file");
    fc.assert(
      fc.property(fc.array(kinds, { minLength: 1, maxLength: 8 }), (states) => {
        const items = states.map((_, i) => item(`cdi-v10-listening-${String(i + 1).padStart(2, "0")}`));
        const rows = states.flatMap((s, i) => {
          const id = items[i].id;
          if (s === "none") return [];
          if (s === "ok") return [row(id)];
          if (s === "published") return [row(id, { published: true })];
          if (s === "foreign") return [row(id, { provider: "manual" })];
          if (s === "module") return [row(id, { module: "READING" })];
          return [row(id, { file: "other.html" })];
        });
        const p = plan.planApply(items, rows);
        const bad = states.filter((s) => !["none", "ok"].includes(s)).length;
        expect(p.ok).toBe(bad === 0);
        if (p.ok) expect(p.steps.map((s) => s.id)).toEqual(items.map((i) => i.id));
        else expect(p.conflicts.length).toBe(bad);
      }),
      { numRuns: 200 },
    );
    // Applying twice: the second run only updates (one paper and one recording row per id).
    const items = [item("cdi-v10-listening-01")];
    expect(plan.planApply(items, [row("cdi-v10-listening-01")])).toEqual({ ok: true, steps: [{ id: "cdi-v10-listening-01", action: "update" }] });
    expect(plan.audioRow(items[0])).toMatchObject({ status: "ready", url: "https://x.github.io/a.mp3", timeline: [] });
  });

  it("names the missing columns of listening_part_segments (20.6)", () => {
    expect(plan.missingColumns(plan.REQUIRED_SCHEMA)).toEqual([]);
    expect(plan.missingColumns(["testId", "revision"])).toContain("segments");
  });

  // Feature: new-tests-articles-listening-parts, Property 37: Re-applying keeps or resets boundaries by fingerprint
  it("keeps verified boundaries for the same recording and resets them for another", () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.integer({ min: 0, max: 9 }), (sameSha, sameDuration, revision) => {
        const it0 = item("cdi-v10-listening-02");
        const existing = { recordingSha256: sameSha ? it0.audio.sha256 : "b".repeat(64), durationMs: sameDuration ? it0.audio.durationMs : 1, segments: { v: 1 }, verifiedAt: new Date(0), verifiedById: "u1", revision };
        const next = plan.nextSegmentsRow(existing, it0);
        if (sameSha && sameDuration) {
          expect(next).toMatchObject({ segments: { v: 1 }, verifiedById: "u1", revision });
          expect(next.warning).toBeUndefined();
        } else {
          expect(next).toMatchObject({ segments: null, verifiedAt: null, verifiedById: null, revision: revision + 1, recordingSha256: it0.audio.sha256 });
          expect(String(next.warning)).toContain("cdi-v10-listening-02");
        }
      }),
      { numRuns: 50 },
    );
    expect(plan.nextSegmentsRow(null, item("x"))).toMatchObject({ segments: null, revision: 0 });
  });

  // Feature: new-tests-articles-listening-parts, Property 39: Publishing touches only listed eligible papers
  it("publishes only listed CDI imports (Listening with a ready recording)", () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom("reading", "listening-ready", "listening-missing", "foreign", "writing", "absent"), { minLength: 1, maxLength: 8 }), fc.boolean(), (states, publish) => {
        const ids = states.map((_, i) => `cdi-v10-x-${i}`);
        const rows = states.flatMap((s, i) =>
          s === "absent" ? [] : [row(ids[i], { module: s === "reading" ? "READING" : s === "writing" ? "WRITING" : "LISTENING", provider: s === "foreign" ? "manual" : "user-supplied-cdi" })],
        );
        const audio = states.flatMap((s, i) => (s === "listening-ready" ? [{ testId: ids[i], partIndex: -1, status: "ready", url: "https://x/a.mp3", durationMs: 5 }] : []));
        const p = plan.planPublish(ids, rows, audio, publish);
        const expected = ids.filter((_, i) => states[i] === "reading" || states[i] === "listening-ready" || (!publish && states[i] === "listening-missing"));
        expect(p.ok).toEqual(expected);
        expect(p.ok.length + p.refused.length).toBe(ids.length);
      }),
      { numRuns: 100 },
    );
  });
});
