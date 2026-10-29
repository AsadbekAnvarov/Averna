/** Source Reading paper → ExamReadingTest (3 passages, questions 1–40, 60 minutes). */

import type { ExamParagraph, ExamReadingTest, ReadingPart } from "../ielts/types";
import { cleanText, elementChildren, findAll, hasClass, select, type HtmlDocument, type HtmlElement } from "./dom";
import { convertGroup, questionBlocks, type ConvertIssue, type GroupContext, type GroupImage } from "./groups";
import type { Literal } from "./literals";
import { paperTitle, type SourceMeta } from "./source-files";

export interface ConvertResult<T> {
  paper: T | null;
  images: GroupImage[];
  warnings: ConvertIssue[];
  errors: ConvertIssue[];
}

export const IMPORT_VERSION = 2;

function passageParagraphs(panel: HtmlElement): { title: string; subtitle?: string; paragraphs: ExamParagraph[] } {
  const title = cleanText(findAll(panel, (e) => e.tagName === "h2" || e.tagName === "h1")[0] ?? panel).slice(0, 300);
  let subtitle: string | undefined;
  const paragraphs: ExamParagraph[] = [];
  const walk = (el: HtmlElement) => {
    for (const c of elementChildren(el)) {
      if (c.tagName === "h1" || c.tagName === "h2" || hasClass(c, "mh-drop-slot")) continue;
      if (c.tagName === "p" && hasClass(c, "subtitle") && !paragraphs.length && !subtitle) {
        subtitle = cleanText(c);
        continue;
      }
      if (c.tagName === "p" || /^h[3-6]$/.test(c.tagName) || hasClass(c, "passage-section-title") || hasClass(c, "passage-footnote")) {
        const letterEl = findAll(c, (e) => hasClass(e, "letter"))[0];
        const label = letterEl ? cleanText(letterEl) : undefined;
        const text = cleanText(c, { skip: (e) => hasClass(e, "letter") || hasClass(e, "mh-drop-slot") });
        if (text) paragraphs.push(label ? { label, text } : { text });
        continue;
      }
      if (c.tagName === "div" || c.tagName === "section" || c.tagName === "article" || c.tagName === "blockquote") walk(c);
    }
  };
  walk(panel);
  return { title, subtitle, paragraphs };
}

export function convertReading(doc: HtmlDocument, literals: Map<string, Literal>, meta: SourceMeta): ConvertResult<ExamReadingTest> {
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
  const ctx: GroupContext = { file: meta.file, skill: "READING", key: keyObj, literals, multiPicks: [], warnings, errors };
  const parts: ReadingPart[] = [];
  for (let i = 1; i <= 3; i++) {
    const passage = select(doc, { id: `passage${i}` })[0] ?? select(doc, { cls: "passage-content" })[i - 1];
    const questions = select(doc, { id: `questions${i}` })[0] ?? select(doc, { cls: "questions-content" })[i - 1];
    if (!passage || !questions) {
      errors.push({ file: meta.file, part: i, message: `Passage ${i} or its questions are missing.` });
      continue;
    }
    const { title, subtitle, paragraphs } = passageParagraphs(passage);
    const groups = questionBlocks(questions)
      .map((b) => convertGroup(b, ctx))
      .filter((g): g is NonNullable<typeof g> => !!g);
    for (const g of groups) images.push(...g.images);
    parts.push({ id: `${meta.id}-p${i}`, title, ...(subtitle ? { subtitle } : {}), paragraphs, groups: groups.map((g) => g.group) });
  }
  const paper: ExamReadingTest = {
    format: "exam-v2",
    skill: "READING",
    id: meta.id,
    title: paperTitle("READING", meta.number),
    description: "Averna CDI · Academic Reading",
    difficulty: "Medium",
    timeLimit: 60,
    source: "imported",
    parts,
    imported: { provider: "user-supplied-cdi", file: meta.file, sha256: meta.sha256, importVersion: IMPORT_VERSION },
  };
  return { paper: errors.length ? null : paper, images, warnings, errors };
}
