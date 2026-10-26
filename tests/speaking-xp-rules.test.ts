/**
 * Fair peer-speaking XP (docs/peer-speaking.md, Phase C): time actually spent in timed
 * phases (`timedMs` in the state machine) and the per-pair / per-day caps.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { PEER_FORMATS } from "@/lib/speaking/matching";
import { buildPeerContent } from "@/lib/speaking/peer-content";
import { TIMED_CAP, advance, advancer, currentPhase, initialSessionState, plannedTimedMs, type PeerSessionState } from "@/lib/speaking/session";
import { MIN_TIMED_SHARE, PEER_AWARDS_PER_DAY, enoughTimed, peerXpHold } from "@/lib/speaking/xp-rules";

const sessionArb = fc
  .record({ format: fc.constantFrom(...PEER_FORMATS), level: fc.integer({ min: 6, max: 18 }).map((n) => n / 2), seed: fc.double({ min: 0, max: 0.999, noNaN: true }) })
  .map(({ format, level, seed }) => initialSessionState(buildPeerContent(format, level, () => seed), "A", { A: level, B: level }));

/**
 * Play a session to done with the lead moving on after a random share of each running
 * timer (0–2× its duration). Returns the final state and the honest capped time.
 */
function play(initial: PeerSessionState, shares: number[]): { state: PeerSessionState; expected: number } {
  let now = 1_000_000;
  let s = advance(advance(initial, "ready", "A", now), "ready", "B", now);
  let expected = 0;
  let i = 0;
  for (let guard = 0; guard < 200 && currentPhase(s).kind !== "done"; guard++) {
    const p = currentPhase(s);
    if (p.kind === "timed") {
      const ms = Math.round(p.durationSec * 1000 * shares[i++ % shares.length]);
      now += ms;
      expected += Math.min(ms, p.durationSec * 1000 * TIMED_CAP);
      // Conversation cards restart the timer on `next`; other parts are left with `skip`.
      s = advance(s, p.timerPerPrompt ? "next" : "skip", p.lead!, now);
    } else {
      s = advance(s, "start", advancer(s)!, now);
    }
  }
  return { state: s, expected };
}

describe("timedMs (property)", () => {
  /** **Validates: Requirements Phase C §3a — timedMs = sum of capped timed stretches** */
  it("banks the time spent in each timed stretch, capped at 1.5× its timer", () => {
    fc.assert(
      fc.property(sessionArb, fc.array(fc.double({ min: 0, max: 2, noNaN: true }), { minLength: 1, maxLength: 30 }), (initial, shares) => {
        const { state, expected } = play(initial, shares);
        expect(currentPhase(state).kind).toBe("done");
        expect(state.timedMs).toBe(expected);
        expect(state.timedMs!).toBeLessThanOrEqual(plannedTimedMs(state) * TIMED_CAP);
      }),
    );
  });

  /** **Validates: Requirements Phase C §3a — no award below 50% of the plan's timed duration** */
  it("never pays XP below 50% of the planned timed duration, whatever the timings", () => {
    fc.assert(
      fc.property(sessionArb, fc.array(fc.double({ min: 0, max: 2, noNaN: true }), { minLength: 1, maxLength: 30 }), (initial, shares) => {
        const { state } = play(initial, shares);
        const hold = peerXpHold({ natural: true, timedMs: state.timedMs ?? 0, plannedMs: plannedTimedMs(state), pairAwardsToday: 0, awardsToday: 0 });
        const below = (state.timedMs ?? 0) < plannedTimedMs(state) * MIN_TIMED_SHARE;
        expect(hold === "unfinished").toBe(below);
        expect(enoughTimed(state)).toBe(!below);
      }),
    );
  });

  /** **Validates: Requirements Phase C §3b–c — one award per pair per day, at most 3 per day** */
  it("caps awards per partner per day and per student per day", () => {
    fc.assert(
      fc.property(fc.nat(5), fc.nat(6), fc.boolean(), (pair, total, natural) => {
        const awardsToday = Math.max(pair, total);
        const hold = peerXpHold({ natural, timedMs: 1000, plannedMs: 1000, pairAwardsToday: pair, awardsToday });
        if (!natural) expect(hold).toBe("unfinished");
        else if (pair >= 1) expect(hold).toBe("pair");
        else if (awardsToday >= PEER_AWARDS_PER_DAY) expect(hold).toBe("daily");
        else expect(hold).toBeNull();
      }),
    );
  });
});

describe("timedMs (examples)", () => {
  it("states saved before the field count as 0, and an early end banks the running timer", () => {
    const s = initialSessionState(buildPeerContent("quick", 6, () => 0.2), "A", { A: 6, B: 6 });
    const old = { ...advance(advance(advance(s, "ready", "A", 0), "ready", "B", 0), "start", "A", 1000) };
    delete old.timedMs;
    const ended = advance(old, "end", "B", 31_000);
    expect(ended.timedMs).toBe(30_000);
    expect(enoughTimed(ended)).toBe(false);
  });

  it("a conversation card restarted by Next counts each card's time", () => {
    let s = initialSessionState(buildPeerContent("conversation", 6, () => 0.2), "A", { A: 6, B: 6 });
    s = advance(advance(advance(s, "ready", "A", 0), "ready", "B", 0), "start", "A", 0);
    s = advance(s, "next", "A", 100_000);
    s = advance(s, "next", "A", 1_000_000); // a forgotten card: capped at 180 s
    expect(s.timedMs).toBe(100_000 + 180_000);
  });
});
