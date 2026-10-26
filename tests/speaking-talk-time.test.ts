/**
 * lib/speaking/talk-time.ts — the peer room's client-side talk-time balance:
 * VAD state machine, 5-second buckets, share and the conversation nudge.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  addTalk,
  BUCKET_MS,
  DEFAULT_VAD,
  dominantSide,
  rmsOfBytes,
  talkShare,
  vadInit,
  vadStep,
  windowTotals,
  type VadState,
} from "@/lib/speaking/talk-time";

/** Samples at increasing times (gaps up to 1.2 s) with RMS 0–0.2. */
const samples = fc.array(fc.tuple(fc.integer({ min: 1, max: 1200 }), fc.double({ min: 0, max: 0.2, noNaN: true })), { minLength: 1, maxLength: 200 });

function run(list: [number, number][], start = 1_000_000): { states: VadState[]; times: number[] } {
  let s = vadInit();
  let t = start;
  const states: VadState[] = [];
  const times: number[] = [];
  for (const [gap, rms] of list) {
    t += gap;
    s = vadStep(s, rms, t);
    states.push(s);
    times.push(t);
  }
  return { states, times };
}

describe("vadStep", () => {
  it("property: credited speech never decreases and never exceeds the elapsed time", () => {
    fc.assert(
      fc.property(samples, (list) => {
        const { states, times } = run(list);
        for (let i = 1; i < states.length; i++) expect(states[i].totalMs).toBeGreaterThanOrEqual(states[i - 1].totalMs);
        expect(states[states.length - 1].totalMs).toBeLessThanOrEqual(times[times.length - 1] - times[0]);
      }),
    );
  });

  it("property: silence credits nothing; constant voice credits all the elapsed time", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 100 }), (gaps) => {
        const quiet = run(gaps.map((g) => [g, 0] as [number, number]));
        expect(quiet.states.at(-1)!.totalMs).toBe(0);
        const loud = run(gaps.map((g) => [g, 0.1] as [number, number]));
        expect(loud.states.at(-1)!.totalMs).toBe(loud.times.at(-1)! - loud.times[0]);
      }),
    );
  });

  it("property: speech stops once the hangover after the last loud sample has passed", () => {
    fc.assert(
      fc.property(samples, fc.integer({ min: 1, max: 3000 }), (list, after) => {
        const { states, times } = run(list);
        const last = states.at(-1)!;
        const s = vadStep(last, 0, times.at(-1)! + after);
        if (last.lastVoiceAt === null || times.at(-1)! + after - last.lastVoiceAt > DEFAULT_VAD.hangoverMs) expect(s.speaking).toBe(false);
      }),
    );
  });

  it("bridges short pauses between words, caps long gaps and ignores samples out of order", () => {
    let s = vadStep(vadInit(), 0.1, 0);
    s = vadStep(s, 0, 300); // inside the 400 ms hangover: still speaking
    expect(s.speaking).toBe(true);
    s = vadStep(s, 0, 900);
    expect(s.speaking).toBe(false);
    expect(s.totalMs).toBe(900);
    const capped = vadStep(vadStep(vadInit(), 0.1, 0), 0.1, 60_000);
    expect(capped.totalMs).toBe(DEFAULT_VAD.maxStepMs);
    expect(vadStep(s, 0.1, 100)).toBe(s);
  });
});

describe("buckets, share and nudge", () => {
  it("property: windowTotals over the kept range equals everything credited in it", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 0, max: 4000 }), fc.integer({ min: 0, max: 500 }), fc.integer({ min: 0, max: 500 })), { maxLength: 60 }),
        (steps) => {
          let buckets: ReturnType<typeof addTalk> = [];
          let t = 10_000_000;
          let me = 0;
          let partner = 0;
          for (const [gap, a, b] of steps) {
            t += gap;
            buckets = addTalk(buckets, t, a, b);
            me += a;
            partner += b;
          }
          // all steps span < 4 minutes, inside the 5-minute retention
          expect(windowTotals(buckets, t, 10 * 60_000)).toEqual({ me, partner });
          expect(new Set(buckets.map((x) => x.start)).size).toBe(buckets.length);
          expect(buckets.every((x) => x.start % BUCKET_MS === 0)).toBe(true);
        },
      ),
    );
  });

  it("property: the share is whole percentages adding up to 100 (or null with too little talk)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 600_000 }), fc.integer({ min: 0, max: 600_000 }), (a, b) => {
        const s = talkShare(a, b);
        if (a + b < 5000) expect(s).toBeNull();
        else {
          expect(s!.me + s!.partner).toBe(100);
          expect(Number.isInteger(s!.me)).toBe(true);
          if (a > b) expect(s!.me).toBeGreaterThanOrEqual(s!.partner);
        }
      }),
    );
  });

  it("nudges only above 70% with enough talk in the window", () => {
    expect(dominantSide({ me: 80_000, partner: 20_000 })).toBe("me");
    expect(dominantSide({ me: 10_000, partner: 50_000 })).toBe("partner");
    expect(dominantSide({ me: 60_000, partner: 40_000 })).toBeNull();
    expect(dominantSide({ me: 30_000, partner: 0 })).toBeNull(); // under 45 s of talk
    expect(talkShare(55_000, 45_000)).toEqual({ me: 55, partner: 45 });
  });

  it("rmsOfBytes: silence is 0, full-scale is ~1", () => {
    expect(rmsOfBytes(new Uint8Array(64).fill(128))).toBe(0);
    expect(rmsOfBytes(Uint8Array.from({ length: 64 }, (_, i) => (i % 2 ? 0 : 255)))).toBeGreaterThan(0.99);
    expect(rmsOfBytes([])).toBe(0);
  });
});
