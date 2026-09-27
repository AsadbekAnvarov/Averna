/**
 * Format helpers for exam-v2 content — numbering, answer rules, templates,
 * answered-state and cheap summaries. Pure and dependency-free (runs on the
 * server, in client components and in offline checks).
 */

import type {
  ClientGroup,
  ExamAnswers,
  ExamGroup,
  ExamListeningTest,
  ExamParagraph,
  ExamReadingTest,
  ExamSkill,
  ExamTestSummary,
  GroupKind,
  ListeningPart,
  ReadingPart,
  ScriptLine,
} from "./types";

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export const ROMAN = [
  "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x",
  "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx",
];

/** Full Academic Reading: 3 passages, 40 questions, 60 minutes. */
export const READING_FULL = { parts: 3, questions: 40, minutes: 60, minutesPerPart: 20 };
/** Full Listening: 4 parts × 10 questions; ~30 min audio + 2 min to check answers (CD-IELTS). */
export const LISTENING_FULL = { parts: 4, questions: 40, questionsPerPart: 10, reviewMinutes: 2 };

export const PLACEHOLDER_RE = /\[\[(\d+)\]\]/g;

/** Question numbers referenced as [[n]] placeholders, in order of appearance. */
export function placeholders(text: string | undefined | null): number[] {
  if (!text) return [];
  const out: number[] = [];
  for (const m of text.matchAll(PLACEHOLDER_RE)) out.push(Number(m[1]));
  return out;
}

/** Split a line into literal text and placeholder tokens (for rendering). */
export function splitPlaceholders(line: string): ({ type: "text"; value: string } | { type: "gap"; n: number })[] {
  const out: ({ type: "text"; value: string } | { type: "gap"; n: number })[] = [];
  let last = 0;
  for (const m of line.matchAll(PLACEHOLDER_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ type: "text", value: line.slice(last, i) });
    out.push({ type: "gap", n: Number(m[1]) });
    last = i + m[0].length;
  }
  if (last < line.length) out.push({ type: "text", value: line.slice(last) });
  return out;
}

export type TemplateLine =
  | { type: "heading"; text: string }
  | { type: "bullet"; text: string }
  | { type: "row"; cells: string[]; header: boolean }
  | { type: "text"; text: string }
  | { type: "blank" };

/**
 * Parse a gap template into lines. The first "| … |" row of each table block
 * is treated as the header row.
 */
export function parseTemplate(template: string): TemplateLine[] {
  const lines = template.replace(/\r\n/g, "\n").split("\n");
  const out: TemplateLine[] = [];
  let inTable = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();
    if (!t) {
      out.push({ type: "blank" });
      inTable = false;
      continue;
    }
    if (t.startsWith("|")) {
      const cells = t.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      out.push({ type: "row", cells, header: !inTable });
      inTable = true;
      continue;
    }
    inTable = false;
    if (t.startsWith("# ")) out.push({ type: "heading", text: t.slice(2).trim() });
    else if (t.startsWith("- ")) out.push({ type: "bullet", text: t.slice(2).trim() });
    else out.push({ type: "text", text: t });
  }
  return out;
}

type HasQuestions = { questions: { n: number }[] };
type HasGroups = { groups: HasQuestions[] };

export function groupRange(g: HasQuestions): { from: number; to: number } {
  const ns = g.questions.map((q) => q.n);
  return { from: Math.min(...ns), to: Math.max(...ns) };
}

export function partNumbers(part: HasGroups): number[] {
  return part.groups.flatMap((g) => g.questions.map((q) => q.n));
}

export function partRange(part: HasGroups): { from: number; to: number } | null {
  const ns = partNumbers(part);
  if (!ns.length) return null;
  return { from: Math.min(...ns), to: Math.max(...ns) };
}

export function testNumbers(test: { parts: HasGroups[] }, partIndex?: number): number[] {
  const parts = partIndex == null ? test.parts : test.parts.slice(partIndex, partIndex + 1);
  return parts.flatMap(partNumbers);
}

export function questionCount(test: { parts: HasGroups[] }, partIndex?: number): number {
  return testNumbers(test, partIndex).length;
}

/** "Questions 1–6" / "Question 7". */
export function rangeLabel(from: number, to: number): string {
  return from === to ? `Question ${from}` : `Questions ${from}–${to}`;
}

const NUMBER_WORDS = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX"];

function limitPhrase(limit: number, allowNumber?: boolean): string {
  const w = NUMBER_WORDS[limit] ?? String(limit);
  const base = limit === 1 ? "ONE WORD ONLY" : `NO MORE THAN ${w} WORDS`;
  if (!allowNumber) return base;
  return limit === 1 ? "ONE WORD AND/OR A NUMBER" : `${base} AND/OR A NUMBER`;
}

function letterSpan(keys: string[]): string {
  if (!keys.length) return "";
  if (keys.length <= 4) return keys.slice(0, -1).join(", ") + (keys.length > 1 ? " or " : "") + keys[keys.length - 1];
  return `${keys[0]}–${keys[keys.length - 1]}`;
}

/** The bold answer rule shown under a group's instructions (CD-IELTS wording). */
export function answerRuleFor(group: ExamGroup | ClientGroup, skill: ExamSkill): string {
  if (group.answerRule) return group.answerRule;
  const n = group.questions.length;
  switch (group.kind) {
    case "tfng":
      return "Choose TRUE if the statement agrees with the information, FALSE if the statement contradicts the information, or NOT GIVEN if there is no information on this.";
    case "ynng":
      return "Choose YES if the statement agrees with the claims of the writer, NO if the statement contradicts the claims of the writer, or NOT GIVEN if it is impossible to say what the writer thinks about this.";
    case "mcq": {
      const keys = group.questions[0]?.options?.map((o) => o.key) ?? ["A", "B", "C", "D"];
      return `Choose the correct letter, ${letterSpan(keys)}.`;
    }
    case "mcq-multi": {
      const keys = (group.options ?? []).map((o) => o.key);
      return `Choose ${NUMBER_WORDS[n] ?? n} letters, ${letterSpan(keys)}.`;
    }
    case "matching": {
      const keys = (group.options ?? []).map((o) => o.key);
      const isHeadings = keys.length > 0 && keys.every((k) => ROMAN.includes(k));
      const base = isHeadings
        ? `Choose the correct heading from the list of headings, ${keys[0]}–${keys[keys.length - 1]}.`
        : `Choose the correct letter, ${letterSpan(keys)}.`;
      return group.allowReuse ? `${base} NB You may use any letter more than once.` : base;
    }
    case "gap": {
      const limit = group.wordLimit ?? 2;
      const from = skill === "READING" ? " from the passage" : "";
      return `Write ${limitPhrase(limit, group.allowNumber)}${from} for each answer.`;
    }
    case "gap-box": {
      const keys = (group.options ?? []).map((o) => o.key);
      return `Choose the correct letter, ${letterSpan(keys)}, for each answer.`;
    }
  }
}

export function binaryChoices(kind: GroupKind): string[] {
  return kind === "ynng" ? ["YES", "NO", "NOT GIVEN"] : ["TRUE", "FALSE", "NOT GIVEN"];
}

/** Numbers the student has answered (drives the question navigator). */
export function answeredNumbers(groups: (ExamGroup | ClientGroup)[], answers: ExamAnswers): Set<number> {
  const done = new Set<number>();
  for (const g of groups) {
    if (g.kind === "mcq-multi") {
      const first = g.questions[0]?.n;
      const v = first != null ? answers[String(first)] : undefined;
      const picked = Array.isArray(v) ? v.filter(Boolean).length : typeof v === "string" && v ? v.split(",").filter(Boolean).length : 0;
      g.questions.slice(0, Math.min(picked, g.questions.length)).forEach((q) => done.add(q.n));
      continue;
    }
    for (const q of g.questions) {
      const v = answers[String(q.n)];
      if (typeof v === "string" ? v.trim().length > 0 : Array.isArray(v) && v.length > 0) done.add(q.n);
    }
  }
  return done;
}

/** The group containing question n (and the first number of that group). */
export function findGroup<G extends HasQuestions>(groups: G[], n: number): G | null {
  return groups.find((g) => g.questions.some((q) => q.n === n)) ?? null;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function partWordCount(part: ReadingPart): number {
  return part.paragraphs.reduce((n, p) => n + wordCount(p.text), 0);
}

export function scriptWordCount(script: ScriptLine[]): number {
  return script.reduce((n, l) => n + wordCount(l.text), 0);
}

export function scriptText(part: ListeningPart): string {
  return part.script.map((l) => l.text).join(" ");
}

export function passageText(part: ReadingPart): string {
  return part.paragraphs.map((p) => p.text).join("\n\n");
}

/** Split legacy plain text into paragraphs (blank-line separated). */
export function splitParagraphs(text: string): ExamParagraph[] {
  const parts = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
  return (parts.length ? parts : [text.trim()]).map((t) => ({ text: t }));
}

/** Only the script matters for timing, so client-safe tests (ClientListeningTest) work too. */
type HasScript = { script: ScriptLine[] };

/** Rough spoken length: ~150 words per minute plus scripted pauses and exam announcements. */
export function estimatePartSeconds(part: HasScript): number {
  const words = scriptWordCount(part.script);
  const pauses = part.script.reduce((s, l) => s + (l.pauseAfter ?? 0), 0);
  return Math.round((words / 150) * 60 + pauses + 45);
}

export function estimateListeningMinutes(test: { parts: HasScript[] }, partIndex?: number): number {
  const parts = partIndex == null ? test.parts : test.parts.slice(partIndex, partIndex + 1);
  const secs = parts.reduce((s, p) => s + estimatePartSeconds(p), 0);
  const review = partIndex == null ? LISTENING_FULL.reviewMinutes * 60 : 60;
  return Math.max(1, Math.round((secs + review) / 60));
}

function kindsOf(parts: { groups: ExamGroup[] }[]): GroupKind[] {
  return Array.from(new Set(parts.flatMap((p) => p.groups.map((g) => g.kind))));
}

export function summarizeReading(test: ExamReadingTest): ExamTestSummary {
  const partInfo = test.parts.map((p) => ({ title: p.title, ...(partRange(p) ?? { from: 0, to: 0 }) }));
  const questions = questionCount(test);
  return {
    id: test.id,
    skill: "READING",
    title: test.title,
    description: test.description,
    difficulty: test.difficulty,
    questions,
    parts: test.parts.length,
    partInfo,
    timeLimit: test.timeLimit,
    kinds: kindsOf(test.parts),
    full: test.parts.length === READING_FULL.parts && questions === READING_FULL.questions,
    source: test.source,
    topics: test.topics,
  };
}

export function summarizeListening(test: ExamListeningTest): ExamTestSummary {
  const partInfo = test.parts.map((p) => ({ title: p.title, ...(partRange(p) ?? { from: 0, to: 0 }) }));
  const questions = questionCount(test);
  return {
    id: test.id,
    skill: "LISTENING",
    title: test.title,
    description: test.description,
    difficulty: test.difficulty,
    questions,
    parts: test.parts.length,
    partInfo,
    timeLimit: estimateListeningMinutes(test),
    kinds: kindsOf(test.parts),
    full: test.parts.length === LISTENING_FULL.parts && questions === LISTENING_FULL.questions,
    source: test.source,
    topics: test.topics,
  };
}

export const KIND_LABEL: Record<GroupKind, string> = {
  tfng: "True / False / Not Given",
  ynng: "Yes / No / Not Given",
  mcq: "Multiple choice",
  "mcq-multi": "Choose two/three",
  matching: "Matching",
  gap: "Completion",
  "gap-box": "Summary (word box)",
};
