import { describe, expect, it } from "vitest";
import { practiceReadiness, type ReadinessEvidence } from "@/lib/assessment/readiness";
const now = new Date("2026-10-09T12:00:00Z");
const row = (o: Partial<ReadinessEvidence> = {}): ReadinessEvidence => ({ id: "r1", module: "READING", score: 6, completedAt: new Date("2026-10-08T12:00:00Z"), contentKey: "paper-one", format: "exam-v2", part: null, totalQuestions: "40", answeredCount: "40", source: null, taskType: null, examAttemptId: null, recorded: null, typedAnswers: null, teacherBand: null, speakingParts: [1,2,3].map(part => ({part, words:30, seconds:20})), pronunciation:"6", ...o });
describe("descriptive practice evidence", () => {
  it("does not invent a forecast or confidence at cold start", () => { const s = practiceReadiness([], now); expect(s.overall).toBeNull(); expect(s.confidence).toBeNull(); expect(s.perSkill.every(s => s.current == null)).toBe(true); });
  it("does not project automatic growth from flat scores", () => { const s = practiceReadiness([row(), row({ id: "r2", contentKey: "two" })], now); expect(s.perSkill[0].current).toBe(6); expect(s.perSkill[0].predicted).toBe(6); });
  it("keeps latest repeated content only", () => { const s = practiceReadiness([row({ score: 8 }), row({ id: "old", score: 4, completedAt: new Date("2026-10-01") })], now); expect(s.perSkill[0].sampleSize).toBe(1); expect(s.perSkill[0].current).toBe(8); });
  it("excludes old and future evidence", () => expect(practiceReadiness([row({ completedAt: new Date("2026-01-01") }), row({ id: "future", completedAt: new Date("2027-01-01") })], now).perSkill[0].sampleSize).toBe(0));
  it("partial papers never establish overall readiness", () => { const s = practiceReadiness([row({ totalQuestions: "10", answeredCount: "10", part: "0" })], now); expect(s.perSkill[0].current).toBe(6); expect(s.perSkill[0].fullSampleSize).toBe(0); expect(s.overall).toBeNull(); });
  it("heuristic writing and AI-only speaking are excluded", () => { const s = practiceReadiness([row({ module: "WRITING", source: "heuristic" }), row({ id: "sp", module: "SPEAKING", source: "ai", recorded: "true" })], now); expect(s.perSkill[2].current).toBeNull(); expect(s.perSkill[3].current).toBeNull(); });
  it("teacher band overrides a former automatic band", () => expect(practiceReadiness([row({ module: "WRITING", source: "heuristic", teacherBand: 7 })], now).perSkill[2].current).toBe(7));
  it("zero is valid evidence, not silently discarded", () => expect(practiceReadiness([row({ score: 0 })], now).perSkill[0].current).toBe(0));
  it("weights paired Writing Task 2 twice but not more frequent skills in overall", () => {
    const rows: ReadinessEvidence[] = [];
    for (let i = 0; i < 2; i++) {
      const at = new Date(`2026-10-0${i + 6}T12:00:00Z`);
      for (const module of ["READING", "LISTENING"]) rows.push(row({ id: `${module}${i}`, module, score: 6, contentKey: `${module}${i}`, completedAt: at }));
      rows.push(row({ id: `speaking${i}`, module: "SPEAKING", teacherBand: 6, recorded: "true", contentKey: `speaking${i}`, completedAt: at }));
      for (const taskType of ["task1", "task2"]) rows.push(row({ id: `${taskType}${i}`, module: "WRITING", source: "ai", score: taskType === "task1" ? 3 : 7.5, taskType, examAttemptId: `exam${i}`, contentKey: `${taskType}${i}`, completedAt: at }));
    }
    const s = practiceReadiness(rows, now); expect(s.perSkill[2].fullBand).toBe(6); expect(s.overall).toBe(6);
  });
  it("one study day is not enough even with different content", () => expect(practiceReadiness([row(), row({ id: "other", contentKey: "other" })], now).perSkill[0].fullBand).toBeNull());
  it("rejects typed Speaking even with a human band", () => expect(practiceReadiness([row({ module: "SPEAKING", teacherBand: 7, recorded: "true", typedAnswers: "2" })], now).perSkill[3].sampleSize).toBe(0));
  it("incomplete recorded Speaking cannot establish an overall summary", () => expect(practiceReadiness([row({ module:"SPEAKING", teacherBand:7, recorded:"true", speakingParts:[{part:1,words:20,seconds:10}] })], now).perSkill[3].fullSampleSize).toBe(0));
  it("a review without pronunciation criteria is not a complete Speaking rubric", () => expect(practiceReadiness([row({module:"SPEAKING", teacherBand:7, recorded:"true", pronunciation:null})], now).perSkill[3].fullSampleSize).toBe(0));
  it("cannot turn one Writing task into a full paper", () => expect(practiceReadiness([row({ module: "WRITING", source: "ai", examAttemptId: "exam", taskType: "task2" })], now).perSkill[2].fullSampleSize).toBe(0));
});
