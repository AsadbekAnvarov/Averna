/**
 * Programme + synthesised clips → one MP3 and its timeline (pure; the
 * text-to-speech side lives in render.ts).
 *
 * For every programme line: its clip(s) (a long line may come in sentence
 * chunks), then its scripted pause plus the short gap before the next line —
 * the same pauses the browser-voice player makes. The timeline records where
 * each line's speech starts and ends (i = script line index, -1 = an exam
 * announcement, with its kind).
 */

import type { ListeningPartAudio } from "../types";
import { Mp3Assembler, Mp3Error } from "./mp3";
import type { AssembleOptions, Mp3Format, ParsedMp3 } from "./mp3";
import type { ProgrammeLine } from "./programme";

/** Gaps between lines, as in the browser player (lib/ielts/tts: 140 / 320 ms); between chunks of one line. */
export const LINE_GAPS = { sameSpeakerSec: 0.14, newSpeakerSec: 0.32, chunkSec: 0.12 };

export interface AssembledPart {
  bytes: Uint8Array;
  durationMs: number;
  timeline: ListeningPartAudio["timeline"];
  /** Audio frames (the Xing/Info frame excluded). */
  frames: number;
  format: Mp3Format;
  tag: "Xing" | "Info";
  audioKbps: number | null;
  silenceKbps: number;
}

/** Pause after line k: its pauseAfter + the gap before the next line (none after the last). */
export function pauseAfterLine(lines: ProgrammeLine[], k: number): number {
  const line = lines[k];
  const next = lines[k + 1];
  const pause = Math.max(0, Number(line?.pauseAfter) || 0);
  const gap = next ? (next.speaker !== line.speaker ? LINE_GAPS.newSpeakerSec : LINE_GAPS.sameSpeakerSec) : 0;
  return pause + gap;
}

/**
 * `clips[k]` = the parsed clip(s) of programme line k, in order ([] for a line
 * without words). Throws Mp3Error when clips don't fit together.
 */
export function assembleProgramme(lines: ProgrammeLine[], clips: ParsedMp3[][], opts: AssembleOptions = {}): AssembledPart {
  if (clips.length !== lines.length) throw new Mp3Error("Every programme line needs its clips.");
  const first = clips.find((c) => c.length > 0)?.[0];
  if (!first) throw new Mp3Error("No audio to assemble.");
  const asm = new Mp3Assembler(first.format);
  const timeline: ListeningPartAudio["timeline"] = [];
  lines.forEach((line, k) => {
    const start = asm.frameCount;
    clips[k].forEach((clip, j) => {
      if (j > 0) asm.addSilence(LINE_GAPS.chunkSec);
      asm.addClip(clip);
    });
    const end = asm.frameCount;
    const entry: ListeningPartAudio["timeline"][number] = { i: line.i, startMs: asm.msAt(start), endMs: asm.msAt(end) };
    if (line.kind) entry.kind = line.kind;
    timeline.push(entry);
    asm.addSilence(pauseAfterLine(lines, k));
  });
  const out = asm.finish(opts);
  return {
    bytes: out.bytes,
    durationMs: out.durationMs,
    timeline,
    frames: out.frames,
    format: asm.format,
    tag: out.tag,
    audioKbps: out.audioKbps,
    silenceKbps: out.silenceKbps,
  };
}
