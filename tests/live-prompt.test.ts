/** Live speaking partner — prompt builder and Realtime session config (docs/elegance-roadmap.md, idea 3). */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildLiveInstructions, buildSessionConfig, type LivePromptInput } from "@/lib/realtime/prompt";
import { LIVE_TOPICS, liveTopicOptions, resolveLiveTopic } from "@/lib/realtime/topics";
import { LIVE_MODES, SURPRISE_TOPIC, type LiveMode } from "@/lib/realtime/modes";

const MODES: LiveMode[] = ["casual", "part1", "part3"];
const allTopics = MODES.flatMap((m) => LIVE_TOPICS[m]);

const inputArb: fc.Arbitrary<LivePromptInput> = fc.record({
  mode: fc.constantFrom(...MODES),
  topic: fc.constantFrom(...allTopics).map((t) => ({ label: t.label, questions: t.questions })),
  level: fc.constantFrom(3, 3.5, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8.5).map((band) => ({ band, cefr: band < 4 ? "A2" : band < 5.5 ? "B1" : band < 7 ? "B2" : band < 8.5 ? "C1" : "C2" })),
  resumed: fc.boolean(),
});

describe("buildLiveInstructions", () => {
  it("includes the topic, the mode, the level, English-only and the safety lines, and is deterministic", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const text = buildLiveInstructions(input);
        expect(text).toBe(buildLiveInstructions({ ...input, topic: { ...input.topic, questions: [...input.topic.questions] } }));
        expect(text).toContain(`Topic: ${input.topic.label}.`);
        expect(text).toContain(input.level.cefr);
        expect(text).toContain(`IELTS band ${input.level.band.toFixed(1)}`);
        expect(text).toContain(input.mode === "casual" ? "Mode: casual chat" : input.mode === "part1" ? "Part 1" : "Part 3");
        expect(text).toMatch(/Speak only English/);
        expect(text).toMatch(/one or two sentences/);
        expect(text).toMatch(/at most once per turn/);
        expect(text).toMatch(/Never lecture/);
        expect(text).toMatch(/unrelated .* harmful/);
        expect(text).toMatch(/Don't ask for personal data/);
        expect(text).toContain(input.resumed ? "just reconnected" : "greet the learner");
        for (const q of input.topic.questions.slice(0, 6)) expect(text).toContain(q.replace(/\s+/g, " ").trim());
      }),
      { numRuns: 200 },
    );
  });

  it("gives each mode its own guidance", () => {
    const base = { topic: { label: "Music", questions: ["Do you like music?"] }, level: { band: 5.5, cefr: "B2" } };
    const texts = MODES.map((mode) => buildLiveInstructions({ ...base, mode }));
    expect(new Set(texts).size).toBe(3);
  });

  it("adapts the language to the level", () => {
    const base = { mode: "casual" as const, topic: { label: "Music", questions: [] } };
    expect(buildLiveInstructions({ ...base, level: { band: 4, cefr: "B1" } })).toMatch(/simple everyday words/);
    expect(buildLiveInstructions({ ...base, level: { band: 7.5, cefr: "C1" } })).toMatch(/less common vocabulary/);
  });
});

describe("buildSessionConfig (GA Realtime shape)", () => {
  it("sets the model, voice, transcription, semantic VAD and the logprobs include", () => {
    const cfg = buildSessionConfig({ instructions: "hi", model: "gpt-realtime-2.1-mini", transcribeModel: "gpt-4o-transcribe", voice: "marin" }) as {
      type: string;
      model: string;
      instructions: string;
      include: string[];
      audio: { input: { transcription: { model: string; language: string; prompt?: string }; turn_detection: { type: string; eagerness: string } }; output: { voice: string } };
    };
    expect(cfg.type).toBe("realtime");
    expect(cfg.model).toBe("gpt-realtime-2.1-mini");
    expect(cfg.instructions).toBe("hi");
    expect(cfg.include).toEqual(["item.input_audio_transcription.logprobs"]);
    expect(cfg.audio.input.transcription).toMatchObject({ model: "gpt-4o-transcribe", language: "en" });
    expect(cfg.audio.input.transcription.prompt).toMatch(/filler/);
    expect(cfg.audio.input.turn_detection).toMatchObject({ type: "semantic_vad", eagerness: "low" });
    expect(cfg.audio.output.voice).toBe("marin");
    // WebRTC negotiates the format through SDP.
    expect(JSON.stringify(cfg)).not.toContain("format");
    // whisper-style models get no free-text prompt.
    const w = buildSessionConfig({ instructions: "x", model: "m", transcribeModel: "whisper-1", voice: "cedar" }) as { audio: { input: { transcription: Record<string, unknown> } } };
    expect(w.audio.input.transcription.prompt).toBeUndefined();
  });
});

describe("live topics", () => {
  it("has topics for every mode with questions, unique ids, and options for the client", () => {
    const options = liveTopicOptions();
    for (const m of LIVE_MODES) {
      expect(LIVE_TOPICS[m.id].length).toBeGreaterThan(3);
      for (const t of LIVE_TOPICS[m.id]) expect(t.questions.length).toBeGreaterThan(0);
      expect(options[m.id].map((o) => o.id)).toEqual(LIVE_TOPICS[m.id].map((t) => t.id));
    }
    const ids = allTopics.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves an id of the same mode, a surprise topic, and nothing else", () => {
    const p1 = LIVE_TOPICS.part1[0];
    expect(resolveLiveTopic("part1", p1.id)).toEqual(p1);
    expect(resolveLiveTopic("part3", p1.id)).toBeNull();
    expect(resolveLiveTopic("casual", "nope")).toBeNull();
    fc.assert(
      fc.property(fc.constantFrom(...MODES), fc.double({ min: 0, max: 1, noNaN: true }), (mode, r) => {
        const t = resolveLiveTopic(mode, SURPRISE_TOPIC, () => r);
        return !!t && t.mode === mode;
      }),
    );
  });
});
