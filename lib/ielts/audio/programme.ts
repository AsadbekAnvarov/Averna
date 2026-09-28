/**
 * The Listening "programme" — everything a candidate hears in one part, in order:
 *
 *   Narrator  "Part 2. You will hear …"                                    + 1 s
 *   Narrator  "First, you have some time to look at questions 11 to 20."   + reading time
 *   … the part's script (speakers, in-part announcements, scripted pauses) …
 *   Narrator  "That is the end of Part 2."                                 + 3 s (1 s after the last part)
 *   Narrator  "That is the end of the listening test. You now have two minutes to check
 *              your answers."                                              (last part of the run only)
 *
 * Built in ONE place so the browser-voice player (listening-exam-runner → lib/ielts/tts
 * ScriptPlayer) and the pre-rendered MP3 (lib/ielts/audio/render) say exactly the same
 * thing. The MP3 bakes the exam timings (fileProgramme = a full-test run: 30 s reading
 * time, the end-of-test line in the last part); practice runs can skip long silences.
 *
 * Pure and client-safe. Bump PROGRAMME_VERSION whenever the wording or the timings
 * change: it is part of every recording's scriptHash, so existing files turn "stale".
 */

import { LISTENING_FULL, partRange } from "../format";
import { NARRATOR } from "../tts";
import type { ScriptLine } from "../types";

export const PROGRAMME_VERSION = 1;

/** Reading time before each part in the exam (and in every full-test run). */
export const EXAM_READING_SECONDS = 30;
/** Reading time in a single-part practice run read by browser voices. */
export const PRACTICE_READING_SECONDS = 15;
/** Silence after "That is the end of Part N." before the next part. */
export const BETWEEN_PARTS_SECONDS = 3;
/** Silent gaps at least this long count as "reading time" (status + Skip). */
export const READING_GAP_MS = 4000;

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

export function countWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

export function minutesPhrase(n: number): string {
  return n === 1 ? "one minute" : `${countWord(n)} minutes`;
}

/** Collapse whitespace and make sure the text ends like a sentence. */
export function asSentence(text: string | undefined | null): string {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return /[.!?…]["'”’)\]]*$/.test(t) ? t : `${t}.`;
}

export function spokenRange(from: number, to: number): string {
  return from === to ? `question ${from}` : `questions ${from} to ${to}`;
}

/** Which exam announcement a programme line is (script lines have none). */
export type AnnouncementKind = "intro" | "preview" | "end" | "final";

export interface ProgrammeLine extends ScriptLine {
  /** Index of the line in part.script; -1 for an exam announcement. */
  i: number;
  kind?: AnnouncementKind;
}

export interface Programme {
  lines: ProgrammeLine[];
  /** Index (in `lines`) of the first recording line, after the announcements + reading time. */
  scriptStart: number;
  scriptCount: number;
}

export interface ProgrammeOptions {
  /** Part number in the full test (1–4). */
  no: number;
  /** Silence after "First, you have some time to look at …". */
  readingSeconds: number;
  /** Last part of this run: a shorter closing pause and the end-of-test announcement. */
  last: boolean;
  /** Minutes to check answers, announced at the end of the last part. */
  checkMinutes: number;
}

type ScriptSource = { script?: ScriptLine[] | null };
type ProgrammeSource = ScriptSource & { context?: string | null; groups: { questions: { n: number }[] }[] };

/** Recording lines with their index in part.script: anything with words or a scripted pause. */
export function recordingEntries(part: ScriptSource): { line: ScriptLine; i: number }[] {
  const out: { line: ScriptLine; i: number }[] = [];
  (part.script ?? []).forEach((l, i) => {
    if (l && (String(l.text ?? "").trim() || (Number(l.pauseAfter) || 0) > 0)) out.push({ line: l, i });
  });
  return out;
}

/** Lines the player goes through: anything with words or a scripted pause. */
export function recordingLines(part: ScriptSource): ScriptLine[] {
  return recordingEntries(part).map((e) => e.line);
}

/** Lines with words (the practice transcript). */
export function transcriptLines(part: ScriptSource): ScriptLine[] {
  return (part.script ?? []).filter((l) => l && String(l.text ?? "").trim());
}

/** Narrator announcements + reading time + the part's recording. */
export function buildProgramme(part: ProgrammeSource, o: ProgrammeOptions): Programme {
  const lines: ProgrammeLine[] = [];
  const context = asSentence(part.context);
  lines.push({ speaker: NARRATOR, text: context ? `Part ${o.no}. ${context}` : `Part ${o.no}.`, pauseAfter: 1, i: -1, kind: "intro" });
  const range = partRange(part);
  if (range) {
    lines.push({
      speaker: NARRATOR,
      text: `First, you have some time to look at ${spokenRange(range.from, range.to)}.`,
      pauseAfter: o.readingSeconds,
      i: -1,
      kind: "preview",
    });
  }
  const scriptStart = lines.length;
  const script = recordingEntries(part);
  for (const e of script) lines.push({ ...e.line, i: e.i });
  lines.push({ speaker: NARRATOR, text: `That is the end of Part ${o.no}.`, pauseAfter: o.last ? 1 : BETWEEN_PARTS_SECONDS, i: -1, kind: "end" });
  if (o.last) {
    lines.push({
      speaker: NARRATOR,
      text: `That is the end of the listening test. You now have ${minutesPhrase(o.checkMinutes)} to check your answers.`,
      i: -1,
      kind: "final",
    });
  }
  return { lines, scriptStart, scriptCount: script.length };
}

/**
 * What the pre-rendered file of one part contains: the programme of a full-test
 * run (exam reading time; the end-of-test announcement in the test's last part).
 */
export function fileProgramme(test: { parts: ProgrammeSource[] }, partIndex: number): Programme | null {
  const part = test.parts[partIndex];
  if (!part) return null;
  return buildProgramme(part, {
    no: partIndex + 1,
    readingSeconds: EXAM_READING_SECONDS,
    last: partIndex === test.parts.length - 1,
    checkMinutes: LISTENING_FULL.reviewMinutes,
  });
}
