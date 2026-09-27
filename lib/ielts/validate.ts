/**
 * Structural + content validation for exam-v2 material. Pure (no zod) so the
 * same checks run on AI output at generation time, on hand-written seed files
 * in offline scripts, and before an admin publishes a test.
 *
 * Errors make a test unusable; warnings are shown to the reviewer.
 */

import type {
  ExamGroup,
  ExamListeningTest,
  ExamReadingTest,
  ExamSkill,
  GroupKind,
  ListeningPart,
  ReadingPart,
  SpeakingExamSet,
} from "./types";
import { LETTERS, ROMAN, parseTemplate, placeholders, wordCount } from "./format";
import { countLimitedWords, expandOptional, normalizeAnswer, canonicalBinary } from "./grading";

export interface ValidationReport {
  errors: string[];
  warnings: string[];
}

const KINDS: GroupKind[] = ["tfng", "ynng", "mcq", "mcq-multi", "matching", "gap", "gap-box"];

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function sequentialKeys(keys: string[]): boolean {
  const roman = keys.every((k) => ROMAN.includes(k));
  const ref = roman ? ROMAN : LETTERS;
  return keys.every((k, i) => k === ref[i]);
}

/** Does the source text contain the answer (any accepted variant), ignoring case/punctuation? */
function inSource(answer: string[], source: string): boolean {
  const hay = ` ${normalizeAnswer(source.replace(/[^\p{L}\p{N}%£$€\s'-]/gu, " "))} `.replace(/\s+/g, " ");
  const plain = ` ${source.toLowerCase().replace(/\s+/g, " ")} `;
  return answer
    .flatMap(expandOptional)
    .some((a) => {
      const n = normalizeAnswer(a);
      if (!n) return false;
      return hay.includes(` ${n} `) || plain.includes(a.toLowerCase().trim());
    });
}

export interface GroupContext {
  where: string;
  skill: ExamSkill;
  /** Passage / script text the answers must come from (gap kinds). */
  source: string;
  /** Paragraph labels present in the passage (Reading). */
  paragraphLabels?: string[];
}

export function validateGroup(raw: unknown, ctx: GroupContext, report: ValidationReport): number[] {
  const { errors, warnings } = report;
  const at = ctx.where;
  if (!isObj(raw)) {
    errors.push(`${at}: group is not an object`);
    return [];
  }
  const g = raw as unknown as ExamGroup;
  if (!KINDS.includes(g.kind)) errors.push(`${at}: unknown kind "${String(g.kind)}"`);
  if (!isStr(g.instructions)) errors.push(`${at}: missing instructions`);
  if (!Array.isArray(g.questions) || g.questions.length === 0) {
    errors.push(`${at}: no questions`);
    return [];
  }
  const numbers: number[] = [];
  for (const q of g.questions) {
    if (!isObj(q) || typeof q.n !== "number" || !Number.isInteger(q.n)) {
      errors.push(`${at}: question without a numeric "n"`);
      continue;
    }
    numbers.push(q.n);
    if (!Array.isArray(q.answer) || q.answer.length === 0 || !q.answer.every(isStr)) {
      errors.push(`${at} Q${q.n}: missing answer`);
    }
    if (!isStr(q.explanation)) warnings.push(`${at} Q${q.n}: no explanation`);
  }

  const options = Array.isArray(g.options) ? g.options : [];
  const optionKeys = options.map((o) => (isObj(o) ? String(o.key) : ""));
  const optionOk = () => {
    if (options.length === 0) {
      errors.push(`${at}: "${g.kind}" needs a shared options list`);
      return false;
    }
    if (!options.every((o) => isObj(o) && isStr(o.key) && isStr(o.text))) {
      errors.push(`${at}: every option needs a key and text`);
      return false;
    }
    if (new Set(optionKeys).size !== optionKeys.length) errors.push(`${at}: duplicate option keys`);
    if (!sequentialKeys(optionKeys)) warnings.push(`${at}: option keys are not sequential (A, B, C… or i, ii, iii…)`);
    return true;
  };

  switch (g.kind) {
    case "tfng":
    case "ynng": {
      const allowed = g.kind === "tfng" ? ["TRUE", "FALSE", "NOT GIVEN"] : ["YES", "NO", "NOT GIVEN"];
      for (const q of g.questions) {
        if (!isStr(q.text)) errors.push(`${at} Q${q.n}: missing statement`);
        const a = canonicalBinary(q.answer?.[0]);
        if (!allowed.includes(a) || q.answer.length !== 1) errors.push(`${at} Q${q.n}: answer must be one of ${allowed.join(" / ")}`);
      }
      const answers = g.questions.map((q) => canonicalBinary(q.answer?.[0]));
      if (g.questions.length >= 4 && new Set(answers).size < 3) {
        warnings.push(`${at}: use all three answers (${allowed.join(", ")}) across the group`);
      }
      break;
    }
    case "mcq": {
      for (const q of g.questions) {
        if (!isStr(q.text)) errors.push(`${at} Q${q.n}: missing question stem`);
        const opts = Array.isArray(q.options) ? q.options : [];
        if (opts.length < 3 || opts.length > 5) errors.push(`${at} Q${q.n}: needs 3–5 options`);
        const keys = opts.map((o) => String(o?.key ?? ""));
        if (!opts.every((o) => isObj(o) && isStr(o.key) && isStr(o.text))) errors.push(`${at} Q${q.n}: every option needs a key and text`);
        if (!sequentialKeys(keys)) errors.push(`${at} Q${q.n}: option keys must be A, B, C, D`);
        if (q.answer?.length !== 1 || !keys.includes(String(q.answer[0]).toUpperCase())) errors.push(`${at} Q${q.n}: answer must be one existing option key`);
      }
      break;
    }
    case "mcq-multi": {
      if (!isStr(g.title)) errors.push(`${at}: "mcq-multi" needs the question stem in "title"`);
      if (optionOk()) {
        if (options.length < g.questions.length + 2) warnings.push(`${at}: offer at least ${g.questions.length + 2} options`);
        const first = (g.questions[0]?.answer ?? []).map((a) => String(a).toUpperCase()).sort().join(",");
        for (const q of g.questions) {
          const set = (q.answer ?? []).map((a) => String(a).toUpperCase()).sort();
          if (set.join(",") !== first) errors.push(`${at} Q${q.n}: every question in a "choose N" group must carry the same full answer set`);
          if (set.length !== g.questions.length) errors.push(`${at} Q${q.n}: answer set must have exactly ${g.questions.length} letters`);
          if (!set.every((k) => optionKeys.includes(k))) errors.push(`${at} Q${q.n}: answer letters must exist in the options`);
        }
      }
      break;
    }
    case "matching": {
      if (optionOk()) {
        const roman = optionKeys.every((k) => ROMAN.includes(k));
        for (const q of g.questions) {
          if (!isStr(q.text)) errors.push(`${at} Q${q.n}: missing item text`);
          if (q.answer?.length !== 1 || !optionKeys.includes(String(q.answer[0]))) {
            errors.push(`${at} Q${q.n}: answer must be one key from the options list`);
          }
          const para = /paragraph\s+([A-Z])\b/i.exec(q.text ?? "")?.[1]?.toUpperCase();
          if (para && ctx.paragraphLabels && !ctx.paragraphLabels.includes(para)) {
            errors.push(`${at} Q${q.n}: refers to paragraph ${para}, which the passage doesn't label`);
          }
        }
        if (!g.allowReuse) {
          const used = g.questions.map((q) => String(q.answer?.[0]));
          if (new Set(used).size !== used.length) errors.push(`${at}: answers repeat but allowReuse is not set`);
        }
        if (roman && options.length <= g.questions.length) warnings.push(`${at}: give more headings than paragraphs`);
        if (!roman && optionKeys.every((k) => LETTERS.includes(k)) && ctx.paragraphLabels?.length) {
          const looksLikeParagraphs = options.every((o) => /^paragraph\s+[A-Z]$/i.test(String(o.text)));
          if (looksLikeParagraphs && !optionKeys.every((k) => ctx.paragraphLabels!.includes(k))) {
            errors.push(`${at}: paragraph options don't match the passage labels`);
          }
        }
      }
      break;
    }
    case "gap":
    case "gap-box": {
      const inTemplate = placeholders(g.template);
      const perQuestion = g.questions.flatMap((q) => placeholders(q.text));
      const used = g.template ? inTemplate : perQuestion;
      for (const q of g.questions) {
        const count = used.filter((x) => x === q.n).length;
        if (count !== 1) errors.push(`${at} Q${q.n}: placeholder [[${q.n}]] must appear exactly once in ${g.template ? "the template" : "the question text"}`);
      }
      const stray = used.filter((x) => !numbers.includes(x));
      if (stray.length) errors.push(`${at}: placeholders without a question: ${stray.join(", ")}`);
      if (g.template) {
        const rows = parseTemplate(g.template).filter((l) => l.type === "row");
        const widths = new Set(rows.map((r) => (r.type === "row" ? r.cells.length : 0)));
        if (widths.size > 1) warnings.push(`${at}: table rows have different numbers of cells`);
      }
      if (g.kind === "gap") {
        if (g.wordLimit == null) warnings.push(`${at}: no wordLimit (IELTS always states one)`);
        for (const q of g.questions) {
          for (const a of q.answer ?? []) {
            for (const v of expandOptional(a)) {
              if (g.wordLimit != null && countLimitedWords(v, g.allowNumber) > g.wordLimit) {
                errors.push(`${at} Q${q.n}: answer "${v}" exceeds the ${g.wordLimit}-word limit`);
              }
            }
          }
          if (ctx.source && q.answer?.length && !inSource(q.answer, ctx.source)) {
            errors.push(`${at} Q${q.n}: answer "${q.answer[0]}" does not appear in the ${ctx.skill === "READING" ? "passage" : "script"}`);
          }
        }
      } else if (optionOk()) {
        if (options.length < g.questions.length + 2) warnings.push(`${at}: the word box should have extra distractors`);
        for (const q of g.questions) {
          if (q.answer?.length !== 1 || !optionKeys.includes(String(q.answer[0]))) {
            errors.push(`${at} Q${q.n}: answer must be one key from the word box`);
          }
        }
      }
      break;
    }
  }
  return numbers;
}

function checkNumbering(all: number[], startAt: number, where: string, errors: string[]) {
  all.forEach((n, i) => {
    if (n !== startAt + i) {
      errors.push(`${where}: question numbers must run ${startAt}, ${startAt + 1}, … without gaps (found ${n} at position ${i + 1})`);
    }
  });
}

export interface ValidateOptions {
  /** Require the full exam shape (Reading 3×40, Listening 4×10). */
  requireFull?: boolean;
  /** First question number (when validating a single generated part). */
  startAt?: number;
}

export function validateReadingPart(raw: unknown, where: string, report: ValidationReport): number[] {
  if (!isObj(raw)) {
    report.errors.push(`${where}: part is not an object`);
    return [];
  }
  const p = raw as unknown as ReadingPart;
  if (!isStr(p.id)) report.errors.push(`${where}: missing id`);
  if (!isStr(p.title)) report.errors.push(`${where}: missing title`);
  if (!Array.isArray(p.paragraphs) || !p.paragraphs.length || !p.paragraphs.every((x) => isObj(x) && isStr(x.text))) {
    report.errors.push(`${where}: paragraphs must be a non-empty list of { text }`);
    return [];
  }
  const labels = p.paragraphs.map((x) => x.label).filter((l): l is string => isStr(l));
  if (labels.length && labels.length !== p.paragraphs.length) report.warnings.push(`${where}: label every paragraph or none`);
  if (new Set(labels).size !== labels.length) report.errors.push(`${where}: duplicate paragraph labels`);
  const words = p.paragraphs.reduce((n, x) => n + wordCount(x.text), 0);
  if (words < 650) report.warnings.push(`${where}: passage is short (${words} words; IELTS passages are ~750–950)`);
  if (words > 1150) report.warnings.push(`${where}: passage is long (${words} words)`);
  if (!Array.isArray(p.groups) || !p.groups.length) {
    report.errors.push(`${where}: no question groups`);
    return [];
  }
  const source = p.paragraphs.map((x) => x.text).join("\n");
  return p.groups.flatMap((g, i) =>
    validateGroup(g, { where: `${where} group ${i + 1}`, skill: "READING", source, paragraphLabels: labels }, report)
  );
}

export function validateReadingTest(raw: unknown, opts: ValidateOptions = {}): ValidationReport {
  const report: ValidationReport = { errors: [], warnings: [] };
  if (!isObj(raw)) return { errors: ["test is not an object"], warnings: [] };
  const t = raw as unknown as ExamReadingTest;
  if (t.format !== "exam-v2") report.errors.push('format must be "exam-v2"');
  if (t.skill !== "READING") report.errors.push('skill must be "READING"');
  for (const k of ["id", "title", "description"] as const) if (!isStr(t[k])) report.errors.push(`missing ${k}`);
  if (!["Easy", "Medium", "Hard"].includes(t.difficulty)) report.errors.push("difficulty must be Easy, Medium or Hard");
  if (typeof t.timeLimit !== "number" || t.timeLimit <= 0) report.errors.push("timeLimit must be a positive number of minutes");
  if (!Array.isArray(t.parts) || !t.parts.length) {
    report.errors.push("no parts");
    return report;
  }
  const all = t.parts.flatMap((p, i) => validateReadingPart(p, `Passage ${i + 1}`, report));
  checkNumbering(all, opts.startAt ?? 1, "Reading", report.errors);
  if (opts.requireFull) {
    if (t.parts.length !== 3) report.errors.push(`a full Reading test has 3 passages (found ${t.parts.length})`);
    if (all.length !== 40) report.errors.push(`a full Reading test has 40 questions (found ${all.length})`);
  }
  const kinds = new Set(t.parts.flatMap((p) => (Array.isArray(p.groups) ? p.groups.map((g) => g.kind) : [])));
  if (opts.requireFull && kinds.size < 4) report.warnings.push(`only ${kinds.size} question types — real tests mix at least 4`);
  return report;
}

export function validateListeningPart(raw: unknown, where: string, report: ValidationReport): number[] {
  if (!isObj(raw)) {
    report.errors.push(`${where}: part is not an object`);
    return [];
  }
  const p = raw as unknown as ListeningPart;
  if (!isStr(p.id)) report.errors.push(`${where}: missing id`);
  if (!isStr(p.title)) report.errors.push(`${where}: missing title`);
  if (!isStr(p.context)) report.errors.push(`${where}: missing context sentence`);
  const speakers = Array.isArray(p.speakers) ? p.speakers : [];
  if (!speakers.length || !speakers.every((s) => isObj(s) && isStr(s.name) && (s.gender === "female" || s.gender === "male"))) {
    report.errors.push(`${where}: speakers must be a non-empty list of { name, gender }`);
  }
  const names = new Set(speakers.map((s) => s.name));
  if (!Array.isArray(p.script) || p.script.length < 4) {
    report.errors.push(`${where}: script is missing or too short`);
    return [];
  }
  for (const [i, l] of p.script.entries()) {
    if (!isObj(l) || !isStr(l.text) || !isStr(l.speaker)) {
      report.errors.push(`${where} line ${i + 1}: needs speaker and text`);
      continue;
    }
    if (l.speaker !== "Narrator" && !names.has(l.speaker)) report.errors.push(`${where} line ${i + 1}: unknown speaker "${l.speaker}"`);
  }
  const words = p.script.reduce((n, l) => n + wordCount(String(l?.text ?? "")), 0);
  if (words < 350) report.warnings.push(`${where}: script is short (${words} words; parts run ~500–900)`);
  if (!Array.isArray(p.groups) || !p.groups.length) {
    report.errors.push(`${where}: no question groups`);
    return [];
  }
  const source = p.script.map((l) => String(l?.text ?? "")).join("\n");
  return p.groups.flatMap((g, i) => validateGroup(g, { where: `${where} group ${i + 1}`, skill: "LISTENING", source }, report));
}

export function validateListeningTest(raw: unknown, opts: ValidateOptions = {}): ValidationReport {
  const report: ValidationReport = { errors: [], warnings: [] };
  if (!isObj(raw)) return { errors: ["test is not an object"], warnings: [] };
  const t = raw as unknown as ExamListeningTest;
  if (t.format !== "exam-v2") report.errors.push('format must be "exam-v2"');
  if (t.skill !== "LISTENING") report.errors.push('skill must be "LISTENING"');
  for (const k of ["id", "title", "description"] as const) if (!isStr(t[k])) report.errors.push(`missing ${k}`);
  if (!["Easy", "Medium", "Hard"].includes(t.difficulty)) report.errors.push("difficulty must be Easy, Medium or Hard");
  if (!Array.isArray(t.parts) || !t.parts.length) {
    report.errors.push("no parts");
    return report;
  }
  const perPart: number[] = [];
  const all = t.parts.flatMap((p, i) => {
    const ns = validateListeningPart(p, `Part ${i + 1}`, report);
    perPart.push(ns.length);
    return ns;
  });
  checkNumbering(all, opts.startAt ?? 1, "Listening", report.errors);
  if (opts.requireFull) {
    if (t.parts.length !== 4) report.errors.push(`a full Listening test has 4 parts (found ${t.parts.length})`);
    perPart.forEach((n, i) => {
      if (n !== 10) report.errors.push(`Part ${i + 1} must have 10 questions (found ${n})`);
    });
  }
  return report;
}

export function validateSpeakingSet(raw: unknown): ValidationReport {
  const report: ValidationReport = { errors: [], warnings: [] };
  if (!isObj(raw)) return { errors: ["set is not an object"], warnings: [] };
  const s = raw as unknown as SpeakingExamSet;
  if (s.format !== "exam-v2" || s.skill !== "SPEAKING") report.errors.push('format/skill must be "exam-v2" / "SPEAKING"');
  if (!isStr(s.id) || !isStr(s.title)) report.errors.push("missing id or title");
  if (!Array.isArray(s.part1) || s.part1.length < 1 || s.part1.length > 3) report.errors.push("part1 needs 1–3 topics");
  else {
    if (s.part1.length < 2) report.warnings.push("real Part 1 covers 2–3 topics");
    s.part1.forEach((t, i) => {
      if (!isStr(t?.topic)) report.errors.push(`part1 topic ${i + 1}: missing topic`);
      if (!Array.isArray(t?.questions) || t.questions.length < 3 || t.questions.length > 6 || !t.questions.every(isStr)) {
        report.errors.push(`part1 topic ${i + 1}: needs 3–6 questions`);
      }
    });
  }
  const p2 = s.part2;
  if (!isObj(p2) || !isStr(p2.cue) || !Array.isArray(p2.points) || p2.points.length < 3 || p2.points.length > 4 || !isStr(p2.closing)) {
    report.errors.push("part2 needs a cue, 3–4 points and a closing line");
  } else {
    if (!/^describe\b/i.test(p2.cue.trim())) report.warnings.push('part2 cue usually starts with "Describe"');
    if (!/^and\b/i.test(p2.closing.trim())) report.warnings.push('part2 closing usually starts with "and explain…"');
  }
  if (!isObj(s.part3) || !isStr(s.part3.theme) || !Array.isArray(s.part3.questions) || s.part3.questions.length < 4 || s.part3.questions.length > 7 || !s.part3.questions.every(isStr)) {
    report.errors.push("part3 needs a theme and 4–7 questions");
  }
  return report;
}
