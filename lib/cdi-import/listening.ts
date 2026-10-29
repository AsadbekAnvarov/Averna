/** Source Listening paper → ExamListeningTest (one whole recording, 4 parts × 10 questions). */

import type { ExamListeningTest, ListeningPart } from "../ielts/types";
import { attr, cleanText, findAll, hasClass, select, type HtmlDocument, type HtmlElement } from "./dom";
import { evidenceButtons, evidenceWindows } from "./evidence-windows";
import { convertGroup, questionBlocks, type ConvertIssue, type GroupContext, type GroupImage, type MultiPick } from "./groups";
import type { Literal } from "./literals";
import { IMPORT_VERSION, type ConvertResult } from "./reading";
import { paperTitle, type SourceMeta } from "./source-files";
import { collapse } from "./text";
import { convertTranscript, markedQuestions } from "./transcript";

export interface ExtractedAudio {
  sha256: string;
  durationMs: number;
}

/** Resolves a question image to its (future) URL and alt text; null drops it. */
export type ImageResolver = (img: GroupImage, instructions: string) => { url: string; alt: string } | null;

export function multiPicksOf(literals: Map<string, Literal>): MultiPick[] {
  const out: MultiPick[] = [];
  for (const name of ["multiPickGroups", "pickTwoGroups"]) {
    const v = literals.get(name);
    if (!Array.isArray(v)) continue;
    for (const g of v) {
      if (!g || typeof g !== "object" || Array.isArray(g)) continue;
      const o = g as Record<string, Literal>;
      const ids = Array.isArray(o.questionIds) ? o.questionIds.map(Number) : [];
      const answers = Array.isArray(o.correctAnswers) ? o.correctAnswers.map(String) : [];
      if (ids.length && answers.length) out.push({ questionIds: ids, correctAnswers: answers });
    }
  }
  return out;
}

function partTopic(section: HtmlElement, fallback: string | null): string {
  const banner = findAll(section, (e) => hasClass(e, "section-banner"))[0];
  if (banner) {
    for (const p of findAll(banner, (e) => e.tagName === "p")) {
      const t = cleanText(p, { skip: (e) => e.tagName === "strong" });
      const m = /^[—–-]\s*(.+)$/.exec(t);
      if (m) return collapse(m[1]);
    }
  }
  return fallback ?? "";
}

export function convertListening(
  doc: HtmlDocument,
  literals: Map<string, Literal>,
  meta: SourceMeta,
  audio: ExtractedAudio,
  resolveImage: ImageResolver,
): ConvertResult<ExamListeningTest> {
  const warnings: ConvertIssue[] = [];
  const errors: ConvertIssue[] = [];
  const images: GroupImage[] = [];
  const key = literals.get("correctAnswers");
  if (!key || typeof key !== "object" || Array.isArray(key)) {
    return { paper: null, images, warnings, errors: [{ file: meta.file, message: "No correctAnswers literal: the answer key can't be read." }] };
  }
  const keyObj = key as Record<string, Literal>;
  const keyNums = Object.keys(keyObj).map(Number).sort((a, b) => a - b);
  if (keyNums.length !== 40 || keyNums.some((n, i) => n !== i + 1)) {
    errors.push({ file: meta.file, questions: keyNums.filter((n) => !(n >= 1 && n <= 40)), message: `The answer key has ${keyNums.length} numbers, not exactly 1–40.` });
  }
  const rules = literals.get("textAnswerRules");
  const ctx: GroupContext = {
    file: meta.file,
    skill: "LISTENING",
    key: keyObj,
    literals,
    textRules: rules && typeof rules === "object" && !Array.isArray(rules) ? (rules as GroupContext["textRules"]) : null,
    multiPicks: multiPicksOf(literals),
    warnings,
    errors,
  };
  const transcript = convertTranscript(doc);
  if (transcript.length !== 4) errors.push({ file: meta.file, message: `The transcript has ${transcript.length} parts, not 4.` });
  const sections = select(doc, { cls: "test-section" })
    .filter((s) => attr(s, "data-section"))
    .sort((a, b) => Number(attr(a, "data-section")) - Number(attr(b, "data-section")));
  if (sections.length !== 4) errors.push({ file: meta.file, message: `Found ${sections.length} question sections, not 4.` });
  const parts: ListeningPart[] = sections.slice(0, 4).map((sec, i) => {
    const groups = questionBlocks(sec)
      .map((b) => convertGroup(b, ctx))
      .filter((g): g is NonNullable<typeof g> => !!g)
      .map(({ group, images: imgs }) => {
        const resolved = imgs.map((img) => resolveImage(img, group.instructions)).filter((x): x is { url: string; alt: string } => !!x);
        images.push(...imgs);
        return resolved.length ? { ...group, images: resolved } : group;
      });
    const topic = partTopic(sec, transcript[i]?.topic ?? null);
    return {
      id: `${meta.id}-p${i + 1}`,
      title: topic || `Part ${i + 1}`,
      context: topic || `Part ${i + 1}`,
      speakers: [],
      script: transcript[i]?.lines ?? [],
      groups,
    };
  });
  // Every question should have an answer marker in the transcript.
  const marked = markedQuestions(transcript);
  const unmarked = keyNums.filter((n) => n >= 1 && n <= 40 && !marked.has(n));
  if (unmarked.length) warnings.push({ file: meta.file, questions: unmarked, message: "No answer marker in the transcript for these questions." });
  const windows = evidenceWindows(evidenceButtons(doc), audio.durationMs, meta.file, warnings);
  const paper: ExamListeningTest = {
    format: "exam-v2",
    skill: "LISTENING",
    id: meta.id,
    title: paperTitle("LISTENING", meta.number),
    description: "Averna CDI · Listening",
    difficulty: "Medium",
    source: "imported",
    parts,
    recordingMode: "whole",
    recordingDurationMs: audio.durationMs,
    recordingSha256: audio.sha256,
    imported: { provider: "user-supplied-cdi", file: meta.file, sha256: meta.sha256, importVersion: IMPORT_VERSION },
    ...(Object.keys(windows).length ? { evidenceWindows: windows } : {}),
  };
  return { paper: errors.length ? null : paper, images, warnings, errors };
}
