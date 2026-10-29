// @vitest-environment node
import { gzipSync } from "zlib";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { extractLiterals, LiteralError, type Literal } from "@/lib/cdi-import/literals";
import { decodeBase64DataUri, decodeUtf8SevenBit, encodeUtf8SevenBit, unpackEmbeddedAudio } from "@/lib/cdi-import/packed-audio";
import { detectPauses } from "@/lib/cdi-import/silence";
import { admissibleInterval, proposeBoundaries } from "@/lib/cdi-import/boundaries";
import { budgetDecision, confirmHost, HOST_BUDGET_BYTES } from "@/lib/cdi-import/budget";
import { buildManifest, manifestText } from "@/lib/cdi-import/manifest";
import { convertSource } from "@/lib/cdi-import/pipeline";
import { segmentsFromBoundaries, validateSegments } from "@/lib/ielts/segments";
import { listeningSource, readingSource } from "./fixtures/cdi-v10/build";

const json: fc.Arbitrary<Literal> = fc.letrec<{ v: Literal }>((tie) => ({
  v: fc.oneof(
    { depthSize: "small" },
    fc.string({ maxLength: 8 }),
    fc.integer({ min: -1000, max: 1000 }),
    fc.boolean(),
    fc.constant(null),
    fc.array(tie("v"), { maxLength: 4 }),
    fc.dictionary(fc.string({ minLength: 1, maxLength: 5 }).filter((k) => /^[a-z]+$/i.test(k)), tie("v"), { maxKeys: 4 }),
  ),
})).v;

/** A JS spelling of a value: single or double quotes, trailing commas, template strings. */
function spell(v: Literal, quote: "'" | '"' | "`", trailing: boolean): string {
  if (v === null || typeof v === "boolean") return String(v);
  if (typeof v === "number") return v < 0 ? `-${-v}` : String(v);
  if (typeof v === "string") {
    if (quote === "`") return "`" + v.replace(/[`\\$]/g, (c) => `\\${c}`) + "`";
    if (quote === '"') return JSON.stringify(v);
    return `'${JSON.stringify(v).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")}'`;
  }
  const t = trailing ? "," : "";
  if (Array.isArray(v)) return `[${v.map((x) => spell(x, quote, trailing)).join(", ")}${v.length ? t : ""}]`;
  const entries = Object.entries(v);
  return `{${entries.map(([k, x]) => `${JSON.stringify(k)}: ${spell(x, quote, trailing)}`).join(", ")}${entries.length ? t : ""}}`;
}

describe("literal extraction", () => {
  // Feature: new-tests-articles-listening-parts, Property 2: Literal extraction is exact and never evaluates code
  it("reads literals exactly and refuses anything that would need evaluation", () => {
    fc.assert(
      fc.property(json, fc.constantFrom<"'" | '"' | "`">("'", '"', "`"), fc.boolean(), (v, q, trailing) => {
        const out = extractLiterals([`function f(){ const data = ${spell(v, q, trailing)}; }`], ["data"]);
        expect(out.data).toEqual(v);
      }),
      { numRuns: 200 },
    );
    for (const bad of ["foo", "f()", "a.b", "`x${y}`", "() => 1", "{ a: g() }", "[...x]"]) {
      (globalThis as Record<string, unknown>).__evaluated = false;
      expect(() => extractLiterals([`const data = ${bad}; globalThis.__evaluated = true;`], ["data"])).toThrow(LiteralError);
      expect((globalThis as Record<string, unknown>).__evaluated).toBe(false);
    }
  });
});

describe("packed recordings", () => {
  // Feature: new-tests-articles-listening-parts, Property 10: Packed audio round trip and corruption detection
  it("round-trips any bytes and detects corruption", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 1, maxLength: 3000 }), (bytes) => {
        const gz = new Uint8Array(gzipSync(Buffer.from(bytes)));
        const text = encodeUtf8SevenBit(gz);
        expect(Buffer.from(decodeUtf8SevenBit(text, gz.length)).equals(Buffer.from(gz))).toBe(true);
        expect(Buffer.from(unpackEmbeddedAudio({ text, compressedBytes: gz.length, originalBytes: bytes.length })).equals(Buffer.from(bytes))).toBe(true);
        expect(Buffer.from(decodeBase64DataUri(`data:audio/mpeg;base64,${Buffer.from(bytes).toString("base64")}`)).equals(Buffer.from(bytes))).toBe(true);
        expect(() => unpackEmbeddedAudio({ text, compressedBytes: gz.length, originalBytes: bytes.length + 1 })).toThrow();
        expect(() => decodeUtf8SevenBit(text.slice(0, Math.max(0, text.length - 3)), gz.length)).toThrow();
        expect(() => decodeUtf8SevenBit(`${text.slice(0, 1)}\u0000${text.slice(1)}`, gz.length)).toThrow();
        expect(() => decodeUtf8SevenBit(String.fromCharCode(128 + (5 << 7)), 1)).toThrow();
      }),
      { numRuns: 100 },
    );
    expect(() => unpackEmbeddedAudio({ text: encodeUtf8SevenBit(new Uint8Array([1, 2, 3])), compressedBytes: 3, originalBytes: 3 })).toThrow(/gzip/);
    expect(() => decodeBase64DataUri("data:audio/mpeg;base64,@@@")).toThrow();
  });
});

describe("pauses and boundary candidates", () => {
  // Feature: new-tests-articles-listening-parts, Property 20: Pause detection
  it("finds exactly the maximal quiet runs of at least 1 s", () => {
    fc.assert(
      fc.property(fc.array(fc.oneof(fc.constant(-60), fc.constant(-20), fc.double({ min: -80, max: 0, noNaN: true })), { maxLength: 300 }), (db) => {
        const pauses = detectPauses(db);
        // Reference: scan runs.
        const ref: { startMs: number; endMs: number }[] = [];
        let s = -1;
        for (let i = 0; i <= db.length; i++) {
          const q = i < db.length && db[i] < -40;
          if (q && s < 0) s = i;
          if (!q && s >= 0) {
            if ((i - s) * 50 >= 1000) ref.push({ startMs: s * 50, endMs: i * 50 });
            s = -1;
          }
        }
        expect(pauses).toEqual(ref);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: new-tests-articles-listening-parts, Property 19: Boundary candidates lie in pauses or windows and form valid segments
  it("places candidates inside pauses (or window midpoints) and keeps the segments valid", () => {
    const arb = fc.integer({ min: 300_000, max: 2_400_000 }).chain((D) =>
      fc.record({
        D: fc.constant(D),
        pauses: fc.array(fc.tuple(fc.integer({ min: 0, max: D }), fc.integer({ min: 0, max: 40_000 })), { maxLength: 12 }),
        windows: fc.boolean(),
      }),
    );
    fc.assert(
      fc.property(arb, ({ D, pauses, windows }) => {
        const ps = pauses.map(([s, l]) => ({ startMs: s, endMs: Math.min(D, s + l) })).sort((a, b) => a.startMs - b.startMs);
        const wins = windows ? [0, 1, 2, 3].map((k) => [{ startMs: Math.round((k * D) / 4 + D / 40), endMs: Math.round((k * D) / 4 + D / 20) }]) : null;
        const { candidates, warnings } = proposeBoundaries({ durationMs: D, pauses: ps, windowsByPart: wins });
        if (D < 480_000) {
          expect(candidates).toEqual([null, null, null]);
          expect(warnings.length).toBeGreaterThan(0);
          return;
        }
        candidates.forEach((c, i) => {
          if (!c) return;
          const iv = admissibleInterval((i + 1) as 1 | 2 | 3, { durationMs: D, windowsByPart: wins })!;
          expect(c.ms).toBeGreaterThanOrEqual(iv.from);
          expect(c.ms).toBeLessThanOrEqual(iv.to);
          if (c.method === "pause") expect(ps.some((p) => c.ms >= p.startMs && c.ms <= p.endMs)).toBe(true);
          else expect(c.ms).toBe(Math.round((iv.from + iv.to) / 2));
        });
        if (candidates.every((c) => c)) {
          const segs = segmentsFromBoundaries([candidates[0]!.ms, candidates[1]!.ms, candidates[2]!.ms], D);
          expect(validateSegments(segs, { durationMs: D, windowsByPart: wins ?? [[], [], [], []] })).toBeNull();
        } else expect(warnings.some((w) => /Boundary \d|dropped/.test(w))).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});

describe("host budget and confirmation", () => {
  // Feature: new-tests-articles-listening-parts, Property 40: Upload budget gate
  it("uploads only within a known 1 GB budget", () => {
    fc.assert(
      fc.property(fc.option(fc.integer({ min: 0, max: 2 * HOST_BUDGET_BYTES }), { nil: null }), fc.integer({ min: 0, max: HOST_BUDGET_BYTES }), (used, fresh) => {
        const d = budgetDecision(used, fresh);
        expect(d.ok).toBe(used != null && used + fresh <= HOST_BUDGET_BYTES);
        if (!d.ok) expect(d).toMatchObject({ newBytes: fresh, limitBytes: HOST_BUDGET_BYTES, usedBytes: used });
      }),
      { numRuns: 200 },
    );
  });

  // Feature: new-tests-articles-listening-parts, Property 38: Exact host confirmation
  it("proceeds only on an exact host match and never echoes the URL", () => {
    fc.assert(
      fc.property(fc.constantFrom("db.example.com", "DB.example.com", "db.example.co", "", "ep-1.neon.tech"), fc.constantFrom("postgresql://user:secret@db.example.com:5432/x", "postgresql://u:p@ep-1.neon.tech/x", "nonsense"), (expected, url) => {
        const r = confirmHost(expected || null, url);
        let host: string | null = null;
        try {
          host = new URL(url).hostname;
        } catch {
          host = null;
        }
        expect(r.ok).toBe(!!expected && host === expected);
        if (!r.ok) {
          expect(r.message).not.toContain("secret");
          expect(r.message).not.toContain(url);
        }
      }),
      { numRuns: 60 },
    );
  });
});

describe("determinism", () => {
  // Feature: new-tests-articles-listening-parts, Property 9: Importer output is deterministic
  it("gives byte-identical manifests and media for any file order and clock", async () => {
    const files = [
      { file: "Volume 10 test 1 reading.html", html: readingSource(11).html },
      { file: "Volume 10 test 3 listening.html", html: listeningSource(12).html },
      { file: "vol 10 test 7 reading.html", html: readingSource(13).html },
    ];
    const once = async (order: number[]) => {
      const results = [];
      for (const i of order) results.push(await convertSource({ file: files[i].file, bytes: new TextEncoder().encode(files[i].html), mediaBase: "https://e.github.io/averna-cdi-audio/" }));
      return { manifest: manifestText(buildManifest(results)), media: results.flatMap((r) => r.media.map((m) => `${m.path}:${m.sha256}`)).sort() };
    };
    const a = await once([0, 1, 2]);
    const realNow = Date.now;
    Date.now = () => 0;
    try {
      const b = await once([2, 0, 1]);
      expect(b.manifest).toBe(a.manifest);
      expect(b.media).toEqual(a.media);
    } finally {
      Date.now = realNow;
    }
    expect(a.manifest).not.toMatch(/\d{4}-\d{2}-\d{2}T|C:\\\\|\/Users\//);
    for (const m of a.media) expect(m).toMatch(/^v10\/cdi-v10-[a-z]+-\d{2}(-q\d+-\d+)?-[a-f0-9]{16}\.(mp3|png):[a-f0-9]{64}$/);
  });
});
