/**
 * Peer room timer helpers (lib/speaking/room-timer.ts) and ICE config (lib/speaking/ice.ts).
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { iceServersFromEnv, parseIceServers, STUN_SERVERS } from "@/lib/speaking/ice";
import { clockOffset, formatClock, timeLeftMs, timerMark, timeUpAction } from "@/lib/speaking/room-timer";
import { buildPeerContent } from "@/lib/speaking/peer-content";
import { initialSessionState, phasePlan } from "@/lib/speaking/session";

describe("room timer", () => {
  it("time left, clock text and server offset", () => {
    expect(timeLeftMs({ startAt: 1000, durationSec: 60 }, 31_000)).toBe(30_000);
    expect(timeLeftMs({ startAt: null, durationSec: null }, 5)).toBeNull();
    expect(formatClock(125_000)).toBe("2:05");
    expect(formatClock(59_001)).toBe("1:00");
    expect(formatClock(-3000)).toBe("0:00");
    expect(clockOffset(10_500, 1000, 2000)).toBe(9000);
  });

  it("property: a countdown announces 1 minute, 30 seconds and time-up exactly once each", () => {
    fc.assert(
      fc.property(fc.integer({ min: 61, max: 300 }), fc.array(fc.integer({ min: 800, max: 2000 }), { minLength: 400, maxLength: 400 }), (sec, steps) => {
        let left = sec * 1000;
        const marks: string[] = [];
        for (const step of steps) {
          const m = timerMark(left, left - step);
          if (m) marks.push(m);
          left -= step;
          if (left < -5000) break;
        }
        expect(marks).toEqual(["1 minute left", "30 seconds left", "Time is up"]);
      }),
    );
  });

  it("time up: `next` for conversation cards and last prompts, `skip` while Part 1 still has questions", () => {
    const exam = initialSessionState(buildPeerContent("exam", 6, () => 0.3), "A", { A: 6, B: 6 });
    const part1 = phasePlan(exam)[1];
    expect(part1.key).toBe("part1");
    expect(timeUpAction(part1, 0)).toBe("skip");
    expect(timeUpAction(part1, part1.prompts - 1)).toBe("next");
    const conv = initialSessionState(buildPeerContent("conversation", 6, () => 0.3), "A", { A: 6, B: 6 });
    expect(timeUpAction(phasePlan(conv)[1], 0)).toBe("next");
  });
});

describe("ICE servers", () => {
  it("adds TURN only with URLs and both credentials, and only when allowed", () => {
    const env = { TURN_URLS: "turn:turn.example.com:3478, turns:turn.example.com:5349 ,https://bad", TURN_USERNAME: "u", TURN_CREDENTIAL: "p" };
    expect(iceServersFromEnv(env)).toEqual([
      ...STUN_SERVERS,
      { urls: ["turn:turn.example.com:3478", "turns:turn.example.com:5349"], username: "u", credential: "p" },
    ]);
    expect(iceServersFromEnv(env, false)).toEqual(STUN_SERVERS);
    expect(iceServersFromEnv({ TURN_URLS: "turn:x:3478" })).toEqual(STUN_SERVERS);
    expect(iceServersFromEnv({})).toEqual(STUN_SERVERS);
  });

  it("parses the capabilities reply defensively", () => {
    expect(parseIceServers(undefined)).toEqual(STUN_SERVERS);
    expect(parseIceServers([{ urls: 5 }, null])).toEqual(STUN_SERVERS);
    expect(parseIceServers([{ urls: "turn:x", username: "u", credential: "c", extra: 1 }])).toEqual([{ urls: "turn:x", username: "u", credential: "c" }]);
  });
});
