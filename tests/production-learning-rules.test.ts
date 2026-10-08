import { describe, expect, it } from "vitest";
import { correctionMatches, parseMistake } from "@/lib/mistakes/rules";
import { nextFocusPlan } from "@/lib/study/next-session";
import type { DnaSkillMetric } from "@/lib/engine/learning-dna/types";
import { fixedWindow } from "@/lib/security/rate-policy";
import {
  newAccountToken,
  tokenHash,
  validRawToken,
} from "@/lib/account/tokens";
import { validateWritingAssessment } from "@/lib/assessment-writing";

describe("student-owned correction rules", () => {
  it("normalises typography, spaces, case, and final punctuation", () =>
    expect(
      correctionMatches("  I HAVE been to London! ", "I have been to London."),
    ).toBe(true));
  it("does not equate an incorrect verb with the saved correction", () =>
    expect(
      correctionMatches("I have went to London", "I have been to London"),
    ).toBe(false));
  it("never treats an empty answer as a success", () =>
    expect(correctionMatches(" ", " ")).toBe(false));
  it("accepts valid content but discards client ownership fields", () =>
    expect(
      parseMistake({
        id: "card-1",
        wrong: "went",
        right: "been",
        studentId: "someone-else",
      }),
    ).toEqual({
      id: "card-1",
      wrong: "went",
      right: "been",
      note: null,
      sourceTestId: null,
    }));
  it.each([
    null,
    {},
    { id: "../../x", wrong: "a", right: "b" },
    { id: "x", wrong: "same", right: "SAME." },
    { id: "x", wrong: "a".repeat(2001), right: "b" },
    { id: "x", wrong: "a", right: "b", note: {} },
  ])("rejects invalid corrections %#", (raw) =>
    expect(parseMistake(raw)).toBeNull(),
  );
});
describe("a truthful short study plan", () => {
  const weak = {
    key: "WRITING",
    label: "Writing",
    events: 8,
  } as DnaSkillMetric;
  it("allocates exactly 15 suggested minutes without a full exam", () => {
    const plan = nextFocusPlan(
      { weakest: weak, confidence: "medium", dataPoints: 20 },
      3,
    );
    expect(plan.steps.reduce((sum, step) => sum + step.minutes, 0)).toBe(15);
    expect(plan.steps[0].href).toBe("/studio/mistakes");
    expect(plan.steps[1].href).toBe("/studio/essay-xray");
    expect(plan.personalised).toBe(true);
  });
  it("does not pretend to personalise a cold start", () =>
    expect(
      nextFocusPlan(
        { weakest: weak, confidence: "insufficient", dataPoints: 1 },
        0,
      ).personalised,
    ).toBe(false));
  it("withholds a weak-skill claim from too few skill events", () =>
    expect(
      nextFocusPlan(
        {
          weakest: { ...weak, events: 1 },
          confidence: "medium",
          dataPoints: 10,
        },
        0,
      ).personalised,
    ).toBe(false));
});
describe("fixed windows and account tokens", () => {
  it("rounds retry-after upward at the window edge", () =>
    expect(
      fixedWindow({ key: "x", seconds: 60, limit: 1 }, 59999).retryAfterSeconds,
    ).toBe(1));
  it("starts a fresh window at the boundary", () =>
    expect(fixedWindow({ key: "x", seconds: 60, limit: 1 }, 60000).start).toBe(
      60000,
    ));
  it("refuses invalid policy configuration", () =>
    expect(() => fixedWindow({ key: "x", seconds: 0, limit: 0 })).toThrow());
  it("stores only a hash, with distinct random tokens", () => {
    const a = newAccountToken("reset", 0);
    const b = newAccountToken("reset", 0);
    expect(a.token).not.toBe(b.token);
    expect(validRawToken(a.token)).toBe(true);
    expect(a.tokenHash).toBe(tokenHash(a.token));
    expect(a.tokenHash).not.toBe(a.token);
    expect(a.expiresAt.getTime()).toBe(30 * 60000);
  });
  it("expires confirmation after 24 hours", () =>
    expect(newAccountToken("verify", 0).expiresAt.getTime()).toBe(86400000));
});
describe("AI output validation", () => {
  const result = {
    taskAchievement: 6,
    coherenceCohesion: 6,
    lexicalResource: 6,
    grammarAccuracy: 6,
    overallBand: 9,
    strengths: ["Clear paragraph"],
    weaknesses: ["Verb form"],
    recommendations: ["Review participles"],
    detailedFeedback: "Practice feedback",
    issues: [{ text: "not in essay", type: "grammar", suggestion: "Rewrite" }],
  };
  it("recomputes the criterion mean and removes invented highlights", () => {
    const value = validateWritingAssessment(result, "I have went.");
    expect(value.overallBand).toBe(6);
    expect(value.source).toBe("ai");
    expect(value.issues).toEqual([]);
  });
  it("rejects scores outside the rubric", () =>
    expect(() =>
      validateWritingAssessment({ ...result, grammarAccuracy: 12 }, "Essay"),
    ).toThrow());
  it("rejects malformed model arrays", () =>
    expect(() =>
      validateWritingAssessment({ ...result, strengths: "Great" }, "Essay"),
    ).toThrow());
});
