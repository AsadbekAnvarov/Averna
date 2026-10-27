/**
 * Live speaking partner — the model's instructions and the Realtime session config
 * (GA shape, POST /v1/realtime/calls `session` part). Pure and deterministic: the
 * same mode, topic, level and flags always give the same text.
 *
 * The topic and its questions are curated Averna content (lib/realtime/topics.ts),
 * never student input, so they are safe to embed.
 */
import type { LiveMode } from "./modes";

export interface LivePromptInput {
  mode: LiveMode;
  topic: { label: string; questions: readonly string[] };
  level: { band: number; cefr: string };
  /** The call dropped and this is the one automatic reconnect. */
  resumed?: boolean;
}

const MODE_LINES: Record<LiveMode, string[]> = {
  casual: [
    "Mode: casual chat. Talk like a friendly classmate, not an examiner.",
    "Now and then share a tiny opinion or experience of your own (one short sentence) so it feels like a real conversation, then hand the turn back with a question.",
  ],
  part1: [
    "Mode: IELTS Speaking Part 1 practice. Ask short, simple questions about the learner and the familiar topic, like a kind examiner.",
    "Ask one question, listen, react in a few words, then ask a natural follow-up or the next question. Encourage answers of 2–3 sentences with a reason.",
  ],
  part3: [
    "Mode: IELTS Speaking Part 3 discussion. Ask broader questions about society and people in general, not only the learner's own life.",
    "Ask the learner to give reasons, compare, and speculate about the future; when an answer is short, ask gently: why do you think that is, or can you give an example?",
  ],
};

function levelLine(level: { band: number; cefr: string }): string {
  const band = Number.isFinite(level.band) ? level.band.toFixed(1) : "5.0";
  const words =
    level.band < 5
      ? "Use simple everyday words and short, clear sentences, and speak a little slower than usual."
      : level.band < 7
        ? "Use natural everyday English with some topic vocabulary, at a calm pace."
        : "Use natural, varied English, including some less common vocabulary, at a natural pace.";
  return `The learner's level is about ${level.cefr} (IELTS band ${band}). ${words}`;
}

export function buildLiveInstructions(input: LivePromptInput): string {
  const questions = input.topic.questions
    .map((q) => q.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 6);
  const lines = [
    "You are Averna's friendly IELTS speaking partner. You are talking with an English learner by voice, to help them practise speaking.",
    ...MODE_LINES[input.mode],
    `Topic: ${input.topic.label}. Stay on this topic; if the learner drifts away, bring them back gently.`,
    ...(questions.length ? ["Questions you can use, in your own words and in any order:", ...questions.map((q) => `- ${q}`)] : []),
    levelLine(input.level),
    "How to talk:",
    "- Keep every turn short: one or two sentences, then stop and let the learner speak. The learner should talk much more than you.",
    "- Ask one question at a time and follow up on what the learner actually said.",
    "- Never lecture: no explanations, lists, grammar lessons or long answers.",
    "- If the learner makes a mistake, you may recast it naturally inside your reply (say the idea correctly once), at most once per turn, without pointing at the mistake.",
    "- Be warm and encouraging. If the learner is stuck, give a small hint or an easier question.",
    "- Speak only English. If the learner uses another language, answer in simple English and invite them to try in English.",
    "- If the learner asks for anything unrelated to this speaking practice, or anything harmful, unsafe or inappropriate, decline in one short sentence and return to the topic.",
    "- Don't ask for personal data (full name, address, phone number, school, passwords or account details). If the learner shares some, don't repeat it.",
    "- Don't claim to be human, and don't give band scores during the call.",
    input.resumed
      ? "The call dropped and has just reconnected: say in a few words that you're back, then ask a new question on the topic."
      : "Start now: greet the learner in one short sentence and ask your first question.",
  ];
  return lines.join("\n");
}

export interface LiveSessionInput {
  instructions: string;
  model: string;
  transcribeModel: string;
  voice: string;
}

/** Hints that keep hesitations in the student's transcript (filler counts need them). gpt-4o-* transcribers accept a free-text prompt. */
const TRANSCRIBE_PROMPT = "An English learner speaking. Keep hesitations and filler words such as um, uh, er and like.";

/**
 * The `session` part of POST /v1/realtime/calls. WebRTC negotiates the audio format
 * through SDP, so no `audio.*.format`. Semantic VAD with low eagerness waits longer
 * (up to ~8 s) before taking the turn — learners pause to think. `include` asks for
 * the per-token logprobs of the student's transcription (the pronunciation map).
 */
export function buildSessionConfig(input: LiveSessionInput): Record<string, unknown> {
  const transcription: Record<string, unknown> = { model: input.transcribeModel, language: "en" };
  if (input.transcribeModel.startsWith("gpt-4o")) transcription.prompt = TRANSCRIBE_PROMPT;
  return {
    type: "realtime",
    model: input.model,
    instructions: input.instructions,
    output_modalities: ["audio"],
    // A safety ceiling only (≈ 50 s of speech); the instructions keep turns short.
    max_output_tokens: 1024,
    audio: {
      input: {
        transcription,
        turn_detection: { type: "semantic_vad", eagerness: "low", create_response: true, interrupt_response: true },
      },
      output: { voice: input.voice },
    },
    include: ["item.input_audio_transcription.logprobs"],
  };
}
