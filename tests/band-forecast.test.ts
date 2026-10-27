/** Band forecast (lib/forecast/band-forecast.ts): the honest-forecast rules and their invariants. */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { SKILLS, type SkillKey } from "@/lib/engine/progression/config";
import {
  bandForecast,
  dayKeyOf,
  daysBetween,
  FORECAST,
  overallFromSkills,
  paceFromSessions,
  paceMultiplier,
  selectForecastResults,
  type ForecastInput,
  type ForecastResult,
} from "@/lib/forecast/band-forecast";

const DAY = 86_400_000;
const NOW = Date.parse("2026-05-12T09:00:00+05:00");
const TODAY = "2026-05-12";
const PACE = { READING: 1, LISTENING: 1, WRITING: 1, SPEAKING: 1 };

const input = (results: ForecastResult[], targetBand = 7): ForecastInput => ({ results, targetBand, now: NOW, todayKey: TODAY, pace: PACE });
const r = (skill: SkillKey, daysAgo: number, band: number): ForecastResult => ({ skill, band, at: NOW - daysAgo * DAY });
/** The same series for all four skills. */
const all = (series: [daysAgo: number, band: number][]) => SKILLS.flatMap((s) => series.map(([d, b]) => r(s, d, b)));
const RISING: [number, number][] = [[90, 5], [60, 5.5], [30, 5.5], [1, 6]];

// --- generators -------------------------------------------------------------
const bandArb = fc.oneof(fc.integer({ min: 2, max: 18 }).map((n) => n / 2), fc.double({ min: 1, max: 9, noNaN: true }));
const resultArb = (skill: SkillKey) =>
  fc.record({ ago: fc.double({ min: 0, max: 119.9, noNaN: true }), band: bandArb }).map((x) => r(skill, x.ago, x.band));
const resultsArb = fc.tuple(...SKILLS.map((s) => fc.array(resultArb(s), { maxLength: 10 }))).map((xs) => xs.flat());
const targetArb = fc.integer({ min: 8, max: 18 }).map((n) => n / 2);
const inputArb = fc.record({ results: resultsArb, target: targetArb }).map(({ results, target }) => input(results, target));
const daysOf = (p: { days: number } | null) => (p ? p.days : Infinity);

describe("band forecast — properties", () => {
  it("never leaves 0–9 and every range contains its 'now'", () => {
    fc.assert(
      fc.property(inputArb, fc.integer({ min: 0, max: 3 }), (inp, extra) => {
        const f = bandForecast(inp, { extraPerWeek: extra });
        for (const s of f.skills) {
          if (s.now == null) continue;
          for (const v of [s.now, s.nowBand!, ...s.range!]) expect(v >= 0 && v <= 9).toBe(true);
          expect(s.range![0]).toBeLessThanOrEqual(s.nowBand!);
          expect(s.range![1]).toBeGreaterThanOrEqual(s.nowBand!);
          expect(s.range![0]).toBeLessThanOrEqual(s.now);
          expect(s.range![1]).toBeGreaterThanOrEqual(s.now);
        }
        if (f.overall) {
          for (const v of [f.overall.now, ...f.overall.range]) expect(v >= 0 && v <= 9).toBe(true);
          expect(f.overall.range[0]).toBeLessThanOrEqual(f.overall.now);
          expect(f.overall.range[1]).toBeGreaterThanOrEqual(f.overall.now);
        }
      })
    );
  });

  it("more data with identical noise never widens a range (each result taken twice)", () => {
    fc.assert(
      fc.property(inputArb, (inp) => {
        const once = bandForecast(inp);
        const twice = bandForecast({ ...inp, results: [...inp.results, ...inp.results] });
        once.skills.forEach((s, i) => {
          if (!s.range) return;
          const t = twice.skills[i];
          expect(t.status).toBe(s.status);
          expect(t.range![1] - t.range![0]).toBeLessThanOrEqual(s.range[1] - s.range[0]);
        });
      })
    );
  });

  it("follows the data rules: need-data, too-early, flat, rising; overall only with four forecasts", () => {
    fc.assert(
      fc.property(inputArb, (inp) => {
        const f = bandForecast(inp);
        for (const s of f.skills) {
          if (s.n < FORECAST.minResults) {
            expect(s.status).toBe("need-data");
            expect(s.needed).toBe(FORECAST.minResults - s.n);
            expect(s.now).toBeNull();
            continue;
          }
          const spread = daysBetween(dayKeyOf(s.points[0].at), dayKeyOf(s.points[s.n - 1].at));
          if (spread < FORECAST.minSpreadDays) {
            expect(s.status).toBe("too-early");
            expect(s.path).toBeNull();
          } else if (s.status === "flat") {
            expect(s.slope30!).toBeLessThanOrEqual(0);
            expect(s.path).toBeNull();
          } else {
            expect(s.status).toBe("rising");
            expect(s.slope30!).toBeGreaterThan(0);
          }
          if (s.path) {
            expect(s.path.days).toBeLessThanOrEqual(FORECAST.horizonDays);
            expect(s.path.earliest <= s.path.date).toBe(true);
            if (s.path.latest) expect(s.path.latest >= s.path.date).toBe(true);
          }
        }
        expect(f.overall != null).toBe(f.skills.every((s) => s.status === "flat" || s.status === "rising"));
      })
    );
  });

  it("respects the slope cap, with or without extra practice", () => {
    fc.assert(
      fc.property(inputArb, fc.integer({ min: 0, max: 3 }), (inp, extra) => {
        for (const s of bandForecast(inp, { extraPerWeek: extra }).skills) {
          if (s.slope30 == null) continue;
          expect(s.slope30).toBeGreaterThanOrEqual(FORECAST.slopeCap.min - 1e-12);
          expect(s.slope30).toBeLessThanOrEqual(FORECAST.slopeCap.max + 1e-12);
          expect(s.effectiveSlope30!).toBeLessThanOrEqual(FORECAST.slopeCap.max + 1e-12);
        }
      })
    );
  });

  it("more extra sessions never push a target date later", () => {
    fc.assert(
      fc.property(inputArb, (inp) => {
        const fs = FORECAST.whatIf.options.map((extra) => bandForecast(inp, { extraPerWeek: extra }));
        for (let i = 1; i < fs.length; i++) {
          fs[i].skills.forEach((s, k) => expect(daysOf(s.path)).toBeLessThanOrEqual(daysOf(fs[i - 1].skills[k].path)));
          expect(daysOf(fs[i].overall?.path ?? null)).toBeLessThanOrEqual(daysOf(fs[i - 1].overall?.path ?? null));
        }
      })
    );
  });

  it("is deterministic and ignores input order", () => {
    fc.assert(
      fc.property(inputArb, (inp) => {
        const a = bandForecast(inp, { extraPerWeek: 1 });
        expect(bandForecast(structuredClone(inp), { extraPerWeek: 1 })).toEqual(a);
        expect(bandForecast({ ...inp, results: [...inp.results].reverse() }, { extraPerWeek: 1 })).toEqual(a);
      })
    );
  });
});

describe("band forecast — rules by example", () => {
  it("need-data says exactly what is missing", () => {
    const f = bandForecast(input([r("LISTENING", 3, 6)]));
    const listening = f.skills.find((s) => s.skill === "LISTENING")!;
    expect(listening.status).toBe("need-data");
    expect(listening.message).toBe("Take 1 more Listening test to see your forecast.");
    expect(f.skills.find((s) => s.skill === "WRITING")!.message).toBe("Write 2 essays to see your forecast.");
    expect(f.overall).toBeNull();
  });

  it("too-early: results within a week give a level but no trend", () => {
    const s = bandForecast(input([r("READING", 3, 6), r("READING", 1, 6.5)])).skills[0];
    expect(s.status).toBe("too-early");
    expect(s.nowBand).not.toBeNull();
    expect(s.path).toBeNull();
    expect(s.readyOn).toBe("2026-05-16");
  });

  it("flat: no upward trend means no date, advice instead", () => {
    const s = bandForecast(input(all([[40, 6], [20, 6], [2, 6]]))).skills[0];
    expect(s.status).toBe("flat");
    expect(s.nowBand).toBe(6);
    expect(s.path).toBeNull();
    expect(s.message).toMatch(/^No upward trend in Reading yet\./);
  });

  it("a falling series is 'flat' with the decline capped at −0.25 a month", () => {
    const s = bandForecast(input([r("READING", 40, 8), r("READING", 1, 4)])).skills[0];
    expect(s.status).toBe("flat");
    expect(s.slope30).toBeCloseTo(-0.25, 10);
    expect(s.trend).toBe("down");
  });

  it("a jump of four bands in two weeks is capped at +0.5 a month", () => {
    const s = bandForecast(input([r("READING", 14, 4), r("READING", 1, 8)]), { extraPerWeek: 3 }).skills[0];
    expect(s.slope30).toBeCloseTo(0.5, 10);
    expect(s.effectiveSlope30).toBeCloseTo(0.5, 10);
  });

  it("rising: a dated path inside its earliest–latest window, before or after the exam", () => {
    const f = bandForecast(input(all(RISING)), { examDate: "2026-12-15" });
    const s = f.skills[0];
    expect(s.status).toBe("rising");
    expect(s.path).not.toBeNull();
    expect(s.path!.earliest <= s.path!.date).toBe(true);
    // Four identical skills: the overall reaches the target with them (±1 day of rounding).
    expect(Math.abs(daysBetween(f.overall!.path!.date, s.path!.date))).toBeLessThanOrEqual(1);
    expect(f.overall?.path?.beforeExam).toBe(true);
    expect(bandForecast(input(all(RISING)), { examDate: "2026-06-01" }).overall?.path?.beforeExam).toBe(false);
  });

  it("what-if: diminishing returns, capped at ×1.6, and the date comes sooner", () => {
    expect(paceMultiplier(0)).toBe(1);
    expect(paceMultiplier(2)).toBeCloseTo(1.3, 10);
    expect(paceMultiplier(10)).toBe(1.6);
    const base = bandForecast(input(all(RISING)));
    const more = bandForecast(input(all(RISING)), { extraPerWeek: 2 });
    expect(more.overall!.path!.days).toBeLessThan(base.overall!.path!.days);
  });

  it("overall uses the IELTS rule: .25 rounds up to .5, .75 up to the next band", () => {
    expect(overallFromSkills([6, 6, 6.5, 6.5])).toBe(6.5); // 6.25
    expect(overallFromSkills([6.5, 6.5, 7, 7])).toBe(7); // 6.75
    expect(overallFromSkills([6, 6, 6, 6.5])).toBe(6); // 6.125
    expect(overallFromSkills([6.5, 6.5, 6.5, 7])).toBe(6.5); // 6.625
    const flatAt = (bands: number[]) =>
      SKILLS.flatMap((s, i) => [r(s, 40, bands[i]), r(s, 20, bands[i]), r(s, 2, bands[i])]);
    expect(bandForecast(input(flatAt([6, 6, 6.5, 6.5]))).overall?.now).toBe(6.5);
    expect(bandForecast(input(flatAt([6.5, 6.5, 7, 7]))).overall?.now).toBe(7);
    expect(bandForecast(input(flatAt([7, 7, 7, 7]))).overall?.reached).toBe(true);
  });

  it("ignores results older than 120 days and from the future", () => {
    const s = bandForecast(input([r("SPEAKING", 130, 5), r("SPEAKING", -2, 7), r("SPEAKING", 5, 6)])).skills[3];
    expect(s.n).toBe(1);
    expect(s.status).toBe("need-data");
  });
});

describe("forecast evidence", () => {
  it("keeps full-ish first attempts only", () => {
    const out = selectForecastResults([
      { skill: "LISTENING", band: 6, at: NOW - 5 * DAY, questions: 10, contentKey: "l1" },
      { skill: "LISTENING", band: 8, at: NOW - 2 * DAY, questions: 10, contentKey: "l1" }, // retake of l1
      { skill: "LISTENING", band: 7, at: NOW - 1 * DAY, questions: 4, contentKey: "drill" }, // a drill
      { skill: "WRITING", band: 6, at: NOW - 3 * DAY, words: 60, task: "task2" }, // too short
      { skill: "WRITING", band: 6.5, at: NOW - 3 * DAY, words: 260, task: "task2" },
      { skill: "SPEAKING", band: 6, at: NOW - 3 * DAY, seconds: 12, words: 40 }, // too short
      { skill: "READING", band: 0, at: NOW - 3 * DAY }, // blank attempt
      { skill: "READING", band: 6, at: NOW - 3 * DAY }, // legacy row without a size
    ]);
    expect(out.map((x) => `${x.skill}:${x.band}`)).toEqual(["LISTENING:6", "WRITING:6.5", "READING:6"]);
  });

  it("pace = sessions per week over the last 4 weeks", () => {
    const sessions = [1, 3, 8, 15, 27, 40].map((d) => ({ skill: "READING" as SkillKey, at: NOW - d * DAY }));
    expect(paceFromSessions(sessions, NOW)).toEqual({ READING: 1.3, LISTENING: 0, WRITING: 0, SPEAKING: 0 });
  });
});
