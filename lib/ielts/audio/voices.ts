/**
 * Casting for the pre-rendered Listening audio (OpenAI text-to-speech).
 *
 * Deterministic: the same part always gets the same voices, so a re-render
 * sounds the same, and the cast is part of the recording's scriptHash.
 * - Speakers get a voice of their gender; same-gender speakers in one part
 *   always get DIFFERENT voices (the start point in the pool comes from a hash
 *   of the speaker, so tests don't all sound alike).
 * - gpt-4o-mini-tts `instructions` carry the accent (British / American /
 *   Australian; British when unset) and a natural, unhurried exam-recording
 *   delivery — careful with names, numbers and spelled-out letters.
 * - Every announcement is read by ONE consistent, neutral British narrator,
 *   whose voice no speaker ever uses.
 *
 * Pure (no server imports): offline checks run it too. Bump VOICE_CAST_VERSION
 * when the pools change (instruction text is hashed as it is).
 */

import { NARRATOR } from "../tts";
import type { ListeningSpeaker, VoiceAccent, VoiceGender } from "../types";

export const VOICE_CAST_VERSION = 1;

/** OpenAI speech voices used here (all accepted by gpt-4o-mini-tts; a subset of TtsVoice). */
export type CastVoice = "alloy" | "ash" | "ballad" | "coral" | "echo" | "fable" | "nova" | "onyx" | "sage" | "shimmer" | "verse";

export interface VoiceCast {
  voice: CastVoice;
  instructions: string;
  accent: VoiceAccent;
  /** null for the narrator. */
  gender: VoiceGender | null;
}

/** The narrator's voice — reserved: no speaker gets it. */
export const NARRATOR_VOICE: CastVoice = "fable";

const POOLS: Record<VoiceGender, CastVoice[]> = {
  female: ["coral", "nova", "shimmer", "sage", "alloy"],
  male: ["ash", "onyx", "echo", "verse", "ballad"],
};

const ACCENT_TEXT: Record<VoiceAccent, string> = {
  british: "British English — a standard Southern English accent",
  american: "American English — a standard General American accent",
  australian: "Australian English — a standard, educated Australian accent",
};

/** When a part has more same-gender speakers than voices, sharers get a different register. */
const REGISTERS = [
  "Register: a noticeably deeper, older-sounding voice than usual.",
  "Register: a noticeably lighter, younger-sounding voice than usual.",
];

const CLOSING = "Read the text exactly as written. Do not add any words, sounds, music or background noise.";

export const NARRATOR_INSTRUCTIONS = [
  "Voice: the announcer on an official IELTS Listening test recording.",
  "Accent: British English — neutral Received Pronunciation.",
  "Delivery: calm, clear, neutral and formal — an exam announcer, not a character.",
  "Pacing: measured and unhurried, with a short pause after each sentence. Say question numbers clearly.",
  CLOSING,
].join("\n");

function oneLine(text: string | null | undefined, max = 300): string {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** FNV-1a, 32-bit. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function speakerInstructions(name: string, gender: VoiceGender, accent: VoiceAccent, context: string, share: number): string {
  return [
    `Voice: ${oneLine(name, 60)}, a ${gender === "male" ? "man" : "woman"} speaking in an IELTS Listening recording.${context ? ` Situation: ${context}` : ""}`,
    `Accent: ${ACCENT_TEXT[accent]}. Keep it natural and consistent on every line.`,
    "Delivery: natural and conversational, like a real person in this situation — not a newsreader and not theatrical. Friendly in conversations; clear and engaging in talks and lectures.",
    "Pacing: calm and unhurried, a little slower than everyday speech, with natural pauses at commas and full stops.",
    "Pronunciation: say names, numbers, prices, dates and times clearly. When a word is spelled out letter by letter, say each letter distinctly with a short pause between the letters.",
    share > 0 ? REGISTERS[(share - 1) % REGISTERS.length] : "",
    CLOSING,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Speaker name → voice + instructions for one part (always includes the Narrator). */
export function castVoices(part: { speakers?: ListeningSpeaker[] | null; context?: string | null }): Map<string, VoiceCast> {
  const out = new Map<string, VoiceCast>();
  const used = new Map<CastVoice, number>();
  const context = oneLine(part.context);
  for (const sp of part.speakers ?? []) {
    if (!sp || typeof sp.name !== "string" || !sp.name.trim() || sp.name === NARRATOR || out.has(sp.name)) continue;
    const gender: VoiceGender = sp.gender === "male" ? "male" : "female";
    const accent: VoiceAccent = sp.accent === "american" || sp.accent === "australian" ? sp.accent : "british";
    const pool = POOLS[gender];
    const start = hash32(`${gender}|${accent}|${sp.name.trim().toLowerCase()}`) % pool.length;
    let voice: CastVoice | null = null;
    for (let k = 0; k < pool.length && !voice; k++) {
      const v = pool[(start + k) % pool.length];
      if (!used.has(v)) voice = v;
    }
    let share = 0;
    if (!voice) {
      // More same-gender speakers than voices: share the least-used voice, in another register.
      voice = pool.reduce((a, b) => ((used.get(b) ?? 0) < (used.get(a) ?? 0) ? b : a), pool[start]);
      share = used.get(voice) ?? 0;
    }
    used.set(voice, (used.get(voice) ?? 0) + 1);
    out.set(sp.name, { voice, accent, gender, instructions: speakerInstructions(sp.name, gender, accent, context, share) });
  }
  out.set(NARRATOR, { voice: NARRATOR_VOICE, accent: "british", gender: null, instructions: NARRATOR_INSTRUCTIONS });
  return out;
}

/** The cast entry for a script line's speaker (unknown speakers read as the narrator, like the browser player). */
export function voiceFor(cast: Map<string, VoiceCast>, speaker: string): VoiceCast {
  return cast.get(speaker) ?? cast.get(NARRATOR) ?? { voice: NARRATOR_VOICE, accent: "british", gender: null, instructions: NARRATOR_INSTRUCTIONS };
}
