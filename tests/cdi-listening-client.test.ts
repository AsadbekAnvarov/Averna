import fs from "node:fs";
import path from "node:path";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import type { ExamAnswers, ExamListeningTest } from "@/lib/ielts/types";
import { DEFAULT_CDI_AUDIO_BASE, cdiAudioUrl } from "@/lib/ielts/cdi-audio";
import { toClientListening, toClientRecording, toReviewRecording } from "@/lib/ielts/sanitize";
import { estimateListeningMinutes, recordingWindows } from "@/lib/ielts/format";
import { expandOptional, gradeTest } from "@/lib/ielts/grading";

/**
 * CDI Listening tests (one real recording per test) as the browser gets them:
 * the recording's URL and public timing, and none of the secrets — no
 * transcript, answer key, explanation or question times — before submission.
 * The JSON files are read directly (the catalog is owned elsewhere).
 */

const DIR = path.join(path.resolve(__dirname, ".."), "lib", "ielts", "content", "cdi", "listening");
const files: { file: string; test: ExamListeningTest }[] = fs.existsSync(DIR)
  ? fs
      .readdirSync(DIR)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => ({ file: f, test: JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as ExamListeningTest }))
  : [];

const SECRET_KEYS = new Set(["answer", "explanation", "transcript", "audio", "questionTimes"]);

/** Every object key anywhere in `x`. */
function allKeys(x: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(x)) x.forEach((v) => allKeys(v, out));
  else if (x && typeof x === "object") {
    for (const [k, v] of Object.entries(x)) {
      out.add(k);
      allKeys(v, out);
    }
  }
  return out;
}

/** Every string value anywhere in `x`, skipping the subtrees under `skip` keys. */
function allStrings(x: unknown, skip: Set<string> = new Set(), out: string[] = []): string[] {
  if (typeof x === "string") out.push(x);
  else if (Array.isArray(x)) x.forEach((v) => allStrings(v, skip, out));
  else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) if (!skip.has(k)) allStrings(v, skip, out);
  return out;
}

function count(haystack: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  for (let i = haystack.indexOf(needle); i >= 0; i = haystack.indexOf(needle, i + needle.length)) n++;
  return n;
}

const gapAnswers = (test: ExamListeningTest): string[] =>
  test.parts.flatMap((p) => p.groups.filter((g) => g.kind === "gap").flatMap((g) => g.questions.flatMap((q) => q.answer)));

const savedBase = process.env.CDI_AUDIO_BASE_URL;
afterEach(() => {
  if (savedBase == null) delete process.env.CDI_AUDIO_BASE_URL;
  else process.env.CDI_AUDIO_BASE_URL = savedBase;
});

describe("cdiAudioUrl", () => {
  it("builds the default GitHub Pages URL and rejects anything but listening-N.mp3", () => {
    delete process.env.CDI_AUDIO_BASE_URL;
    expect(DEFAULT_CDI_AUDIO_BASE).toBe("https://asadbekanvarov.github.io/averna-cdi-audio/audio/");
    expect(cdiAudioUrl("listening-1.mp3")).toBe("https://asadbekanvarov.github.io/averna-cdi-audio/audio/listening-1.mp3");
    for (const bad of ["../listening-1.mp3", "listening-1.mp3?x=1", "listening-a.mp3", "reading-1.mp3", "listening-1.wav", "", null, 3]) {
      expect(cdiAudioUrl(bad)).toBeNull();
    }
  });

  it("uses CDI_AUDIO_BASE_URL with exactly one trailing slash", () => {
    process.env.CDI_AUDIO_BASE_URL = "https://cdn.example.com/cdi";
    expect(cdiAudioUrl("listening-12.mp3")).toBe("https://cdn.example.com/cdi/listening-12.mp3");
    process.env.CDI_AUDIO_BASE_URL = "https://cdn.example.com/cdi///";
    expect(cdiAudioUrl("listening-12.mp3")).toBe("https://cdn.example.com/cdi/listening-12.mp3");
    process.env.CDI_AUDIO_BASE_URL = "   ";
    expect(cdiAudioUrl("listening-12.mp3")).toBe(`${DEFAULT_CDI_AUDIO_BASE}listening-12.mp3`);
  });
});

describe("CDI Listening → client", () => {
  it("has the imported tests", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const { test } of files) expect(test.audio?.file).toMatch(/^listening-\d+\.mp3$/);
  });

  it.each(files.map((f) => [f.file, f.test] as const))("%s: the client gets the recording and no transcript, key or question times", (_f, test) => {
    const client = toClientListening(test);
    const keys = allKeys(client);
    for (const k of SECRET_KEYS) expect(keys.has(k)).toBe(false);
    expect(client.recording?.url).toBe(cdiAudioUrl(test.audio!.file));
    expect(Object.keys(client.recording ?? {}).every((k) => ["url", "durationSec", "partStarts"].includes(k))).toBe(true);
    if (test.audio?.durationSec) expect(client.recording?.durationSec).toBe(test.audio.durationSec);
    if (test.audio?.partStarts) expect(client.recording?.partStarts).toEqual(test.audio.partStarts);
    for (const p of client.parts) {
      expect(p.script).toEqual([]);
      expect(p.audio).toBeUndefined();
    }
    // The question paper itself is all there.
    expect(client.parts.flatMap((p) => p.groups.flatMap((g) => g.questions.map((q) => q.n)))).toEqual(
      test.parts.flatMap((p) => p.groups.flatMap((g) => g.questions.map((q) => q.n)))
    );
  });

  // **Validates: CDI Listening client conversion — no transcript text, gap answer or questionTimes reaches the client**
  it("property: no transcript line or gap answer reaches the client beyond what the question paper itself shows", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Math.max(0, files.length - 1) }),
        fc.array(fc.nat(), { minLength: 1, maxLength: 4 }),
        (fi, picks) => {
          const { test } = files[fi];
          const client = toClientListening(test);
          const clientText = allStrings(client).join("\n").toLowerCase();
          // What a student may see anyway: the paper (everything but the secrets) and the recording's URL.
          const paperText = [...allStrings(test, SECRET_KEYS), client.recording?.url ?? ""].join("\n").toLowerCase();
          const fullText = allStrings(test).join("\n").toLowerCase();

          for (const p of test.parts) {
            for (const line of (p.transcript ?? "").split("\n").map((l) => l.trim().toLowerCase())) {
              if (line.length >= 30 && !paperText.includes(line)) expect(clientText.includes(line)).toBe(false);
            }
          }
          const answers = gapAnswers(test).map((a) => a.trim().toLowerCase()).filter((a) => a.length >= 2);
          for (const k of picks) {
            if (!answers.length) break;
            const a = answers[k % answers.length];
            expect(count(clientText, a)).toBe(count(paperText, a));
            // …and the check can tell: the full test has it at least once more (the key, the transcript).
            expect(count(fullText, a)).toBeGreaterThan(count(paperText, a));
          }
          expect(allKeys(client).has("questionTimes")).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("keeps partStarts only when there is one per part, ascending and inside the file", () => {
    const audio = { file: "listening-3.mp3", durationSec: 1000 };
    expect(toClientRecording({ ...audio, partStarts: [10, 200, 400, 700] }, 4)).toEqual({
      url: cdiAudioUrl("listening-3.mp3"),
      durationSec: 1000,
      partStarts: [10, 200, 400, 700],
    });
    expect(toClientRecording({ ...audio, partStarts: [10, 200, 400] }, 4)?.partStarts).toBeUndefined();
    expect(toClientRecording({ ...audio, partStarts: [10, 400, 200, 700] }, 4)?.partStarts).toBeUndefined();
    expect(toClientRecording({ ...audio, partStarts: [10, 200, 400, 1200] }, 4)?.partStarts).toBeUndefined();
    expect(toClientRecording({ file: "listening-3.mp3", durationSec: -5 }, 4)).toEqual({ url: cdiAudioUrl("listening-3.mp3") });
    expect(toClientRecording({ file: "../secret.mp3" }, 4)).toBeUndefined();
  });

  it("result page only: toReviewRecording carries the question times", () => {
    const withTimes = files.find((f) => Object.keys(f.test.audio?.questionTimes ?? {}).length > 0);
    expect(withTimes).toBeDefined();
    const r = toReviewRecording(withTimes!.test);
    expect(r?.url).toBe(cdiAudioUrl(withTimes!.test.audio!.file));
    expect(r?.questionTimes?.[1]).toBe(withTimes!.test.audio!.questionTimes![1]);
    expect(toReviewRecording({ audio: undefined })).toBeNull();
  });
});

describe("CDI Listening timing and grading", () => {
  it("part windows: real partStarts, else an even split of the length", () => {
    expect(recordingWindows({ durationSec: 1725, partStarts: [50, 431, 847, 1190] }, 4)).toEqual({
      windows: [
        { start: 0, end: 431 },
        { start: 431, end: 847 },
        { start: 847, end: 1190 },
        { start: 1190, end: 1725 },
      ],
      estimated: false,
    });
    const even = recordingWindows({ durationSec: 1600 }, 4);
    expect(even?.estimated).toBe(true);
    expect(even?.windows.map((w) => w.start)).toEqual([0, 400, 800, 1200]);
    expect(recordingWindows({}, 4)).toBeNull();
  });

  it("the section clock follows the recording's length (not the empty scripts)", () => {
    const t = { parts: [0, 1, 2, 3].map(() => ({ script: [] })), audio: { durationSec: 1725, partStarts: [50, 431, 847, 1190] } };
    expect(estimateListeningMinutes(t)).toBe(Math.round((1725 + 120) / 60));
    expect(estimateListeningMinutes(t, 1)).toBe(Math.round((847 - 431 + 60) / 60));
    for (const { test } of files) expect(estimateListeningMinutes(test)).toBeGreaterThanOrEqual(Math.round((test.audio?.durationSec ?? 0) / 60));
  });

  it.each(files.map((f) => [f.file, f.test] as const))("%s grades with the existing grader (answer key → 40/40, blank → 0)", (_f, test) => {
    const answers: ExamAnswers = {};
    for (const p of test.parts) {
      for (const g of p.groups) {
        if (g.kind === "mcq-multi") {
          answers[String(g.questions[0].n)] = g.questions[0].answer;
          continue;
        }
        for (const q of g.questions) {
          if (g.kind === "gap") {
            const variants = q.answer.flatMap(expandOptional);
            answers[String(q.n)] = variants.reduce((a, b) => (b.split(/\s+/).length < a.split(/\s+/).length ? b : a));
          } else answers[String(q.n)] = q.answer[0];
        }
      }
    }
    const r = gradeTest(test, answers);
    expect(r.total).toBe(40);
    expect(r.items.filter((i) => !i.correct).map((i) => `${i.n}: ${i.given} ≠ ${i.accepted.join(" / ")}`)).toEqual([]);
    expect(gradeTest(test, {}).correct).toBe(0);
  });
});
