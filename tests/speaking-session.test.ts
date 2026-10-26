import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { PEER_FORMATS } from "@/lib/speaking/matching";
import { buildPeerContent } from "@/lib/speaking/peer-content";
import {
  SESSION_ACTIONS,
  advance,
  advancer,
  applyVersioned,
  currentPhase,
  initialSessionState,
  isPeerSessionState,
  phasePlan,
  type PeerSessionState,
  type Seat,
  type SessionAction,
} from "@/lib/speaking/session";

const seat = fc.constantFrom<Seat>("A", "B");
const step = fc.record({ action: fc.constantFrom<SessionAction>(...SESSION_ACTIONS), by: seat, dt: fc.integer({ min: 0, max: 200_000 }) });

const sessionArb = fc
  .record({
    format: fc.constantFrom(...PEER_FORMATS),
    level: fc.integer({ min: 6, max: 18 }).map((n) => n / 2),
    starter: seat,
    seed: fc.double({ min: 0, max: 0.999, noNaN: true }),
  })
  .map(({ format, level, starter, seed }) => initialSessionState(buildPeerContent(format, level, () => seed), starter, { A: level, B: level }));

const timerOf = (s: PeerSessionState) => `${s.startAt}|${s.durationSec}`;

describe("peer session state machine (property)", () => {
  /** **Validates: Requirements design §4 — phases only move forward; timers only set by allowed roles** */
  it("only moves forward and only the allowed seat sets timers", () => {
    fc.assert(
      fc.property(sessionArb, fc.array(step, { maxLength: 60 }), (initial, steps) => {
        let s = initial;
        let now = 1_000_000;
        for (const { action, by, dt } of steps) {
          now += dt;
          const next = advance(s, action, by, now);
          expect(next.phase).toBeGreaterThanOrEqual(s.phase);
          if (next.phase === s.phase) expect(next.prompt).toBeGreaterThanOrEqual(s.prompt);
          if (timerOf(next) !== timerOf(s) && next.startAt !== null) {
            expect(action).not.toBe("end");
            expect(advancer(s)).toBe(by);
          }
          if (next.startAt !== null) expect(currentPhase(next).kind).toBe("timed");
          s = next;
        }
      }),
    );
  });

  /** **Validates: Requirements design §4 — `end` always reaches done** */
  it("end always reaches done, by either seat, from any reachable state", () => {
    fc.assert(
      fc.property(sessionArb, fc.array(step, { maxLength: 40 }), seat, (initial, steps, by) => {
        let s = initial;
        let now = 1_000_000;
        for (const st of steps) s = advance(s, st.action, st.by, (now += st.dt));
        const ended = advance(s, "end", by, now + 1);
        expect(currentPhase(ended).kind).toBe("done");
        expect(ended.startAt).toBeNull();
        expect(ended.endedAt).not.toBeNull();
        // Done is terminal: every action is a no-op.
        for (const a of SESSION_ACTIONS) expect(advance(ended, a, "A", now + 2)).toBe(ended);
      }),
    );
  });

  /** **Validates: Requirements design §4 — invalid actions are no-ops; version moves only on change** */
  it("invalid actions return the same state and keep the version", () => {
    fc.assert(
      fc.property(sessionArb, fc.array(step, { maxLength: 60 }), (initial, steps) => {
        let s = initial;
        let version = 0;
        let now = 1_000_000;
        for (const { action, by, dt } of steps) {
          now += dt;
          const before = JSON.stringify(s);
          const r = applyVersioned(s, version, action, by, now);
          if (r.changed) {
            expect(r.version).toBe(version + 1);
            expect(JSON.stringify(r.state)).not.toBe(before);
          } else {
            expect(r.version).toBe(version);
            expect(r.state).toBe(s);
          }
          // Whatever happened, the input state was not mutated.
          expect(JSON.stringify(s)).toBe(before);
          s = r.state;
          version = r.version;
        }
      }),
    );
  });
});

describe("peer session state machine (examples)", () => {
  const exam = () => initialSessionState(buildPeerContent("exam", 6, () => 0.3), "A", { A: 6, B: 6.5 });

  it("plans every format as lobby → round 1 → swap → round 2 → done", () => {
    for (const f of PEER_FORMATS) {
      const plan = phasePlan(initialSessionState(buildPeerContent(f, 6, () => 0.5), "B", { A: 6, B: 6 }));
      expect(plan[0].kind).toBe("lobby");
      expect(plan.at(-1)!.kind).toBe("done");
      expect(plan.filter((p) => p.kind === "swap")).toHaveLength(1);
      const swap = plan.findIndex((p) => p.kind === "swap");
      // Roles swap: round 2 leads are the other seat (debate: sides swap).
      expect(plan[1].lead).toBe("B");
      expect(plan[swap + 1].lead).toBe("A");
    }
  });

  it("needs both seats ready, then only the examiner starts and advances", () => {
    let s = exam();
    expect(advance(s, "start", "A", 1)).toBe(s);
    s = advance(s, "ready", "A", 1);
    expect(advance(s, "ready", "A", 2)).toBe(s);
    s = advance(s, "ready", "B", 2);
    expect(advance(s, "start", "B", 3)).toBe(s); // B is the candidate in round 1
    s = advance(s, "start", "A", 3);
    expect(currentPhase(s)).toMatchObject({ key: "part1", lead: "A", speaker: "B" });
    expect(s.startAt).toBe(3);
    expect(advance(s, "next", "B", 4)).toBe(s);
    s = advance(s, "next", "A", 4);
    expect(s.prompt).toBe(1);
    expect(s.startAt).toBe(3); // Part 1 keeps one timer for the whole part
    s = advance(s, "skip", "A", 5);
    expect(currentPhase(s).key).toBe("part2-prep");
    expect(isPeerSessionState(s)).toBe(true);
  });

  it("restarts the card timer on each conversation card", () => {
    let s = initialSessionState(buildPeerContent("conversation", 5.5, () => 0.1), "A", { A: 5.5, B: 5.5 });
    s = advance(advance(s, "ready", "A", 0), "ready", "B", 0);
    s = advance(s, "start", "A", 10);
    s = advance(s, "next", "A", 50);
    expect(s).toMatchObject({ prompt: 1, startAt: 50, durationSec: 120 });
  });

  it("ends a session after the last phase of round 2", () => {
    let s = initialSessionState(buildPeerContent("debate", 7, () => 0.2), "A", { A: 7, B: 7 });
    s = advance(advance(s, "ready", "A", 0), "ready", "B", 0);
    let now = 0;
    for (let i = 0; i < 20 && currentPhase(s).kind !== "done"; i++) {
      const who = advancer(s)!;
      s = advance(s, currentPhase(s).kind === "timed" ? "next" : "start", who, (now += 1000));
    }
    expect(currentPhase(s).kind).toBe("done");
    expect(s.endedBy).toBeNull();
  });
});
