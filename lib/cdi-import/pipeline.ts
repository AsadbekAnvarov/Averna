/**
 * One source file → a checked paper, its media and its report row. Pure
 * apart from CPU work: no file system, network or database access (the CLI
 * does the I/O). The source's scripts are parsed, never executed.
 */

import { indexMp3 } from "../ielts/audio/mp3-index";
import { windowsByPart } from "../ielts/segments";
import type { ExamListeningTest, ExamReadingTest, ExamTest, GroupKind } from "../ielts/types";
import { validateListeningTest, validateReadingTest } from "../ielts/validate";
import { proposeBoundaries, type BoundaryCandidate } from "./boundaries";
import { attr, parseHtml, scriptTexts, select } from "./dom";
import type { ConvertIssue, GroupImage } from "./groups";
import { findBannedReferences } from "./guard";
import { audioPath, decodePng, imageAlt, imageKind, imagePath, sha256Hex } from "./images";
import { contentHintCount, instructionLines } from "./instructions";
import { checkKey } from "./key-check";
import { convertListening, multiPicksOf } from "./listening";
import { allLiteralObjects, extractLiterals, LiteralError, type Literal } from "./literals";
import { decodeBase64, unpackEmbeddedAudio } from "./packed-audio";
import { extractPayloads, payloadRef, type Payload } from "./payloads";
import { convertReading } from "./reading";
import type { Pause } from "./silence";
import { identifySource, type SourceMeta } from "./source-files";

export const ASSET_PREFIX = "cdi-asset://";

export interface MediaFile {
  path: string;
  kind: "audio" | "image";
  sha256: string;
  bytes: Uint8Array;
}

export interface SourceResult {
  file: string;
  meta: SourceMeta | null;
  paper: ExamTest | null;
  included: boolean;
  errors: ConvertIssue[];
  warnings: ConvertIssue[];
  media: MediaFile[];
  audio: { path: string; sha256: string; bytes: number; durationMs: number } | null;
  key: { first: number; last: number; total: number; missed: number[] } | null;
  candidates: (BoundaryCandidate | null)[] | null;
  contentHints: number;
  instructions: string[];
  kinds: GroupKind[];
  questions: number;
  parts: number;
}

export interface SourceInput {
  file: string;
  bytes: Uint8Array;
  /** Future public base of the media, e.g. "https://owner.github.io/averna-cdi-audio/". */
  mediaBase: string;
  /** Pause detection for boundary candidates (async: the MP3 is decoded). Absent → evidence windows only. */
  detectPauses?: (bytes: Uint8Array, index: ReturnType<typeof indexMp3>) => Promise<Pause[]>;
}

function withAssetsResolved<T>(paper: T, mediaBase: string): T {
  const base = mediaBase.endsWith("/") ? mediaBase : `${mediaBase}/`;
  return JSON.parse(JSON.stringify(paper).split(ASSET_PREFIX).join(base)) as T;
}

function recordingOf(payloads: Payload[], audioSrc: string | null, file: string): { bytes: Uint8Array } | { error: string } {
  const ref = payloadRef(audioSrc);
  try {
    if (ref != null && payloads[ref]?.kind === "data-uri") return { bytes: decodeBase64(payloads[ref].text) };
    const packed = payloads.find((p) => p.kind === "packed-script");
    if (packed) {
      const a = packed.attrs ?? {};
      if ((a["data-encoding"] ?? "") !== "utf8-seven-bit") return { error: `Unknown recording encoding "${a["data-encoding"] ?? ""}".` };
      return {
        bytes: unpackEmbeddedAudio({ text: packed.text, compressedBytes: Number(a["data-compressed-bytes"]), originalBytes: Number(a["data-original-bytes"]) }),
      };
    }
    return { error: `${file}: no embedded recording was found.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function convertSource(input: SourceInput): Promise<SourceResult> {
  const id = identifySource(input.file);
  const result: SourceResult = {
    file: input.file,
    meta: null,
    paper: null,
    included: false,
    errors: [],
    warnings: [],
    media: [],
    audio: null,
    key: null,
    candidates: null,
    contentHints: 0,
    instructions: [],
    kinds: [],
    questions: 0,
    parts: 0,
  };
  if (!id) {
    result.errors.push({ file: input.file, message: "The file name doesn't name a Reading or Listening test." });
    return result;
  }
  const meta: SourceMeta = { ...id, file: input.file, sha256: sha256Hex(input.bytes) };
  result.meta = meta;
  const { html, payloads } = extractPayloads(Buffer.from(input.bytes).toString("utf8"));
  const doc = parseHtml(html);
  const scripts = scriptTexts(doc);
  let literals: Map<string, Literal>;
  try {
    // The key must be a plain literal (LiteralError otherwise); everything else is read when it is one.
    const strict = extractLiterals(scripts, ["correctAnswers", "textAnswerRules", "multiPickGroups", "pickTwoGroups"]);
    literals = allLiteralObjects(scripts);
    for (const [k, v] of Object.entries(strict)) literals.set(k, v);
  } catch (e) {
    result.errors.push({ file: input.file, message: e instanceof LiteralError ? e.message : `The scripts can't be parsed: ${e instanceof Error ? e.message : String(e)}` });
    return result;
  }

  const pending: MediaFile[] = [];
  let paper: ExamTest | null = null;
  let errors: ConvertIssue[] = [];
  let warnings: ConvertIssue[] = [];

  if (meta.skill === "READING") {
    const r = convertReading(doc, literals, meta);
    paper = r.paper;
    errors = r.errors;
    warnings = r.warnings;
  } else {
    const audioEl = select(doc, { tag: "audio" }).find((a) => payloadRef(attr(a, "src")) != null) ?? null;
    const rec = recordingOf(payloads, audioEl ? attr(audioEl, "src") : null, input.file);
    if ("error" in rec) {
      result.errors.push({ file: input.file, message: rec.error });
      return result;
    }
    let index: ReturnType<typeof indexMp3>;
    try {
      index = indexMp3(rec.bytes);
    } catch (e) {
      result.errors.push({ file: input.file, message: e instanceof Error ? e.message : "The recording has no MPEG Layer III frames." });
      return result;
    }
    if (!(index.durationMs > 0)) {
      result.errors.push({ file: input.file, message: "The recording has no duration." });
      return result;
    }
    const sha = sha256Hex(rec.bytes);
    const aPath = audioPath(meta.id, sha);
    pending.push({ path: aPath, kind: "audio", sha256: sha, bytes: rec.bytes });
    result.audio = { path: aPath, sha256: sha, bytes: rec.bytes.length, durationMs: index.durationMs };
    const imageErrors: ConvertIssue[] = [];
    const resolveImage = (img: GroupImage, instructions: string) => {
      const p = payloads[img.payload];
      try {
        if (!p || p.kind !== "data-uri" || p.mime !== "image/png") throw new Error("The question image is not an embedded PNG.");
        const bytes = decodePng(p.text);
        const s = sha256Hex(bytes);
        const path = imagePath(meta.id, img.from, img.to, s);
        if (!pending.some((m) => m.path === path)) pending.push({ path, kind: "image", sha256: s, bytes });
        return { url: `${ASSET_PREFIX}${path}`, alt: imageAlt(imageKind(instructions, img.alt), img.from, img.to, img.alt) };
      } catch (e) {
        imageErrors.push({ file: input.file, questions: [img.from, img.to], message: e instanceof Error ? e.message : String(e) });
        return null;
      }
    };
    const r = convertListening(doc, literals, meta, { sha256: sha, durationMs: index.durationMs }, resolveImage);
    paper = r.paper;
    errors = [...r.errors, ...imageErrors];
    warnings = r.warnings;
    if (paper) {
      const wins = windowsByPart(paper as ExamListeningTest);
      let pauses: Pause[] = [];
      if (input.detectPauses) {
        try {
          pauses = await input.detectPauses(rec.bytes, index);
        } catch (e) {
          warnings.push({ file: input.file, message: `Pause detection failed (${e instanceof Error ? e.message : String(e)}); only answer windows were used.` });
        }
      } else warnings.push({ file: input.file, message: "Pause detection was not run; only answer windows were used." });
      const b = proposeBoundaries({ durationMs: index.durationMs, windowsByPart: wins.some((w) => w.length) ? wins : null, pauses });
      result.candidates = b.candidates;
      for (const w of b.warnings) warnings.push({ file: input.file, message: w });
    }
  }

  result.errors.push(...errors);
  result.warnings.push(...warnings);
  if (!paper) return result;

  // Checks: structure, key 40/40 (first and last alternatives), banned references.
  const resolved = withAssetsResolved(paper, input.mediaBase);
  const report = paper.skill === "READING" ? validateReadingTest(resolved as ExamReadingTest, { requireFull: true }) : validateListeningTest(resolved as ExamListeningTest, { requireFull: true });
  for (const e of report.errors) result.errors.push({ file: input.file, message: `Validation: ${e}` });
  const noExplanation = report.warnings.filter((w) => /no explanation/.test(w)).length;
  for (const w of report.warnings.filter((x) => !/no explanation/.test(x))) result.warnings.push({ file: input.file, message: `Validation: ${w}` });
  if (noExplanation) result.warnings.push({ file: input.file, message: `Validation: ${noExplanation} questions have no explanation (expected: the source has none).` });

  const key = literals.get("correctAnswers") as Record<string, Literal>;
  const k = checkKey(paper, key, multiPicksOf(literals));
  result.key = { first: k.first.correct, last: k.last.correct, total: k.first.total, missed: k.missed };
  if (k.first.correct !== 40 || k.last.correct !== 40 || k.first.total !== 40) {
    result.errors.push({ file: input.file, questions: k.missed, message: `The source key scores ${k.first.correct}/${k.first.total} (first alternatives) and ${k.last.correct}/${k.last.total} (last).` });
  }
  for (const b of findBannedReferences(paper)) result.errors.push({ file: input.file, message: `Source reference found (IELTS_Volume / t.me) in ${b.where}.` });

  result.contentHints = contentHintCount(paper);
  if (result.contentHints) result.errors.push({ file: input.file, message: `${result.contentHints} question-content items would get an L1 hint (expected 0).` });
  result.instructions = instructionLines(paper);
  result.kinds = Array.from(new Set(paper.parts.flatMap((p) => p.groups.map((g) => g.kind))));
  result.questions = paper.parts.reduce((n, p) => n + p.groups.reduce((m, g) => m + g.questions.length, 0), 0);
  result.parts = paper.parts.length;
  result.paper = paper;
  result.included = result.errors.length === 0;
  if (result.included) result.media = pending.sort((a, b) => a.path.localeCompare(b.path));
  return result;
}
