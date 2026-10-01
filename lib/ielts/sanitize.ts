/**
 * Strip answer keys and explanations before content is sent to the browser.
 * The CD-IELTS runners only ever receive these client shapes; grading happens
 * on the server against the full test.
 *
 * Listening also loses every part's `transcript` (a real recording's words —
 * it contains every gap answer) and the test's `audio`: a test with one real
 * recording (CDI) gets `recording` instead — the file's URL, length and part
 * starts, but never `questionTimes` (where each answer is spoken). The
 * transcript and the question times are shown on the result page only, after
 * submission.
 */

import { cdiAudioUrl } from "./cdi-audio";
import type {
  ClientGroup,
  ClientListeningTest,
  ClientReadingTest,
  ExamGroup,
  ExamListeningTest,
  ExamReadingTest,
  ListeningRecording,
  ListeningTestAudio,
} from "./types";

export function toClientGroup(g: ExamGroup): ClientGroup {
  return {
    ...g,
    questions: g.questions.map(({ answer: _a, explanation: _e, ...q }) => q),
  };
}

export function toClientReading(test: ExamReadingTest, partIndex?: number): ClientReadingTest {
  const parts = partIndex == null ? test.parts : test.parts.slice(partIndex, partIndex + 1);
  return { ...test, parts: parts.map((p) => ({ ...p, groups: p.groups.map(toClientGroup) })) };
}

/**
 * The public part of a real recording: its URL (null → no recording), the
 * length when it's a positive number, and the part starts when there is one
 * per part, ascending (and inside the file when its length is known).
 */
export function toClientRecording(audio: ListeningTestAudio | undefined, partCount: number): ListeningRecording | undefined {
  if (!audio || typeof audio !== "object") return undefined;
  const url = cdiAudioUrl(audio.file);
  if (!url) return undefined;
  const out: ListeningRecording = { url };
  const dur = Number(audio.durationSec);
  if (Number.isFinite(dur) && dur > 0) out.durationSec = dur;
  const starts = audio.partStarts;
  if (
    Array.isArray(starts) &&
    starts.length === partCount &&
    starts.every((s, i) => typeof s === "number" && Number.isFinite(s) && s >= 0 && (i === 0 || s > starts[i - 1])) &&
    (out.durationSec == null || starts[starts.length - 1] < out.durationSec)
  ) {
    out.partStarts = [...starts];
  }
  return out;
}

/**
 * AFTER SUBMISSION ONLY (result pages): the recording with the second at which
 * each answer is spoken, for "Play from here". Null without a real recording.
 */
export function toReviewRecording(
  test: Pick<ExamListeningTest, "audio"> | null | undefined
): { url: string; questionTimes?: Record<number, number> } | null {
  const audio = test?.audio;
  const url = audio ? cdiAudioUrl(audio.file) : null;
  if (!audio || !url) return null;
  const times: Record<number, number> = {};
  for (const [k, v] of Object.entries(audio.questionTimes ?? {})) {
    const n = Number(k);
    if (Number.isInteger(n) && n > 0 && typeof v === "number" && Number.isFinite(v) && v >= 0) times[n] = v;
  }
  return Object.keys(times).length ? { url, questionTimes: times } : { url };
}

/**
 * `partStarts` (in `recording`) always describes the whole file, indexed by
 * the part's position in the full test — also when only one part is sent.
 */
export function toClientListening(test: ExamListeningTest, partIndex?: number): ClientListeningTest {
  const { audio, parts: allParts, ...rest } = test;
  const parts = partIndex == null ? allParts : allParts.slice(partIndex, partIndex + 1);
  const recording = toClientRecording(audio, allParts.length);
  return {
    ...rest,
    parts: parts.map(({ transcript: _t, groups, ...p }) => ({ ...p, groups: groups.map(toClientGroup) })),
    ...(recording ? { recording } : {}),
  };
}
