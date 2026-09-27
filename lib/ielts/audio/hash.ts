/**
 * The fingerprint of one part's recording (ListeningAudio.scriptHash).
 *
 * sha256 of everything that changes what the file sounds like: the part's
 * speakers, context and script (speaker / text / pauseAfter), the programme
 * around it (part number, question range, end-of-test line), the voice cast
 * and instructions, the TTS model, and the programme / cast / render versions.
 * A stored recording is only served while its hash matches — edit a script,
 * renumber questions or change the voices and the part falls back to browser
 * voices until it's rendered again ("eskirgan" in the admin).
 *
 * SERVER ONLY (node:crypto).
 */

import { createHash } from "crypto";
import type { ExamListeningTest } from "../types";
import { PROGRAMME_VERSION, fileProgramme } from "./programme";
import { VOICE_CAST_VERSION, castVoices } from "./voices";

/** Bump when render.ts changes how a file is put together (gaps, chunking, silence). */
export const AUDIO_RENDER_VERSION = 1;

export function partAudioHash(test: Pick<ExamListeningTest, "parts">, partIndex: number, voiceModel: string): string | null {
  const part = test.parts[partIndex];
  const programme = fileProgramme(test, partIndex);
  if (!part || !programme) return null;
  const cast = castVoices(part);
  const payload = {
    render: AUDIO_RENDER_VERSION,
    programme: PROGRAMME_VERSION,
    voices: VOICE_CAST_VERSION,
    model: voiceModel,
    speakers: (part.speakers ?? []).map((s) => [s?.name ?? "", s?.gender ?? "", s?.accent ?? ""]),
    context: part.context ?? "",
    script: (part.script ?? []).map((l) => [l?.speaker ?? "", l?.text ?? "", Number(l?.pauseAfter) || 0]),
    lines: programme.lines.map((l) => [l.speaker, l.text, Number(l.pauseAfter) || 0]),
    cast: Array.from(cast.entries()).map(([name, c]) => [name, c.voice, c.instructions]),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
