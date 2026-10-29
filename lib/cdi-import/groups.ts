/**
 * One "Questions N–M" block of a source paper → one ExamGroup. The block's
 * markup and the script literals decide the kind (see the table in the
 * design, section 1.4); every key alternative is kept in source order and
 * nothing is invented: questions keep the source wording, options keep the
 * source keys (letters, roman numerals), explanations stay empty.
 */

import { countLimitedWords, expandOptional } from "../ielts/grading";
import type { ExamGroup, ExamOption, ExamQuestion, GroupKind } from "../ielts/types";
import {
  attr,
  children,
  classes,
  cleanText,
  elementChildren,
  findAll,
  hasClass,
  isElement,
  textContent,
  type HtmlElement,
  type HtmlNode,
} from "./dom";
import type { Literal } from "./literals";
import { collapse, parseWordLimit, questionRange, rangeText } from "./text";

export interface ConvertIssue {
  file: string;
  questions?: number[];
  part?: number;
  message: string;
}

export interface GroupImage {
  /** Payload index of the data URI. */
  payload: number;
  alt: string;
  from: number;
  to: number;
}

export interface MultiPick {
  questionIds: number[];
  correctAnswers: string[];
}

export interface GroupContext {
  file: string;
  skill: "READING" | "LISTENING";
  key: Record<string, Literal>;
  /** Every object/array literal of the scripts (by variable name). */
  literals: Map<string, Literal>;
  textRules?: Record<string, { maxWords?: number; maxNumbers?: number }> | null;
  multiPicks: MultiPick[];
  warnings: ConvertIssue[];
  errors: ConvertIssue[];
}

export interface GroupBlock {
  from: number;
  to: number;
  /** The block's nodes, in document order (the anchor first). */
  nodes: HtmlNode[];
}

export interface GroupResult {
  group: ExamGroup;
  images: GroupImage[];
}

const NUMBER_BADGE = (e: HtmlElement) =>
  hasClass(e, "q-number") || hasClass(e, "q-badge") || hasClass(e, "qbadge") || hasClass(e, "dd-q-badge") || hasClass(e, "diagram-q-number");
const NOISE = (e: HtmlElement) =>
  e.tagName === "button" ||
  hasClass(e, "flag-btn") ||
  hasClass(e, "answer-feedback") ||
  hasClass(e, "correct-answer-display") ||
  hasClass(e, "word-warning") ||
  hasClass(e, "selection-note") ||
  hasClass(e, "selection-count") ||
  hasClass(e, "bank-help") ||
  hasClass(e, "map-scroll-help") ||
  hasClass(e, "ldm-slot") ||
  hasClass(e, "mh-drop-slot") ||
  hasClass(e, "two-review") ||
  hasClass(e, "multi-review") ||
  hasClass(e, "review-note") ||
  hasClass(e, "diagram-selection");

function within(nodes: HtmlNode[], pred: (e: HtmlElement) => boolean): HtmlElement[] {
  const out: HtmlElement[] = [];
  for (const n of nodes) {
    if (!isElement(n)) continue;
    if (pred(n)) out.push(n);
    out.push(...findAll(n, pred));
  }
  return out;
}

function qOf(e: HtmlElement): number | null {
  for (const a of ["data-q", "data-question", "data-qnum"]) {
    const v = attr(e, a);
    if (v != null && /^\d{1,2}$/.test(v.trim())) return Number(v);
  }
  const id = attr(e, "id") ?? "";
  const m = /^(?:q|question-)(\d{1,2})$/.exec(id);
  return m ? Number(m[1]) : null;
}

/** A strong / b / span that only shows the question number ("9", "11.", "(12)"). */
function isNumberMark(e: HtmlElement, n?: number): boolean {
  if (NUMBER_BADGE(e)) return true;
  if (!["strong", "b", "span", "sup"].includes(e.tagName)) return false;
  const t = cleanText(e).replace(/[.)(:]/g, "").trim();
  return /^\d{1,2}$/.test(t) && (n == null || Number(t) === n);
}

/** Visible text of a question element without its number badge, buttons and feedback. */
export function questionText(e: HtmlNode, n?: number): string {
  return cleanText(e, { skip: (x) => NOISE(x) || isNumberMark(x, n) || hasClass(x, "options") || hasClass(x, "multi-choice-option") });
}

function keyValues(ctx: GroupContext, n: number): string[] {
  const v = ctx.key[String(n)];
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).map((x) => (typeof x === "string" ? x : String(x)));
}

const TF = new Set(["TRUE", "FALSE", "NOT GIVEN"]);
const YN = new Set(["YES", "NO", "NOT GIVEN"]);

function canonical(v: string): string {
  return collapse(v).toUpperCase();
}

/** Instruction lines: `.instruction` and the plain paragraphs right after it, or an instructions block. */
function instructionNodes(block: GroupBlock): HtmlElement[] {
  const out: HtmlElement[] = [];
  const instr = within(block.nodes, (e) => hasClass(e, "instruction") || hasClass(e, "instructions-block") || hasClass(e, "question-prompt"));
  const seen = new Set<HtmlElement>();
  for (const el of instr) {
    if (hasClass(el, "instructions-block") || hasClass(el, "question-prompt")) {
      for (const p of elementChildren(el)) {
        if (questionRange(cleanText(p))) continue;
        if (!seen.has(p)) out.push(p), seen.add(p);
      }
      continue;
    }
    if (seen.has(el)) continue;
    out.push(el);
    seen.add(el);
    // Plain <p> siblings that follow (e.g. "Choose the correct letter, A–I, for questions 6–8.").
    const parent = (el as unknown as { parentNode?: HtmlNode }).parentNode;
    if (!parent) continue;
    const sibs = elementChildren(parent);
    for (let i = sibs.indexOf(el) + 1; i < sibs.length; i++) {
      const s = sibs[i];
      if (s.tagName !== "p" || classes(s).length || findAll(s, (x) => x.tagName === "input").length || qOf(s) != null) break;
      if (!seen.has(s)) out.push(s), seen.add(s);
    }
  }
  return out;
}

function instructionText(block: GroupBlock): string {
  return instructionNodes(block)
    .map((p) => cleanText(p, { skip: NOISE }))
    .filter(Boolean)
    .join("\n");
}

/** The bold limit phrase of the instruction ("NO MORE THAN TWO WORDS AND/OR A NUMBER"). */
function limitPhrase(block: GroupBlock): string | null {
  for (const p of instructionNodes(block)) {
    for (const s of findAll(p, (e) => e.tagName === "strong" || e.tagName === "b" || e.tagName === "em")) {
      const t = cleanText(s);
      if (parseWordLimit(t)) return t;
    }
    const t = cleanText(p);
    const m = /((?:NO MORE THAN\s+)?(?:ONE|TWO|THREE|FOUR|FIVE)\s+WORDS?(?:\s+(?:AND\/OR|AND|OR)\s+A\s+NUMBER)?(?:\s+ONLY)?|A NUMBER)/.exec(t);
    if (m) return m[1];
  }
  return null;
}

function optionText(label: HtmlElement, key: string): string {
  const t = cleanText(label, {
    skip: (x) => NOISE(x) || hasClass(x, "option-code") || hasClass(x, "ldm-code") || hasClass(x, "dd-option-code") || hasClass(x, "mh-heading-code") || (["strong", "b"].includes(x.tagName) && /^[A-Za-z]{1,4}[.)]?$/.test(cleanText(x)) && cleanText(x).replace(/[.)]/g, "").toUpperCase() === key.toUpperCase()),
  });
  return t.replace(new RegExp(`^${key}[.)]\\s+`), "").trim();
}

function labelOf(input: HtmlElement): HtmlElement {
  let p: HtmlNode | undefined = input;
  while (p && isElement(p)) {
    if (p.tagName === "label" || hasClass(p as HtmlElement, "multi-choice-option") || hasClass(p as HtmlElement, "option")) return p as HtmlElement;
    p = (p as unknown as { parentNode?: HtmlNode }).parentNode;
  }
  return input;
}

function inputsOf(block: GroupBlock, type: string): HtmlElement[] {
  return within(block.nodes, (e) => e.tagName === "input" && (attr(e, "type") ?? "text").toLowerCase() === type);
}

function numbers(block: GroupBlock): number[] {
  const out: number[] = [];
  for (let n = block.from; n <= block.to; n++) out.push(n);
  return out;
}

/** The element of question n inside the block (data-q / data-question / id), outermost first. */
function questionElement(block: GroupBlock, n: number): HtmlElement | null {
  const all = within(block.nodes, (e) => qOf(e) === n && e.tagName !== "input" && !NOISE(e) && !hasClass(e, "lmap-cell"));
  return all[0] ?? null;
}

// ---------------------------------------------------------------------------
// Templates (gap / gap-box): placeholders [[n]] where the inputs are.
// ---------------------------------------------------------------------------

const BLOCK_TAGS = new Set(["p", "div", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "table", "tr", "tbody", "thead", "section", "article", "figure", "header"]);

function placeholderOf(e: HtmlElement, nums: Set<number>): number | null {
  if (e.tagName === "input" || hasClass(e, "inline-answer") || hasClass(e, "q-input-wrap") || hasClass(e, "dd-inline-slot") || hasClass(e, "slot-wrap") || hasClass(e, "ldm-slot")) {
    const n = qOf(e);
    if (n != null && nums.has(n)) return n;
  }
  return null;
}

/** No space between a gap and the punctuation that follows it ("[[24]] ," → "[[24]],"). */
function tidy(t: string): string {
  return t.replace(/\]\]\s+([,.;:!?)’”])/g, "]]$1").replace(/([(‘“])\s+\[\[/g, "$1[[");
}

export function renderTemplate(nodes: HtmlNode[], nums: Set<number>, skip: (e: HtmlElement) => boolean): string {
  const lines: string[] = [];
  let line = "";
  const used = new Set<number>();
  /** A table cell on one line: its text and gaps, block boundaries become spaces. */
  const cellText = (n: HtmlNode): string => {
    if ((n as { nodeName: string }).nodeName === "#text") return (n as unknown as { value: string }).value;
    if (!isElement(n) || skip(n) || NOISE(n)) return "";
    const ph = placeholderOf(n, nums);
    if (ph != null) {
      if (used.has(ph)) return "";
      used.add(ph);
      return ` [[${ph}]] `;
    }
    if (isNumberMark(n) && nums.has(Number(cleanText(n).replace(/[^\d]/g, "")))) return "";
    if (["script", "style", "button", "img", "svg", "select", "textarea", "input"].includes(n.tagName)) return "";
    const inner = children(n).map(cellText).join("");
    return BLOCK_TAGS.has(n.tagName) || n.tagName === "br" ? ` ${inner} ` : inner;
  };
  const flush = (prefix = "") => {
    const t = tidy(collapse(line));
    if (t) lines.push(prefix + t);
    line = "";
  };
  const walk = (n: HtmlNode, prefix: string) => {
    if ((n as { nodeName: string }).nodeName === "#text") {
      line += (n as unknown as { value: string }).value;
      return;
    }
    if (!isElement(n)) return;
    if (skip(n) || NOISE(n)) return;
    const ph = placeholderOf(n, nums);
    if (ph != null) {
      if (!used.has(ph)) line += ` [[${ph}]] `;
      used.add(ph);
      return;
    }
    if (isNumberMark(n)) {
      const t = Number(cleanText(n).replace(/[^\d]/g, ""));
      if (nums.has(t)) return;
    }
    if (["script", "style", "button", "img", "svg", "select", "textarea"].includes(n.tagName) || n.tagName === "input") return;
    if (n.tagName === "br") {
      flush(prefix);
      return;
    }
    if (n.tagName === "tr") {
      flush(prefix);
      const cells = elementChildren(n).filter((c) => c.tagName === "td" || c.tagName === "th");
      const texts = cells.map((c) => tidy(collapse(cellText(c))).replace(/\|/g, "/"));
      lines.push(`| ${texts.join(" | ")} |`);
      return;
    }
    const block = BLOCK_TAGS.has(n.tagName);
    if (block) flush(prefix);
    const isHeading = /^h[1-6]$/.test(n.tagName) || hasClass(n, "group-head") || hasClass(n, "centered-title") || hasClass(n, "dd-summary-title");
    const childPrefix = isHeading ? "# " : n.tagName === "li" ? "- " : prefix;
    for (const c of children(n)) walk(c, childPrefix);
    if (block) flush(childPrefix);
  };
  for (const n of nodes) walk(n, "");
  flush();
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Kinds
// ---------------------------------------------------------------------------

function nounFor(instructions: string): string | null {
  if (/\bparagraph/i.test(instructions)) return "Paragraph";
  if (/\bsection/i.test(instructions)) return "Section";
  return null;
}

function legendOptions(block: GroupBlock): ExamOption[] | null {
  const legend = within(block.nodes, (e) => hasClass(e, "people-legend") || hasClass(e, "opinion-legend") || hasClass(e, "date-legend"))[0];
  if (!legend) return null;
  const out: ExamOption[] = [];
  for (const s of findAll(legend, (e) => e.tagName === "span" && findAll(e, (b) => b.tagName === "b" || b.tagName === "strong").length > 0)) {
    const b = findAll(s, (x) => x.tagName === "b" || x.tagName === "strong")[0];
    const key = cleanText(b).replace(/[.)]/g, "");
    const text = cleanText(s, { skip: (x) => x === b });
    if (key) out.push({ key, text });
  }
  return out.length ? out : null;
}

function gridHeaderKeys(block: GroupBlock): string[] {
  const grid = within(block.nodes, (e) => e.tagName === "table" && (hasClass(e, "matching-grid") || hasClass(e, "lmap-matrix")))[0];
  if (!grid) return [];
  const ths = findAll(grid, (e) => e.tagName === "th" && !!findAll(grid, (h) => h.tagName === "thead").length && findAll(findAll(grid, (h) => h.tagName === "thead")[0], (x) => x === e).length > 0);
  return ths.slice(1).map((t) => cleanText(t)).filter((k) => /^[A-Za-z]{1,4}$|^\d{1,2}$/.test(k));
}

/** A literal object whose keys include every number of the block, with string values (matching statements). */
function statementsLiteral(ctx: GroupContext, nums: number[], exclude: Set<string>): Record<string, string> | null {
  for (const [name, v] of Array.from(ctx.literals.entries())) {
    if (exclude.has(name) || !v || typeof v !== "object" || Array.isArray(v)) continue;
    const obj = v as Record<string, Literal>;
    if (nums.every((n) => typeof obj[String(n)] === "string")) return Object.fromEntries(nums.map((n) => [String(n), String(obj[String(n)])]));
  }
  return null;
}

function literalOptions(ctx: GroupContext, name: string): ExamOption[] | null {
  const v = ctx.literals.get(name);
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return Object.entries(v as Record<string, Literal>).map(([key, text]) => ({ key, text: collapse(String(text)) }));
}

function issue(ctx: GroupContext, block: GroupBlock, message: string, error = true) {
  (error ? ctx.errors : ctx.warnings).push({ file: ctx.file, questions: numbers(block), message });
}

/** Declared letter range in the instruction ("A–J") vs the actual option keys. */
function checkDeclaredRange(ctx: GroupContext, block: GroupBlock, instructions: string, options: ExamOption[]) {
  const m = /\b([A-Z])\s*[–-]\s*([A-Z])\b/.exec(instructions);
  if (!m || !options.length || !options.every((o) => /^[A-Z]$/.test(o.key))) return;
  const declared: string[] = [];
  for (let c = m[1].charCodeAt(0); c <= m[2].charCodeAt(0); c++) declared.push(String.fromCharCode(c));
  const keys = options.map((o) => o.key);
  if (declared.join("") !== keys.join("")) {
    issue(ctx, block, `The instruction declares letters ${m[1]}–${m[2]}, but the options are ${keys.join(", ")} (kept as in the source).`, false);
  }
}

function matchingQuestions(block: GroupBlock, ctx: GroupContext, texts: Record<string, string>): ExamQuestion[] {
  return numbers(block).map((n) => ({ n, text: texts[String(n)] ?? "", answer: keyValues(ctx, n) }));
}

function allowsReuse(instructions: string, block?: GroupBlock): boolean {
  if (/more than once/i.test(instructions)) return true;
  if (!block) return false;
  // The source's own reuse flag, or its help line ("Letters may be used more than once").
  return within(block.nodes, (e) => attr(e, "data-reuse") === "true" || (hasClass(e, "bank-help") && /more than once/i.test(cleanText(e)))).length > 0;
}

export function convertGroup(block: GroupBlock, ctx: GroupContext): GroupResult | null {
  const nums = numbers(block);
  const numSet = new Set(nums);
  const instructions = instructionText(block) || rangeText(block.from, block.to);
  const instructionSet = new Set(instructionNodes(block));
  const notInstruction = (e: HtmlElement) => instructionSet.has(e) || questionRange(cleanText(e)) != null;
  const images: GroupImage[] = within(block.nodes, (e) => e.tagName === "img").flatMap((img) => {
    const src = attr(img, "src") ?? "";
    const m = /^cdi-payload:\/\/(\d+)$/.exec(src);
    return m ? [{ payload: Number(m[1]), alt: attr(img, "alt") ?? "", from: block.from, to: block.to }] : [];
  });
  const missing = nums.filter((n) => !keyValues(ctx, n).length);
  if (missing.length) {
    ctx.errors.push({ file: ctx.file, questions: missing, message: "No answer key for these questions." });
    return null;
  }
  const keys = nums.map((n) => keyValues(ctx, n));
  const firsts = keys.map((k) => canonical(k[0]));
  const base = { instructions } as Pick<ExamGroup, "instructions">;

  // 1. TRUE / FALSE / NOT GIVEN and YES / NO / NOT GIVEN.
  const tf = firsts.every((k) => TF.has(k)) && (firsts.some((k) => k !== "NOT GIVEN") || /TRUE/.test(instructions));
  const yn = firsts.every((k) => YN.has(k)) && (firsts.some((k) => k !== "NOT GIVEN") || /\bYES\b/.test(instructions));
  if ((tf || yn) && keys.every((k) => k.length === 1)) {
    const kind: GroupKind = tf && !(/\bYES\b/.test(instructions) && yn) ? "tfng" : "ynng";
    const questions = nums.map((n, i) => {
      const el = questionElement(block, n);
      const prompt = el ? (within([el], (e) => hasClass(e, "q-prompt"))[0] ?? el) : null;
      return { n, text: prompt ? questionText(prompt, n) : "", answer: [firsts[i]] };
    });
    return { group: { kind, ...base, questions }, images };
  }

  // 2. Choose TWO / THREE letters.
  const pick = ctx.multiPicks.find((g) => g.questionIds.length === nums.length && g.questionIds.every((n) => numSet.has(n)));
  const checkboxes = inputsOf(block, "checkbox");
  if (pick || checkboxes.length) {
    const opts = new Map<string, string>();
    for (const cb of checkboxes) {
      const key = (attr(cb, "value") ?? "").trim();
      if (key && !opts.has(key)) opts.set(key, optionText(labelOf(cb), key));
    }
    const options = Array.from(opts.entries()).map(([key, text]) => ({ key, text }));
    const letters = pick
      ? pick.correctAnswers.map((x) => String(x).toUpperCase())
      : keys.flatMap((k) => k.map((x) => canonical(x))).flatMap((x) => x.split(/[,\s/]+/)).filter(Boolean);
    const set = Array.from(new Set(letters)).sort();
    if (set.length !== nums.length) issue(ctx, block, `"Choose ${nums.length}" key has ${set.length} letters (${set.join(", ")}).`);
    const stemEl = within(block.nodes, (e) => (e.tagName === "p" || /^h[3-5]$/.test(e.tagName) || hasClass(e, "question-text")) && !notInstruction(e) && !NOISE(e) && !findAll(e, (x) => x.tagName === "input").length && !!cleanText(e))[0];
    const title = stemEl ? questionText(stemEl) : instructions.split("\n")[0];
    checkDeclaredRange(ctx, block, instructions, options);
    return {
      group: { kind: "mcq-multi", ...base, title, options, questions: nums.map((n) => ({ n, answer: set })) },
      images,
    };
  }

  // 3. Reading MCQ: options in data-choices (JSON list of texts).
  const choiceEls = within(block.nodes, (e) => attr(e, "data-choices") != null);
  if (choiceEls.length && !within(block.nodes, (e) => hasClass(e, "answer-input")).length) {
    const questions: ExamQuestion[] = [];
    for (const n of nums) {
      const el = questionElement(block, n);
      const choices = el ? within([el], (e) => attr(e, "data-choices") != null)[0] : null;
      let list: unknown = null;
      try {
        list = choices ? JSON.parse(attr(choices, "data-choices") ?? "null") : null;
      } catch {
        list = null;
      }
      if (!Array.isArray(list) || !list.length) {
        issue(ctx, block, `Question ${n}: options could not be read.`);
        return null;
      }
      const prompt = el ? (within([el], (e) => hasClass(e, "q-prompt"))[0] ?? el) : null;
      questions.push({
        n,
        text: prompt ? questionText(prompt, n) : "",
        options: list.map((t, i) => ({ key: String.fromCharCode(65 + i), text: collapse(String(t)) })),
        answer: keyValues(ctx, n).map((k) => canonical(k)),
      });
    }
    return { group: { kind: "mcq", ...base, questions }, images };
  }

  // 4. Radio inputs per question.
  const radios = inputsOf(block, "radio");
  if (radios.length) {
    const byQ = new Map<number, HtmlElement[]>();
    for (const r of radios) {
      const name = attr(r, "name") ?? "";
      const m = /(\d{1,2})$/.exec(name);
      const n = qOf(r) ?? (m ? Number(m[1]) : null);
      if (n == null || !numSet.has(n)) continue;
      byQ.set(n, [...(byQ.get(n) ?? []), r]);
    }
    const withText = nums.every((n) => (byQ.get(n) ?? []).every((r) => {
      const key = attr(r, "value") ?? "";
      return !!optionText(labelOf(r), key) && !hasClass(labelOf(r), "lmap-cell");
    }));
    if (withText && nums.every((n) => (byQ.get(n)?.length ?? 0) >= 2)) {
      const questions = nums.map((n) => {
        const rs = byQ.get(n)!;
        const el = questionElement(block, n);
        const stem = el ? questionText(el, n) : "";
        return {
          n,
          text: stem,
          options: rs.map((r) => {
            const key = (attr(r, "value") ?? "").trim();
            return { key, text: optionText(labelOf(r), key) };
          }),
          answer: keyValues(ctx, n).map((k) => canonical(k)),
        };
      });
      return { group: { kind: "mcq", ...base, questions }, images };
    }
    // A map / plan matrix: one row per question, the columns are the letters.
    const keysSeen = Array.from(new Set(radios.map((r) => (attr(r, "value") ?? "").trim()).filter(Boolean)));
    const legend = legendOptions(block);
    const noun = nounFor(instructions);
    const options = legend ?? keysSeen.map((k) => ({ key: k, text: noun ? `${noun} ${k}` : k }));
    const texts: Record<string, string> = {};
    for (const n of nums) {
      const row = questionElement(block, n);
      const head = row ? (within([row], (e) => e.tagName === "th")[0] ?? row) : null;
      texts[String(n)] = head ? questionText(head, n) : "";
    }
    checkDeclaredRange(ctx, block, instructions, options);
    return {
      group: { kind: "matching", ...base, options, allowReuse: allowsReuse(instructions, block) || undefined, questions: matchingQuestions(block, ctx, texts) },
      images,
    };
  }

  // 5. Drag-and-drop matching (Listening "ldm", diagrams): a bank of coded options and one row per question.
  const ldmOptions = within(block.nodes, (e) => hasClass(e, "ldm-option") || hasClass(e, "diagram-option") || (hasClass(e, "dd-option-card") && !within(block.nodes, (x) => hasClass(x, "dd-summary-card")).length));
  if (ldmOptions.length && !within(block.nodes, (e) => hasClass(e, "dd-summary-card")).length) {
    const options: ExamOption[] = [];
    for (const o of ldmOptions) {
      const key = (attr(o, "data-code") ?? attr(o, "data-value") ?? cleanText(within([o], (e) => hasClass(e, "ldm-code") || hasClass(e, "option-code"))[0] ?? o)).trim();
      if (!key || options.some((x) => x.key === key)) continue;
      const textEl = within([o], (e) => hasClass(e, "ldm-text"))[0];
      options.push({ key, text: textEl ? cleanText(textEl) : optionText(o, key) });
    }
    const texts: Record<string, string> = {};
    for (const n of nums) {
      const row = questionElement(block, n);
      const q = row ? (within([row], (e) => hasClass(e, "ldm-qtext") || hasClass(e, "diagram-qname"))[0] ?? row) : null;
      texts[String(n)] = q ? questionText(q, n) : "";
    }
    checkDeclaredRange(ctx, block, instructions, options);
    const heading = within(block.nodes, (e) => /^h[3-5]$/.test(e.tagName) && !notInstruction(e) && !within([e], (x) => hasClass(x, "ldm-option")).length && !/^(options|answers?\b)/i.test(cleanText(e)))[0];
    return {
      group: {
        kind: "matching",
        ...base,
        ...(heading ? { title: cleanText(heading) } : {}),
        options,
        allowReuse: allowsReuse(instructions, block) || undefined,
        questions: matchingQuestions(block, ctx, texts),
      },
      images,
    };
  }

  // 6. Matching headings (Reading): the headings literal and "Paragraph N" rows.
  if (within(block.nodes, (e) => hasClass(e, "mh-headings-bank") || hasClass(e, "heading-question-list")).length) {
    const options = literalOptions(ctx, "headingOptions");
    if (!options) {
      issue(ctx, block, "The list of headings could not be read.");
      return null;
    }
    const texts: Record<string, string> = {};
    for (const n of nums) {
      const el = questionElement(block, n);
      const prompt = el ? (within([el], (e) => hasClass(e, "q-prompt"))[0] ?? el) : null;
      texts[String(n)] = prompt ? questionText(prompt, n) : "";
    }
    return {
      group: { kind: "matching", ...base, options, allowReuse: allowsReuse(instructions, block) || undefined, questions: matchingQuestions(block, ctx, texts) },
      images,
    };
  }

  // 7. Summary with a word bank (gap-box).
  const ddCard = within(block.nodes, (e) => hasClass(e, "dd-summary-card"))[0];
  if (ddCard) {
    const bankEls = within(block.nodes, (e) => hasClass(e, "dd-option-card"));
    let options = literalOptions(ctx, "ddOptions");
    if (!options && bankEls.length) {
      options = bankEls.map((o) => {
        const key = (attr(o, "data-code") ?? cleanText(within([o], (e) => hasClass(e, "dd-option-code"))[0] ?? o)).trim();
        return { key, text: optionText(o, key) };
      });
    }
    if (!options) {
      issue(ctx, block, "The word box could not be read.");
      return null;
    }
    checkDeclaredRange(ctx, block, instructions, options);
    const textEl = within([ddCard], (e) => hasClass(e, "dd-summary-text"))[0] ?? ddCard;
    const titleEl = within([ddCard], (e) => hasClass(e, "dd-summary-title"))[0];
    const template = renderTemplate([textEl], numSet, () => false);
    return {
      group: {
        kind: "gap-box",
        ...base,
        title: titleEl ? cleanText(titleEl) : undefined,
        options,
        template,
        questions: nums.map((n) => ({ n, answer: keyValues(ctx, n).map((k) => canonical(k)) })),
      },
      images,
    };
  }

  // 8. Matching grid (Reading): statements from a script literal, options from the legend or the grid header.
  const grid = within(block.nodes, (e) => e.tagName === "table" && hasClass(e, "matching-grid"))[0];
  if (grid) {
    const texts = statementsLiteral(ctx, nums, new Set(["correctAnswers", "textAnswerRules", "headingOptions", "ddOptions"]));
    if (!texts) {
      issue(ctx, block, "The matching statements could not be read.");
      return null;
    }
    const legend = legendOptions(block);
    const noun = nounFor(instructions);
    const headerKeys = gridHeaderKeys(block);
    const options = legend ?? headerKeys.map((k) => ({ key: k, text: noun ? `${noun} ${k}` : k }));
    if (!options.length) {
      issue(ctx, block, "The matching options could not be read.");
      return null;
    }
    checkDeclaredRange(ctx, block, instructions, options);
    return {
      group: { kind: "matching", ...base, options, allowReuse: allowsReuse(instructions, block) || undefined, questions: matchingQuestions(block, ctx, texts) },
      images,
    };
  }

  // 9. Gaps: text inputs.
  const textInputs = within(block.nodes, (e) => e.tagName === "input" && ["text", ""].includes((attr(e, "type") ?? "text").toLowerCase()));
  if (textInputs.length) {
    const phrase = limitPhrase(block);
    const limit = phrase ? parseWordLimit(phrase) : null;
    const maxWordsAttr = Math.max(0, ...textInputs.map((i) => Number(attr(i, "data-maxwords") ?? 0)).filter((x) => Number.isFinite(x)));
    const allowNumberAttr = textInputs.some((i) => attr(i, "data-allow-number") === "true");
    let wordLimit = limit?.words || maxWordsAttr || undefined;
    let allowNumber = limit?.number || allowNumberAttr || undefined;
    const rules = ctx.textRules;
    if (rules) {
      const own = nums.map((n) => rules[String(n)]).filter(Boolean);
      if (own.length) {
        const words = Math.max(...own.map((r) => Number(r!.maxWords ?? 0)));
        const num = own.some((r) => Number(r!.maxNumbers ?? 0) > 0);
        if ((limit && (limit.words !== words || !!limit.number !== num)) || (!limit && words)) {
          if (limit) issue(ctx, block, `The answer rule "${phrase}" differs from textAnswerRules (max ${words} word(s)${num ? " and a number" : ""}); the instruction is kept.`, false);
        }
        if (!limit) {
          wordLimit = words || wordLimit;
          allowNumber = num || allowNumber;
        }
      }
    }
    // One sentence per question (sentence completion / short answers) → the gap goes in the question text.
    const perQuestion = nums.map((n) => {
      const holder = within(block.nodes, (e) =>
        (hasClass(e, "sentence-question") || hasClass(e, "short-question") || hasClass(e, "question") || hasClass(e, "question-card-row")) &&
        within([e], (i) => i.tagName === "input" && qOf(i) === n).length > 0,
      );
      return holder.find((h) => within([h], (i) => i.tagName === "input").length === 1) ?? null;
    });
    // An alternative longer than the word limit can never be marked correct (the grader enforces the
    // limit, as in the exam): it is left out, with a warning naming the question.
    const answersOf = (n: number): string[] => {
      const all = keyValues(ctx, n);
      if (!wordLimit) return all;
      const fits = all.filter((a) => expandOptional(a).every((v) => countLimitedWords(v, allowNumber) <= wordLimit!));
      if (fits.length && fits.length < all.length) {
        ctx.warnings.push({ file: ctx.file, questions: [n], message: `Key alternative(s) ${all.filter((a) => !fits.includes(a)).map((a) => `"${a}"`).join(", ")} exceed the ${wordLimit}-word limit and can't be marked correct; left out.` });
        return fits;
      }
      return all;
    };
    const titleEl = within(block.nodes, (e) => (e.tagName === "h4" || e.tagName === "h3") && !notInstruction(e) && !questionRange(cleanText(e)))[0];
    let template: string | undefined;
    let questions: ExamQuestion[];
    if (perQuestion.every((h) => h)) {
      questions = nums.map((n, i) => ({ n, text: renderTemplate([perQuestion[i]!], new Set([n]), () => false).replace(/\n/g, " "), answer: answersOf(n) }));
    } else {
      const contentNodes = block.nodes.filter((nd) => !(isElement(nd) && (notInstruction(nd) || nd === titleEl)));
      template = renderTemplate(contentNodes, numSet, (e) => notInstruction(e) || e === titleEl);
      questions = nums.map((n) => ({ n, answer: answersOf(n) }));
    }
    return {
      group: {
        kind: "gap",
        ...base,
        answerRule: phrase ?? undefined,
        wordLimit,
        allowNumber: allowNumber || undefined,
        title: titleEl ? cleanText(titleEl) : undefined,
        template,
        questions,
      },
      images,
    };
  }

  issue(ctx, block, "This question block matches none of the supported question types.");
  return null;
}

// ---------------------------------------------------------------------------
// Blocks: split a part's markup at its "Questions N–M" anchors.
// ---------------------------------------------------------------------------

/** The smallest elements whose whole text is "Questions N–M" (the group anchors). */
function anchors(root: HtmlNode): { el: HtmlElement; from: number; to: number }[] {
  const out: { el: HtmlElement; from: number; to: number }[] = [];
  const walk = (n: HtmlNode) => {
    for (const c of children(n)) {
      if (!isElement(c) || ["script", "style", "button", "nav"].includes(c.tagName)) continue;
      const r = questionRange(textContent(c));
      if (r && !elementChildren(c).some((k) => questionRange(textContent(k)))) {
        out.push({ el: c, ...r });
        continue;
      }
      walk(c);
    }
  };
  walk(root);
  return out;
}

function ancestors(n: HtmlNode): HtmlNode[] {
  const out: HtmlNode[] = [];
  let p = (n as unknown as { parentNode?: HtmlNode }).parentNode;
  while (p) {
    out.push(p);
    p = (p as unknown as { parentNode?: HtmlNode }).parentNode;
  }
  return out;
}

/**
 * Question blocks of one part: the content between consecutive anchors, cut
 * at the children of the anchors' lowest common container.
 */
export function questionBlocks(part: HtmlNode): GroupBlock[] {
  const list = anchors(part);
  const blocks: GroupBlock[] = [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    const next = list[i + 1];
    // The block container: the highest ancestor of the anchor inside `part` that holds no other anchor.
    const others = list.filter((x) => x !== a).map((x) => new Set(ancestors(x.el)));
    let container: HtmlNode = a.el;
    for (const anc of ancestors(a.el)) {
      if (anc === part) break;
      if (others.some((s) => s.has(anc))) break;
      container = anc;
    }
    const parent = (container as unknown as { parentNode?: HtmlNode }).parentNode!;
    const sibs = children(parent);
    const start = sibs.indexOf(container);
    const nodes: HtmlNode[] = [container];
    // Following siblings until the one that holds the next anchor (content shared with the next block's container).
    for (let k = start + 1; k < sibs.length; k++) {
      const s = sibs[k];
      if (next && (s === next.el || ancestors(next.el).includes(s))) break;
      if (isElement(s) && anchors(s).length) break;
      nodes.push(s);
    }
    blocks.push({ from: a.from, to: a.to, nodes });
  }
  return blocks;
}
