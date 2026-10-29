import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ audio: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { listeningAudio: { findMany: m.audio } } }));
vi.mock("@/lib/ielts/catalog", () => ({ getListeningExam: vi.fn(), getReadingExam: vi.fn() }));
import { LISTENING_SEED } from "@/lib/ielts/content";
import { listeningClientContent } from "@/lib/ielts/audio/client";
import { wholeRecordingHash } from "@/lib/ielts/audio/hash";
import { recordingMinutes } from "@/lib/ielts/mock-library";
import { summarizeListening } from "@/lib/ielts/format";
import { importedWritingPromptSchema } from "@/lib/test-schema";
const test = { ...LISTENING_SEED[0], source: "imported" as const, recordingMode: "whole" as const, recordingDurationMs: 1_800_000 };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("LISTENING_AUDIO", "on");
  m.audio.mockResolvedValue([{ partIndex: -1, url: "https://cdn.test/cdi.mp3", durationMs: 1_800_000, scriptHash: wholeRecordingHash(test), timeline: [] }]);
});
describe("supplied whole Listening recordings", () => {
  it("ships one unchanged file, four navigable parts, and no scripts or keys", async () => {
    const c = await listeningClientContent(test, { recordingsOnly: true });
    expect(c?.fullRecording?.url).toBe("https://cdn.test/cdi.mp3"); expect(c?.parts).toHaveLength(4);
    for (const p of c!.parts) { expect(p.script).toEqual([]); for (const g of p.groups) for (const q of g.questions) expect(q).not.toHaveProperty("answer"); }
    expect(recordingMinutes(c!)).toBe(32); expect(summarizeListening(test).timeLimit).toBe(32);
  });
  it("fails closed on missing/stale files and never exposes scripts for voice fallback", async () => {
    m.audio.mockResolvedValue([]); expect(await listeningClientContent(test, { recordingsOnly: true })).toBeNull();
    expect((await listeningClientContent(test)).parts.every(p => p.script.length === 0)).toBe(true);
    m.audio.mockResolvedValue([{ partIndex: -1, url: "https://cdn.test/cdi.mp3", durationMs: 1_800_000, scriptHash: "wrong", timeline: [] }]);
    expect(await listeningClientContent(test, { recordingsOnly: true })).toBeNull();
  });
  it("respects the kill switch, HTTPS and positive recorded duration", async () => {
    vi.stubEnv("LISTENING_AUDIO", "off"); expect(await listeningClientContent(test, { recordingsOnly: true })).toBeNull();
    vi.stubEnv("LISTENING_AUDIO", "on"); m.audio.mockResolvedValue([{ partIndex: -1, url: "http://cdn.test/cdi.mp3", durationMs: 1, scriptHash: wholeRecordingHash(test) }]);
    expect(await listeningClientContent(test, { recordingsOnly: true })).toBeNull();
  });
  it("keeps the recording ready after JSONB reorders nested object keys", async () => {
    const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder)
      : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).reverse().map(([key, v]) => [key, reorder(v)])) : value;
    const stored = reorder(test) as typeof test;
    expect(wholeRecordingHash(stored)).toBe(wholeRecordingHash(test));
    expect((await listeningClientContent(stored, { recordingsOnly: true }))?.fullRecording?.url).toBe("https://cdn.test/cdi.mp3");
    const reorderedQuestions = structuredClone(stored); reorderedQuestions.parts[0].groups.reverse();
    expect(wholeRecordingHash(reorderedQuestions)).not.toBe(wholeRecordingHash(test));
  });
  it("uses a content fingerprint, not an AI provider model", () => {
    const edited = structuredClone(test); edited.parts[0].script[0].text += " edited";
    expect(wholeRecordingHash(edited)).not.toBe(wholeRecordingHash(test));
  });
});
describe("supplied Writing prompts", () => {
  const data = { id: "cdi-writing-01-task1", title: "CDI Task 1", prompt: "Summarise the supplied chart and compare its main features.", type: "Imported CDI", imageUrl: "https://cdn.test/chart.webp", imported: { provider: "user-supplied-cdi", file: "Writing-Task-01.html", sha256: "a".repeat(64), importVersion: 1 } };
  it("accepts an actual chart without inventing an essay or numerical chart data", () => {
    const parsed = importedWritingPromptSchema.parse(data); expect(parsed.sampleAnswer).toBe(""); expect(parsed.usefulPhrases).toEqual([]);
  });
  it("refuses executable/local chart URLs and missing provenance", () => {
    expect(importedWritingPromptSchema.safeParse({ ...data, imageUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(importedWritingPromptSchema.safeParse({ ...data, imported: undefined }).success).toBe(false);
  });
});

describe("verified supplied-audio parts", () => {
  it("serves checked original clips alongside the unchanged full recording", async () => {
    const { suppliedPartRecordingHash } = await import("@/lib/ielts/audio/hash");
    const split = {...test, recordingParts: test.parts.map((_, i) => ({startMs:i*450000,endMs:(i+1)*450000,sha256:String(i).repeat(64)}))};
    const rows = [{partIndex:-1,url:"https://cdn.test/full.mp3",durationMs:1800000,scriptHash:wholeRecordingHash(split),timeline:[]}, ...split.parts.map((_,i)=>({partIndex:i,url:`https://cdn.test/part-${i}.mp3`,durationMs:450000,scriptHash:suppliedPartRecordingHash(split,i)!,timeline:[]}))];
    const c = await listeningClientContent(split,{recordingsOnly:true,rows});
    expect(c?.fullRecording?.url).toBe("https://cdn.test/full.mp3"); expect(c?.parts.every(p=>p.audio && !p.script.length)).toBe(true);
    expect(JSON.stringify(c)).not.toMatch(/"answer"|"explanation"/); expect(summarizeListening(split).separateParts).toBe(true);
    rows[2].scriptHash="stale";
    const stale = await listeningClientContent(split,{recordingsOnly:true,rows}); expect(stale?.parts[1].audio).toBeUndefined(); expect(stale?.fullRecording).toBeTruthy();
    const edited=structuredClone(split);edited.recordingParts[0].endMs+=1000;expect(suppliedPartRecordingHash(edited,0)).not.toBe(suppliedPartRecordingHash(split,0));
    edited.recordingParts[0].startMs=-1;expect(suppliedPartRecordingHash(edited,0)).toBeNull();
    expect(suppliedPartRecordingHash(test,0)).toBeNull();
  });
});
