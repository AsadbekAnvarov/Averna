// @vitest-environment node
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { convertSource } from "@/lib/cdi-import/pipeline";
import { evidenceWindows } from "@/lib/cdi-import/evidence-windows";
import { imageAlt } from "@/lib/cdi-import/images";
import { partEvidence, hearRange } from "@/lib/review/evidence";
import type { ExamListeningTest, GradeItem } from "@/lib/ielts/types";
import { PNG_1X1, listeningSource } from "./fixtures/cdi-v10/build";

const BASE = "https://example.github.io/averna-cdi-audio/";
const run = (file: string, html: string) => convertSource({ file, bytes: new TextEncoder().encode(html), mediaBase: BASE });

describe("Volume 10 Listening conversion", () => {
  it("unpacks the recording, builds 4 parts and scores the key 40/40 (4.1–4.4, 5.1, 5.3)", async () => {
    const f = listeningSource(2);
    const r = await run("Volume 10 test 3 listening.html", f.html);
    expect(r.errors).toEqual([]);
    expect(r.included).toBe(true);
    const p = r.paper as ExamListeningTest;
    expect(p).toMatchObject({ id: "cdi-v10-listening-03", title: "Volume 10 · Listening Test 3", recordingMode: "whole", difficulty: "Medium", source: "imported" });
    expect(p.parts.map((x) => x.groups.flatMap((g) => g.questions.map((q) => q.n)).length)).toEqual([10, 10, 10, 10]);
    expect(p.parts.map((x) => x.groups.map((g) => g.kind))).toEqual([["gap"], ["mcq", "matching"], ["matching", "mcq-multi", "mcq"], ["gap"]]);
    expect(r.key).toMatchObject({ first: 40, last: 40 });
    // Alternatives in source order (4.3).
    expect(p.parts[0].groups[0].questions[2].answer).toEqual(["8", "eight"]);
    // The recording is byte-identical, measured by its frames.
    const audio = r.media.find((m) => m.kind === "audio")!;
    expect(Buffer.from(audio.bytes).equals(Buffer.from(f.mp3))).toBe(true);
    expect(r.audio!.durationMs).toBe(p.recordingDurationMs);
    expect(p.recordingDurationMs).toBeGreaterThan(4500);
    // The textAnswerRules / instruction mismatch is kept and reported (4.12).
    expect(r.warnings.some((w) => /textAnswerRules/.test(w.message) && w.questions?.includes(31))).toBe(true);
  });

  it("reads a base64 recording as well (tests 1–2)", async () => {
    const r = await run("Volume 10 listening test 1.html", listeningSource(2, { packed: false }).html);
    expect(r.included).toBe(true);
  });

  it("excludes a paper whose unpacked length differs, and writes no media (5.2)", async () => {
    const r = await run("Volume 10 test 4 listening.html", listeningSource(2, { corruptLength: true }).html);
    expect(r.included).toBe(false);
    expect(r.media).toEqual([]);
    expect(r.errors[0].message).toMatch(/declared/);
  });

  // Feature: new-tests-articles-listening-parts, Property 6: Transcript markers become part-local bindings
  it("turns markers into marks of the right part, including the shared 13/14 marker", async () => {
    const f = listeningSource(5);
    const p = (await run("Volume 10 test 5 listening.html", f.html)).paper as ExamListeningTest;
    const part2 = p.parts[1];
    const shared = part2.script.find((l) => l.marks?.some((m) => m.n.includes(13) && m.n.includes(14)))!;
    expect(shared).toBeTruthy();
    for (const [i, part] of p.parts.entries()) {
      for (const l of part.script) {
        expect(l.text).not.toMatch(/WOMAN:|MAN:/);
        for (const m of l.marks ?? []) for (const n of m.n) expect(Math.ceil(n / 10)).toBe(i + 1);
      }
    }
    // partEvidence uses the marked span for wrong answers.
    const items = new Map<number, GradeItem>([[13, { n: 13, kind: "mcq", correct: false, given: "", expected: "A", accepted: ["A"] }]]);
    const ev = partEvidence(part2, items)[13];
    const line = part2.script[ev.paragraphIndex];
    const mark = line.marks!.find((m) => m.n.includes(13))!;
    expect([ev.start, ev.end]).toEqual([mark.start, mark.end]);
    expect(ev.source).toBe("quote");
  });

  // Feature: new-tests-articles-listening-parts, Property 7: Evidence windows are converted, filtered and played in range
  it("keeps windows exactly when 0 ≤ start < end ≤ D, and Hear it plays them with a 2 s lead-in", () => {
    fc.assert(
      fc.property(fc.double({ min: -5, max: 2000, noNaN: true }), fc.double({ min: -5, max: 2000, noNaN: true }), fc.integer({ min: 1000, max: 1_800_000 }), (s, e, D) => {
        const warnings: never[] = [];
        const w = evidenceWindows([{ questions: [7], start: s, end: e }], D, "f", warnings);
        const startMs = Math.round(s * 1000);
        const endMs = Math.round(e * 1000);
        const ok = startMs >= 0 && startMs < endMs && endMs <= D;
        expect(!!w["7"]).toBe(ok);
        if (ok) {
          expect(w["7"]).toEqual({ startMs, endMs });
          const h = hearRange(w["7"]);
          expect(h.fromMs).toBe(Math.max(0, startMs - 2000));
          expect(h.untilMs).toBeLessThanOrEqual(endMs + 500);
        } else expect(warnings.length).toBe(1);
      }),
      { numRuns: 200 },
    );
  });

  it("drops a window past the end of the recording but keeps the paper (4.13)", async () => {
    const r = await run("Volume 10 test 6 listening.html", listeningSource(6, { badWindow: true }).html);
    expect(r.included).toBe(true);
    expect((r.paper as ExamListeningTest).evidenceWindows?.["40"]).toBeUndefined();
    expect(r.warnings.some((w) => w.questions?.includes(40))).toBe(true);
  });

  // Feature: new-tests-articles-listening-parts, Property 8: Question images are byte-identical and described
  it("extracts the PNG unchanged and describes it in English within 200 characters", async () => {
    const r = await run("Volume 10 test 3 listening.html", listeningSource(7).html);
    const img = r.media.find((m) => m.kind === "image")!;
    expect(Buffer.from(img.bytes).equals(PNG_1X1)).toBe(true);
    const group = (r.paper as ExamListeningTest).parts[1].groups[1];
    expect(group.images?.[0].url).toBe(`cdi-asset://${img.path}`);
    expect(group.images?.[0].alt).toMatch(/^Map for Questions 16–20\./);
    fc.assert(
      fc.property(fc.string({ maxLength: 1000 }), fc.integer({ min: 1, max: 39 }), (alt, from) => {
        const a = imageAlt("Diagram", from, from + 1, alt);
        expect(a.length).toBeGreaterThan(0);
        expect(a.length).toBeLessThanOrEqual(200);
        expect(a).not.toMatch(/[\u0400-\u04FF]/);
        expect(a).toContain(`Questions ${from}–${from + 1}`);
        expect(a).toContain("Diagram");
      }),
      { numRuns: 100 },
    );
  });

  // Feature: new-tests-articles-listening-parts, Property 12: Source references disqualify a paper
  it("excludes a paper whose content mentions IELTS_Volume or a t.me link", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("IELTS_Volume", "ielts_volume", "t.me/somewhere"), async (bad) => {
        const html = listeningSource(8).html.replace("Listen and answer questions 11–20.", "x").replace(/(<p class="note-line"[^>]*>)/, `$1${bad} `);
        const r = await run("Volume 10 test 2 listening.html", html);
        expect(r.included).toBe(false);
        expect(r.errors.some((e) => /Source reference/.test(e.message))).toBe(true);
      }),
      { numRuns: 6 },
    );
  });
});
