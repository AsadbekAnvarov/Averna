/**
 * Admin bulk exam generator — server logic behind /api/admin/exam-gen/*.
 *
 * One STEP = one model call = one Reading passage, one Listening part, or one
 * whole Writing task / Speaking set (STEPS_FOR in ./generation-types). Model
 * output is normalised defensively, validated with the same validators the
 * catalog uses, and only then stored in the draft row. The final step writes
 * the object exactly as lib/ielts/catalog.ts and lib/writing-content.ts read it.
 *
 * Pure except callExamModel(), which lazily loads the OpenAI SDK — no db/next
 * imports, so offline checks can import this file directly.
 */

import { STEPS_FOR, type DraftStatus, type DraftSummary, type GenDifficulty, type GenSkill } from "./generation-types";
import type {
  ExamGroup,
  ExamListeningTest,
  ExamOption,
  ExamParagraph,
  ExamQuestion,
  ExamReadingTest,
  GroupKind,
  ListeningPart,
  ListeningSpeaker,
  ReadingPart,
  ScriptLine,
  SpeakingExamSet,
  VoiceAccent,
  VoiceGender,
} from "./types";
import { LETTERS, ROMAN, placeholders, splitParagraphs, wordCount } from "./format";
import { canonicalBinary, countLimitedWords, expandOptional } from "./grading";
import { validateListeningTest, validateReadingTest, validateSpeakingSet, type ValidationReport } from "./validate";
import { writingPromptSchema, writingTask1Schema } from "../test-schema";
import type { Task1ChartData, WritingPrompt } from "../writing-data";
import {
  READING_TOPICS,
  findListeningSet,
  findReadingTopic,
  findSpeakingTheme,
  findTask1Scenario,
  findTask2Topic,
  parseTopic,
  type EssayType,
  type Task1Chart,
} from "./topic-bank";

// ---------------------------------------------------------------------------
// Storage conventions
// ---------------------------------------------------------------------------

export const GEN_SKILLS: GenSkill[] = ["READING", "LISTENING", "WRITING_TASK1", "WRITING_TASK2", "SPEAKING"];

export const GEN_DIFFICULTIES: GenDifficulty[] = ["Easy", "Medium", "Hard"];

/** GeneratedTest.module per skill — the modules catalog.ts / writing-content.ts read. */
export const MODULE_FOR: Record<GenSkill, string> = {
  READING: "READING",
  LISTENING: "LISTENING",
  WRITING_TASK1: "WRITING_TASK1",
  WRITING_TASK2: "WRITING",
  SPEAKING: "SPEAKING",
};

/** Bulk rows carry level "exam-gen:<difficulty>" so they never mix with the single generator's rows. */
export const LEVEL_PREFIX = "exam-gen";
/** A step that fails this many times in a row marks the draft "failed". */
export const MAX_FAILURES = 3;
/** Generation lock: longer than a whole /step request (maxDuration 60 s). */
export const LOCK_MS = 70_000;
/** Hard ceiling for one model call, so /step always finishes inside 60 s. */
export const MODEL_TIMEOUT_MS = 50_000;

/** Reading: passage k → questions 1–13 / 14–26 / 27–40. */
export const READING_RANGES = [
  { startAt: 1, count: 13 },
  { startAt: 14, count: 13 },
  { startAt: 27, count: 14 },
] as const;
/** Listening: part k → questions 10k−9 … 10k. */
export const LISTENING_RANGES = [1, 11, 21, 31].map((startAt) => ({ startAt, count: 10 }));

/** Columns every exam-gen route selects. */
export const GEN_ROW_SELECT = {
  id: true,
  module: true,
  title: true,
  topic: true,
  level: true,
  published: true,
  data: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const levelFor = (d: GenDifficulty): string => `${LEVEL_PREFIX}:${d}`;
export const isExamGenLevel = (level: string | null | undefined): boolean =>
  typeof level === "string" && level.startsWith(LEVEL_PREFIX);
export const isGenSkill = (v: unknown): v is GenSkill => typeof v === "string" && (GEN_SKILLS as string[]).includes(v);
export const isGenDifficulty = (v: unknown): v is GenDifficulty =>
  typeof v === "string" && (GEN_DIFFICULTIES as string[]).includes(v);

export function skillForModule(module: string | null | undefined): GenSkill | null {
  const hit = GEN_SKILLS.find((s) => MODULE_FOR[s] === module);
  return hit ?? null;
}

export function difficultyFromLevel(level: string | null | undefined): GenDifficulty | null {
  const d = typeof level === "string" ? level.slice(LEVEL_PREFIX.length + 1) : "";
  return isGenDifficulty(d) ? d : null;
}

export type GenPart = ReadingPart | ListeningPart;
export type FinalData = ExamReadingTest | ExamListeningTest | SpeakingExamSet | WritingPrompt;

/** GeneratedTest.data while a draft is being generated. */
export interface DraftData {
  format: "draft";
  skill: GenSkill;
  topic: string;
  difficulty: GenDifficulty;
  title: string;
  /** Validated parts so far (Reading passages / Listening parts). */
  parts: GenPart[];
  /** Consecutive failures of the current step. */
  failures: number;
  lastError?: string;
  warnings: string[];
  /** Epoch ms — a /step request holds the draft until then. */
  lockedUntil?: number;
  status?: "failed";
}

/** The GeneratedTest columns the routes select (GEN_ROW_SELECT). */
export interface GenRow {
  id: string;
  module: string;
  title: string;
  topic: string | null;
  level: string | null;
  published: boolean;
  data: unknown;
  createdAt: Date | string;
}

const TITLE_PREFIX: Record<GenSkill, string> = {
  READING: "Averna Reading",
  LISTENING: "Averna Listening",
  WRITING_TASK1: "Averna Writing Task 1",
  WRITING_TASK2: "Averna Writing Task 2",
  SPEAKING: "Averna Speaking",
};

export const planTitle = (skill: GenSkill, topic: string): string => `${TITLE_PREFIX[skill]} · ${topic}`;

export function newDraft(skill: GenSkill, topic: string, difficulty: GenDifficulty): DraftData {
  return { format: "draft", skill, topic, difficulty, title: planTitle(skill, topic), parts: [], failures: 0, warnings: [] };
}

/** Difficulties for a plan; "mixed" cycles Medium, Easy, Medium, Hard (Medium bias). */
export function planDifficulties(count: number, choice: GenDifficulty | "mixed"): GenDifficulty[] {
  const cycle: GenDifficulty[] = ["Medium", "Easy", "Medium", "Hard"];
  return Array.from({ length: count }, (_, i) => (choice === "mixed" ? cycle[i % cycle.length] : choice));
}

// ---------------------------------------------------------------------------
// Small coercion helpers
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** Single-line text: trimmed, inner whitespace collapsed. */
function oneLine(v: unknown): string {
  const s = typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
  return s.replace(/\s+/g, " ").trim();
}

/** Multi-line text (templates, prompts, essays): lines trimmed, at most one blank line in a row. */
function multiLine(v: unknown): string {
  const s = Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : "")).join("\n") : typeof v === "string" ? v : "";
  return s
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

function toInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  if (/^-?\d+$/.test(t)) return Number(t);
  return WORD_NUMBERS[t] ?? null;
}

/** Question number from 14, "14", "Q14", "q-14". */
function toQuestionNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  const m = typeof v === "string" ? /(\d+)/.exec(v) : null;
  return m ? Number(m[1]) : null;
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const t = v.replace(/[,\s%$£€]/g, "");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

function toBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  if (t === "true" || t === "yes" || t === "1") return true;
  if (t === "false" || t === "no" || t === "0") return false;
  return null;
}

/** A list of non-empty single-line strings (accepts strings, numbers or { text } objects). */
function strList(v: unknown): string[] {
  const items = Array.isArray(v) ? v : typeof v === "string" && v.includes("\n") ? v.split("\n") : v == null ? [] : [v];
  return items
    .map((x) => (isObj(x) ? oneLine(x.text ?? x.question ?? x.q ?? x.value ?? x.label ?? x.phrase) : oneLine(x)))
    .map((x) => x.replace(/^(?:[-•*·]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
}

const unique = <T,>(items: T[]): T[] => Array.from(new Set(items));
const normText = (s: string): string =>
  s.toLowerCase().replace(/[‘’'"“”]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** 32-bit FNV-1a — deterministic plan choice per draft (retries get the same plan). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Find the object that actually holds the payload (models sometimes wrap it: { "passage": { … } }). */
function unwrap(raw: unknown, keys: string[], looksRight: (o: Obj) => boolean): Obj {
  if (!isObj(raw)) return {};
  if (looksRight(raw)) return raw;
  for (const k of keys) {
    const v = raw[k];
    if (isObj(v) && looksRight(v)) return v;
  }
  const values = Object.values(raw).filter(isObj);
  return values.length === 1 && looksRight(values[0]) ? values[0] : raw;
}

// ---------------------------------------------------------------------------
// Draft data, status and summaries
// ---------------------------------------------------------------------------

/** The draft stored in `data`, or null when `data` is a finished test. */
export function readDraft(data: unknown, fallbackSkill?: GenSkill | null): DraftData | null {
  if (!isObj(data) || data.format !== "draft") return null;
  const skill = isGenSkill(data.skill) ? data.skill : fallbackSkill;
  if (!skill) return null;
  const d: DraftData = {
    format: "draft",
    skill,
    topic: oneLine(data.topic),
    difficulty: isGenDifficulty(data.difficulty) ? data.difficulty : "Medium",
    title: oneLine(data.title),
    parts: Array.isArray(data.parts) ? (data.parts.filter(isObj) as unknown as GenPart[]) : [],
    failures: typeof data.failures === "number" && data.failures > 0 ? Math.floor(data.failures) : 0,
    warnings: Array.isArray(data.warnings) ? data.warnings.filter((w): w is string => typeof w === "string") : [],
  };
  if (typeof data.lastError === "string" && data.lastError) d.lastError = data.lastError;
  if (typeof data.lockedUntil === "number") d.lockedUntil = data.lockedUntil;
  if (data.status === "failed") d.status = "failed";
  return d;
}

export const isFailedDraft = (d: DraftData): boolean => d.status === "failed" || d.failures >= MAX_FAILURES;
export const isLocked = (d: DraftData, now = Date.now()): boolean => typeof d.lockedUntil === "number" && d.lockedUntil > now;

/** Copy without the lock / cleared optional fields (undefined keys never reach the JSON column). */
export function cleanDraft(d: DraftData): DraftData {
  const out: DraftData = { ...d };
  delete out.lockedUntil;
  if (!out.lastError) delete out.lastError;
  if (out.status !== "failed") delete out.status;
  return out;
}

export function draftStatus(row: { published: boolean; data: unknown; module?: string }, now = Date.now()): DraftStatus {
  if (row.published) return "published";
  const d = readDraft(row.data, skillForModule(row.module));
  if (!d) return "ready";
  if (isFailedDraft(d)) return "failed";
  if (d.parts.length === 0 && d.failures === 0 && !isLocked(d, now)) return "queued";
  return "generating";
}

function countQuestions(parts: unknown): number {
  if (!Array.isArray(parts)) return 0;
  return parts.reduce<number>((n, p) => {
    const groups = isObj(p) && Array.isArray(p.groups) ? p.groups : [];
    return n + groups.reduce<number>((m, g) => m + (isObj(g) && Array.isArray(g.questions) ? g.questions.length : 0), 0);
  }, 0);
}

/** Validation of a finished test (what decides whether it can be published). */
export function finalReport(skill: GenSkill, data: unknown): ValidationReport {
  switch (skill) {
    case "READING":
      return validateReadingTest(data, { requireFull: true });
    case "LISTENING":
      return validateListeningTest(data, { requireFull: true });
    case "SPEAKING":
      return checkSpeakingSet(data);
    case "WRITING_TASK1":
      return checkTask1(data);
    case "WRITING_TASK2":
      return checkTask2(data);
  }
}

export function summarizeDraft(row: GenRow, now = Date.now()): DraftSummary {
  const draft = readDraft(row.data, skillForModule(row.module));
  const skill = skillForModule(row.module) ?? draft?.skill ?? "READING";
  const steps = STEPS_FOR[skill];
  const finalDifficulty = isObj(row.data) && isGenDifficulty(row.data.difficulty) ? row.data.difficulty : null;
  const summary: DraftSummary = {
    id: row.id,
    skill,
    title: row.title,
    topic: row.topic ?? draft?.topic ?? "",
    difficulty: difficultyFromLevel(row.level) ?? draft?.difficulty ?? finalDifficulty ?? "Medium",
    status: draftStatus({ published: row.published, data: row.data, module: row.module }, now),
    stepsDone: steps,
    steps,
    questions: 0,
    warnings: [],
    failures: 0,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
  if (draft) {
    summary.stepsDone = Math.min(draft.parts.length, steps);
    summary.questions = countQuestions(draft.parts);
    summary.warnings = draft.warnings;
    summary.failures = draft.failures;
    if (draft.lastError) summary.lastError = draft.lastError;
    return summary;
  }
  if (skill === "READING" || skill === "LISTENING") summary.questions = countQuestions(isObj(row.data) ? row.data.parts : null);
  const report = finalReport(skill, row.data);
  summary.warnings = [...report.errors.map((e) => `Error: ${e}`), ...report.warnings];
  return summary;
}

/** Publishable = a finished (non-draft) test with no validation errors. */
export function canPublish(row: GenRow): boolean {
  const skill = skillForModule(row.module);
  if (!skill || !isExamGenLevel(row.level) || readDraft(row.data, skill) || !isObj(row.data)) return false;
  return finalReport(skill, row.data).errors.length === 0;
}

// ---------------------------------------------------------------------------
// Normalising model output — question groups
// ---------------------------------------------------------------------------

const KINDS: GroupKind[] = ["tfng", "ynng", "mcq", "mcq-multi", "matching", "gap", "gap-box"];
const NUMBER_WORD = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE"];

function normKind(v: unknown): GroupKind | null {
  const s = String(v ?? "").toLowerCase().trim().replace(/[\s_/]+/g, "-");
  if ((KINDS as string[]).includes(s)) return s as GroupKind;
  if (/yes-no|ynng|writer/.test(s)) return "ynng";
  if (/true-false|tfng|not-given/.test(s)) return "tfng";
  if (/(^|-)multi($|-)|choose-(two|three|2|3)|multi-?(select|answer)|mcq-?multi|multiple-(answers|select|response)|two-letters/.test(s)) return "mcq-multi";
  if (/multiple-choice|mcq|single-choice|choice/.test(s)) return "mcq";
  if (/box|bank|list-of-words|word-list/.test(s)) return "gap-box";
  if (/match|heading|feature|ending|paragraph|classif/.test(s)) return "matching";
  if (/gap|complet|fill|short-answer|summary|notes|table|flow|form|sentence|diagram/.test(s)) return "gap";
  return null;
}

interface KeyMap {
  options: ExamOption[];
  /** old key (lower-case) → new key */
  byKey: Map<string, string>;
  /** normalised option text → new key */
  byText: Map<string, string>;
}

const isRomanKey = (k: string): boolean => ROMAN.includes(k.toLowerCase());
const KEY_PREFIX = /^\s*[([]?\s*([A-Za-z]|[ivxIVX]{1,5})\s*[).\]:]\s+(.+)$/;

/** Re-key a shared/per-question option list sequentially (A, B, C… or i, ii, iii…), remembering the old keys. */
function rekey(raw: unknown, style: "letters" | "roman" | "auto"): KeyMap {
  const items: { key: string; text: string }[] = [];
  const push = (key: string, text: string) => {
    let t = text;
    const pre = KEY_PREFIX.exec(t);
    if (pre && (!key || pre[1].toLowerCase() === key.toLowerCase())) {
      key = key || pre[1];
      t = pre[2];
    }
    items.push({ key: key.trim(), text: oneLine(t) });
  };
  if (Array.isArray(raw)) {
    for (const o of raw) {
      if (typeof o === "string" || typeof o === "number") push("", String(o));
      else if (isObj(o)) push(oneLine(o.key ?? o.letter ?? o.id ?? o.code), oneLine(o.text ?? o.option ?? o.value ?? o.label ?? o.heading ?? o.name));
    }
  } else if (isObj(raw)) {
    for (const [k, v] of Object.entries(raw)) push(k, oneLine(v));
  }
  const kept = items.filter((i) => i.text);

  const roman = style === "roman" || (style === "auto" && kept.length > 0 && kept.every((i) => isRomanKey(i.key)));
  const ref = roman ? ROMAN : LETTERS;
  const options = kept.map((i, idx) => ({ key: ref[idx] ?? String(idx + 1), text: i.text }));
  const byKey = new Map<string, string>();
  const byText = new Map<string, string>();
  const hasOldKeys = kept.length > 0 && kept.every((i) => i.key) && new Set(kept.map((i) => i.key.toLowerCase())).size === kept.length;
  kept.forEach((i, idx) => {
    const nk = options[idx].key;
    byKey.set((hasOldKeys ? i.key : nk).toLowerCase(), nk);
    byText.set(normText(i.text), nk);
  });
  return { options, byKey, byText };
}

/** Map an answer given as a key ("B", "(b)", "iv"), as "B. text" or as the option text itself. */
function mapKey(answer: string, km: KeyMap): string {
  const a = answer.trim();
  if (!a) return "";
  const bare = a.replace(/^[([]\s*/, "").replace(/\s*[)\].:]$/, "").trim().toLowerCase();
  const direct = km.byKey.get(bare);
  if (direct) return direct;
  const byText = km.byText.get(normText(a));
  if (byText) return byText;
  const pre = KEY_PREFIX.exec(a);
  const viaPrefix = pre ? km.byKey.get(pre[1].toLowerCase()) : undefined;
  if (viaPrefix) return viaPrefix;
  const para = /^paragraph\s+([a-z])$/i.exec(a);
  const viaPara = para ? km.byKey.get(para[1].toLowerCase()) : undefined;
  return viaPara ?? a;
}

function answerList(v: unknown): string[] {
  const raw = Array.isArray(v) ? v : v == null ? [] : [v];
  return raw
    .map((a) => (typeof a === "string" || typeof a === "number" ? String(a) : isObj(a) ? oneLine(a.key ?? a.text ?? a.value) : ""))
    .map((a) => a.trim())
    .filter(Boolean);
}

/** "A, D" / "A and D" / ["A","D"] / "AD" → ["A","D"] (mcq-multi). */
function splitKeys(answers: string[]): string[] {
  return answers.flatMap((a) => {
    const parts = a.split(/\s*(?:,|;|&|\/|\band\b|\s)\s*/i).filter(Boolean);
    return parts.length === 1 && /^[A-H]{2,3}$/.test(parts[0]) ? parts[0].split("") : parts;
  });
}

/** Gap answers: split "40 / forty", strip quotes and trailing punctuation, de-duplicate. */
function cleanGapAnswers(answers: string[]): string[] {
  const out = answers
    .flatMap((a) => a.split(/\s+\/\s+|;/))
    .map((a) => a.replace(/^[\s"'“”‘’«»]+|[\s"'“”‘’«».,;:!?]+$/g, "").replace(/\s+/g, " "))
    .filter(Boolean);
  const seen = new Set<string>();
  return out.filter((a) => (seen.has(a.toLowerCase()) ? false : (seen.add(a.toLowerCase()), true)));
}

/** "[[ 5 ]]" / "{{5}}" → "[[5]]". */
const canonicalPlaceholders = (s: string): string =>
  s.replace(/\[\[\s*(\d+)\s*\]\]/g, "[[$1]]").replace(/\{\{\s*(\d+)\s*\}\}/g, "[[$1]]");

const BLANK_RE = /_{3,}/;

interface RawQuestion {
  oldN: number | null;
  text: string;
  rawOptions: unknown;
  answer: string[];
  explanation: string;
}

function readQuestion(raw: unknown): RawQuestion {
  const q: Obj = isObj(raw) ? raw : { text: raw };
  return {
    oldN: toQuestionNumber(q.n ?? q.number ?? q.num ?? q.id ?? q.q),
    text: canonicalPlaceholders(oneLine(q.text ?? q.question ?? q.statement ?? q.stem ?? q.prompt ?? q.item)),
    rawOptions: q.options ?? q.choices,
    answer: answerList(q.answer ?? q.answers ?? q.correct ?? q.correctAnswer ?? q.key),
    explanation: oneLine(q.explanation ?? q.rationale ?? q.justification ?? q.evidence),
  };
}

interface NormGroup {
  group: ExamGroup;
  /** Numbers the model used (for rewriting [[n]] placeholders after renumbering). */
  oldNs: (number | null)[];
}

interface GroupContext {
  skill: "READING" | "LISTENING";
  partNo: number;
  /** Paragraph labels of the passage (Reading). */
  labels: string[];
}

const withExplanation = (q: ExamQuestion, explanation: string): ExamQuestion => (explanation ? { ...q, explanation } : q);

interface GroupBase {
  raw: Obj;
  instructions: string;
  title: string;
  rawOptions: unknown;
  template: string;
  /** answerRule + instructions (to infer word limits). */
  ruleText: string;
}

function normalizeGroup(raw: unknown, ctx: GroupContext): NormGroup | null {
  if (!isObj(raw)) return null;
  const rawQs = Array.isArray(raw.questions) ? raw.questions : Array.isArray(raw.items) ? raw.items : [];
  if (!rawQs.length) return null;
  const qs = rawQs.map(readQuestion);
  const b: GroupBase = {
    raw,
    instructions: oneLine(raw.instructions ?? raw.instruction ?? raw.rubric),
    title: oneLine(raw.title ?? raw.heading),
    rawOptions: raw.options ?? raw.list ?? raw.headings ?? raw.box ?? raw.wordBox ?? raw.choices,
    template: canonicalPlaceholders(multiLine(raw.template ?? raw.notes ?? raw.summary)),
    ruleText: `${oneLine(raw.answerRule)} ${oneLine(raw.instructions ?? raw.instruction)}`,
  };
  const kind = normKind(raw.kind ?? raw.type ?? raw.questionType);
  switch (kind) {
    case "tfng":
    case "ynng":
      return binaryGroup(kind, b, qs, ctx);
    case "mcq":
      return mcqGroup(b, qs, ctx);
    case "mcq-multi":
      return multiGroup(b, qs);
    case "matching":
      return matchingGroup(b, qs, ctx);
    case "gap":
      return gapGroup(b, qs, ctx);
    case "gap-box":
      return gapBoxGroup(b, qs);
    default: {
      // Unknown kind: keep it so validation reports it instead of silently losing questions.
      const questions = qs.map((q) => withExplanation({ n: 0, text: q.text, answer: q.answer }, q.explanation));
      return { group: { kind: String(raw.kind ?? "") as GroupKind, instructions: b.instructions, questions }, oldNs: qs.map((q) => q.oldN) };
    }
  }
}

function defaultInstructions(kind: GroupKind, ctx: GroupContext, extra: { options?: number; headings?: boolean; template?: string } = {}): string {
  const passage = `Reading Passage ${ctx.partNo}`;
  switch (kind) {
    case "tfng":
      return `Do the following statements agree with the information given in ${passage}?`;
    case "ynng":
      return `Do the following statements agree with the claims of the writer in ${passage}?`;
    case "mcq":
      return (extra.options ?? (ctx.skill === "READING" ? 4 : 3)) >= 4 ? "Choose the correct letter, A, B, C or D." : "Choose the correct letter, A, B or C.";
    case "mcq-multi":
      return "Choose TWO letters, A–E.";
    case "matching":
      if (extra.headings) return "Choose the correct heading for each paragraph from the list of headings below.";
      return ctx.skill === "READING" ? "Match each statement with the correct option, from the list below." : "Choose the correct letter for each question from the box.";

    case "gap": {
      const t = extra.template ?? "";
      if (!t) return "Complete the sentences below.";
      if (/^\s*\|/m.test(t)) return "Complete the table below.";
      if (t.includes("↓")) return "Complete the flow-chart below.";
      return /^\s*[#-]/m.test(t) ? "Complete the notes below." : "Complete the summary below.";
    }
    case "gap-box":
      return "Complete the summary using the list of words below.";
  }
}

function binaryGroup(kind: "tfng" | "ynng", b: GroupBase, qs: RawQuestion[], ctx: GroupContext): NormGroup {
  const answers = qs.map((q) => canonicalBinary(String(q.answer[0] ?? "").replace(/[^a-z\s_-]/gi, " ").trim()));
  const yn = answers.some((a) => a === "YES" || a === "NO");
  const tf = answers.some((a) => a === "TRUE" || a === "FALSE");
  // The model sometimes labels a writer's-views group "tfng" (or the reverse): follow the answers.
  let k: "tfng" | "ynng" = kind;
  if (kind === "tfng" && yn && !tf) k = "ynng";
  if (kind === "ynng" && tf && !yn) k = "tfng";
  const wrongWording = k === "ynng" ? /information/i.test(b.instructions) : /claims|views|writer/i.test(b.instructions);
  const instructions = !b.instructions || (k !== kind && wrongWording) ? defaultInstructions(k, ctx) : b.instructions;
  const questions = qs.map((q, i) =>
    withExplanation({ n: 0, text: q.text, answer: answers[i] ? [answers[i]] : q.answer.slice(0, 1) }, q.explanation)
  );
  return { group: { kind: k, instructions, questions }, oldNs: qs.map((q) => q.oldN) };
}

function mcqGroup(b: GroupBase, qs: RawQuestion[], ctx: GroupContext): NormGroup {
  const perQuestion = qs.some((q) => Array.isArray(q.rawOptions) || isObj(q.rawOptions));
  if (!perQuestion && b.rawOptions) {
    // A shared list answered with two or more letters is a "choose TWO" task…
    const km = rekey(b.rawOptions, "letters");
    const several = (q: RawQuestion) => {
      const keys = splitKeys(q.answer);
      return keys.length >= 2 && keys.every((k) => km.byKey.has(k.toLowerCase())) && !km.byText.has(normText(q.answer.join(" ")));
    };
    if (qs.some(several)) return multiGroup(b, qs);
    // …and one shared list for several single-answer questions is a matching task.
    if (qs.length > 1) return matchingGroup(b, qs, ctx);
  }
  const questions = qs.map((q) => {
    const km = rekey(perQuestion ? q.rawOptions : b.rawOptions, "letters");
    const ans = mapKey(q.answer[0] ?? "", km);
    return withExplanation({ n: 0, text: q.text, options: km.options, answer: ans ? [ans] : [] }, q.explanation);
  });
  const instructions = b.instructions || defaultInstructions("mcq", ctx, { options: questions[0]?.options?.length });
  return { group: { kind: "mcq", instructions, questions }, oldNs: qs.map((q) => q.oldN) };
}

function multiGroup(b: GroupBase, qs: RawQuestion[]): NormGroup {
  const km = rekey(b.rawOptions ?? qs[0]?.rawOptions, "letters");
  // Every question of a "choose TWO" group carries the FULL key set. Answers may be keys,
  // option texts, or several keys in one string ("A and C").
  const isKey = (k: string) => km.options.some((o) => o.key === k);
  const whole = qs.flatMap((q) => q.answer).map((a) => mapKey(a, km));
  const keys = whole.every(isKey) ? whole : splitKeys(qs.flatMap((q) => q.answer)).map((a) => mapKey(a, km));
  const set = unique(keys.filter(Boolean)).sort();
  const expand = qs.length === 1 && set.length >= 2;
  const src = expand ? set.map(() => qs[0]) : qs;
  const stem = b.title || qs.find((q) => q.text)?.text || (/\?\s*$/.test(b.instructions) ? b.instructions : "");
  const last = km.options[km.options.length - 1]?.key ?? "E";
  const instructions =
    !b.instructions || b.instructions === stem ? `Choose ${NUMBER_WORD[src.length] ?? src.length} letters, A–${last}.` : b.instructions;
  const firstExplanation = src.find((q) => q.explanation)?.explanation ?? "";
  const questions = src.map((q) => withExplanation({ n: 0, answer: [...set] }, q.explanation || firstExplanation));
  const group: ExamGroup = { kind: "mcq-multi", instructions, ...(stem ? { title: stem } : {}), options: km.options, questions };
  return { group, oldNs: expand ? src.map(() => null) : qs.map((q) => q.oldN) };
}

const paragraphRef = (t: string): string => {
  const m = /^(?:paragraph|para\.?|section)?\s*([A-Z])[.:]?$/i.exec(t.trim());
  return m ? `Paragraph ${m[1].toUpperCase()}` : t;
};

function matchingGroup(b: GroupBase, qs: RawQuestion[], ctx: GroupContext): NormGroup {
  const text = `${b.instructions} ${b.title}`;
  const rawKeys = Array.isArray(b.rawOptions) ? b.rawOptions.map((o) => (isObj(o) ? oneLine(o.key ?? o.letter) : "")) : [];
  const info =
    ctx.skill === "READING" &&
    ctx.labels.length > 0 &&
    (/which (paragraph|section)|contains? the following information/i.test(text) ||
      (!b.rawOptions && qs.every((q) => /^(paragraph\s+)?[A-Z]$/i.test(q.answer[0] ?? ""))));
  const headings = !info && (/heading/i.test(text) || (rawKeys.length > 0 && rawKeys.every((k) => !!k && isRomanKey(k))));
  let km: KeyMap;
  if (info) {
    // "Which paragraph contains…": the options ARE the passage's paragraph letters.
    const options = ctx.labels.map((l) => ({ key: l, text: `Paragraph ${l}` }));
    km = {
      options,
      byKey: new Map(ctx.labels.map((l) => [l.toLowerCase(), l])),
      byText: new Map(ctx.labels.map((l) => [normText(`Paragraph ${l}`), l])),
    };
  } else {
    km = rekey(b.rawOptions, headings ? "roman" : "letters");
  }
  const questions = qs.map((q) => {
    const ans = mapKey(q.answer[0] ?? "", km);
    return withExplanation({ n: 0, text: headings ? paragraphRef(q.text) : q.text, answer: ans ? [ans] : [] }, q.explanation);
  });

  const used = questions.map((q) => q.answer[0] ?? "");
  const repeats = new Set(used).size !== used.length;
  const given = toBool(b.raw.allowReuse);
  // Headings may never repeat (a repeat is a real error the validator should catch); other lists may.
  const allowReuse = info ? true : headings ? given === true : given === true || repeats;
  const title = b.title || (headings ? "List of Headings" : "");
  const instructions = b.instructions || defaultInstructions("matching", ctx, { headings });
  const group: ExamGroup = { kind: "matching", instructions, ...(title ? { title } : {}), allowReuse, options: km.options, questions };
  return { group, oldNs: qs.map((q) => q.oldN) };
}

function inferWordLimit(text: string): number | null {
  const t = text.toUpperCase();
  if (/ONE WORD/.test(t)) return 1;
  if (/TWO WORDS/.test(t)) return 2;
  if (/THREE WORDS/.test(t)) return 3;
  const m = /(\d)\s+WORDS/.exec(t);
  return m ? Number(m[1]) : null;
}

/** Use the template when it holds the gaps; otherwise fall back to [[n]] inside each question text. */
function chooseTemplate(template: string, qs: RawQuestion[]): { template: string; keepText: boolean } {
  if (!template) return { template: "", keepText: true };
  const gapsInTemplate = placeholders(template).length + (template.match(/_{3,}/g) ?? []).length;
  if (gapsInTemplate > 0) return { template, keepText: false };
  const textsHaveGaps = qs.some((q) => placeholders(q.text).length > 0 || BLANK_RE.test(q.text));
  if (textsHaveGaps || qs.every((q) => q.text)) return { template: "", keepText: true };
  return { template, keepText: false };
}

function gapGroup(b: GroupBase, qs: RawQuestion[], ctx: GroupContext): NormGroup {
  const cleaned = qs.map((q) => cleanGapAnswers(q.answer));
  let allowNumber = toBool(b.raw.allowNumber) ?? /number/i.test(b.ruleText);
  if (cleaned.some((list) => list.some((a) => /\d/.test(a)))) allowNumber = true;
  let wordLimit = toInt(b.raw.wordLimit ?? b.raw.maxWords ?? b.raw.wordsLimit) ?? inferWordLimit(b.ruleText);
  // "the kiosk" under ONE WORD ONLY: the key is "kiosk" (a student writing the article would be over the limit).
  const stated = wordLimit;
  const answers = cleaned.map((list) =>
    list.map((a) => (stated != null && countLimitedWords(a, allowNumber) > stated ? a.replace(/^(the|a|an)\s+/i, "") : a))
  );
  const need = Math.max(0, ...answers.flatMap((list) => list.flatMap(expandOptional).map((v) => countLimitedWords(v, allowNumber))));
  // Keep the stated limit consistent with the key (IELTS never asks for more than three words).
  if (need <= 3) wordLimit = Math.min(3, Math.max(wordLimit ?? 1, need, 1));
  else wordLimit = wordLimit ?? 3;
  const { template, keepText } = chooseTemplate(b.template, qs);
  const title = b.title || (!template && b.template && !b.template.includes("\n") && b.template.length <= 80 ? b.template : "");
  const questions = qs.map((q, i) =>
    withExplanation(keepText ? { n: 0, text: q.text, answer: answers[i] } : { n: 0, answer: answers[i] }, q.explanation)
  );
  const group: ExamGroup = {
    kind: "gap",
    instructions: b.instructions || defaultInstructions("gap", ctx, { template }),
    ...(title ? { title } : {}),
    wordLimit,
    ...(allowNumber ? { allowNumber: true } : {}),
    ...(template ? { template } : {}),
    questions,
  };
  return { group, oldNs: qs.map((q) => q.oldN) };
}

function gapBoxGroup(b: GroupBase, qs: RawQuestion[]): NormGroup {
  const km = rekey(b.rawOptions, "letters");
  const { template, keepText } = chooseTemplate(b.template, qs);
  const questions = qs.map((q) => {
    const ans = mapKey(cleanGapAnswers(q.answer)[0] ?? "", km);
    const a = ans ? [ans] : [];
    return withExplanation(keepText ? { n: 0, text: q.text, answer: a } : { n: 0, answer: a }, q.explanation);
  });
  const last = km.options[km.options.length - 1]?.key ?? "A";
  const group: ExamGroup = {
    kind: "gap-box",
    instructions: b.instructions || `Complete the summary using the list of words, A–${last}, below.`,
    ...(b.title ? { title: b.title } : {}),
    options: km.options,
    ...(template ? { template } : {}),
    questions,
  };
  return { group, oldNs: qs.map((q) => q.oldN) };
}

const PH_RE = /\[\[(\d+)\]\]/g;

/** After renumbering, point every [[n]] placeholder at the question's new number. */
function rewritePlaceholders(group: ExamGroup, oldNs: (number | null)[], newNs: number[]): void {
  if (group.template) {
    const t = group.template;
    const ph = placeholders(t);
    const olds = oldNs.filter((o): o is number => o != null);
    const byNumber =
      olds.length === newNs.length && new Set(olds).size === olds.length && ph.length === olds.length && ph.every((p) => olds.includes(p));
    if (byNumber) {
      group.template = t.replace(PH_RE, (_m, d: string) => `[[${newNs[olds.indexOf(Number(d))]}]]`);
    } else if (ph.length === newNs.length) {
      let i = 0;
      group.template = t.replace(PH_RE, () => `[[${newNs[i++]}]]`);
    } else if (ph.length === 0 && (t.match(/_{3,}/g) ?? []).length === newNs.length) {
      let i = 0;
      group.template = t.replace(/_{3,}/g, () => `[[${newNs[i++]}]]`);
    }
    return; // anything else is left for the validator to report
  }
  group.questions.forEach((q, i) => {
    const t = q.text ?? "";
    const ph = placeholders(t);
    if (ph.length === 1) q.text = t.replace(PH_RE, `[[${newNs[i]}]]`);
    else if (ph.length === 0) {
      if (BLANK_RE.test(t)) q.text = t.replace(BLANK_RE, `[[${newNs[i]}]]`);
      else if (/…|\.{3}/.test(t)) q.text = t.replace(/…|\.{3}/, `[[${newNs[i]}]]`);
      else q.text = t ? `${t} [[${newNs[i]}]]` : `[[${newNs[i]}]]`;
    }
  });
}

/** Drop a small overshoot (≤ 3 questions) from the end of simple groups so a part hits its exact count. */
function trimExcess(groups: NormGroup[], count: number): void {
  let excess = groups.reduce((n, g) => n + g.group.questions.length, 0) - count;
  if (excess <= 0 || excess > 3) return;
  for (let i = groups.length - 1; i >= 0 && excess > 0; i--) {
    const g = groups[i].group;
    const simple = g.kind === "tfng" || g.kind === "ynng" || g.kind === "mcq" || g.kind === "matching" || (g.kind === "gap" && !g.template);
    while (simple && excess > 0 && g.questions.length > 3) {
      g.questions.pop();
      groups[i].oldNs.pop();
      excess--;
    }
  }
}

/** Number questions from startAt in document order and rewrite gap placeholders to match. */
function renumber(groups: NormGroup[], startAt: number): void {
  let n = startAt;
  for (const ng of groups) {
    const newNs = ng.group.questions.map(() => n++);
    ng.group.questions.forEach((q, i) => {
      q.n = newNs[i];
    });
    if (ng.group.kind === "gap" || ng.group.kind === "gap-box") rewritePlaceholders(ng.group, ng.oldNs, newNs);
  }
}

// ---------------------------------------------------------------------------
// Normalising model output — Reading passages and Listening parts
// ---------------------------------------------------------------------------

export interface PartContext {
  /** 1-based passage / part number. */
  partNo: number;
  startAt: number;
  count: number;
}

const EMBEDDED_LABEL = /^\s*(?:\[([A-Z])\]|\(([A-Z])\)|([A-Z])[.:)]|paragraph\s+([A-Z])[.:)]?)\s+/i;

function readParagraphs(src: Obj): ExamParagraph[] {
  let list: unknown[] = Array.isArray(src.paragraphs) ? src.paragraphs : [];
  const text = typeof src.passage === "string" ? src.passage : typeof src.text === "string" ? src.text : "";
  if (!list.length && text) list = splitParagraphs(text).map((p) => p.text);
  const paras = list
    .map((p, i) => {
      let label = isObj(p) ? oneLine(p.label ?? p.letter ?? p.id).toUpperCase() : "";
      let body = isObj(p) ? oneLine(p.text ?? p.content ?? p.paragraph ?? p.body) : oneLine(p);
      const m = EMBEDDED_LABEL.exec(body);
      const embedded = m ? (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").toUpperCase() : "";
      // Strip "A. " / "[A] " only when it really is this paragraph's label.
      if (embedded && (embedded === label || (!label && embedded === LETTERS[i]))) {
        label = embedded;
        body = body.slice(m![0].length).trim();
      }
      return { label, text: body };
    })
    .filter((p) => p.text);
  const labels = paras.map((p) => p.label);
  const keep = labels.every((l) => /^[A-Z]$/.test(l)) && new Set(labels).size === labels.length;
  return paras.map((p, i) => ({ label: keep ? p.label : LETTERS[i], text: p.text }));
}

export function normalizeReadingPart(raw: unknown, ctx: PartContext): ReadingPart {
  const src = unwrap(raw, ["part", "passage", "readingPart", "reading", "data", "result"], (o) => Array.isArray(o.paragraphs) || Array.isArray(o.groups));
  const paragraphs = readParagraphs(src);
  const labels = paragraphs.map((p) => p.label ?? "").filter(Boolean);
  const rawGroups = Array.isArray(src.groups) ? src.groups : Array.isArray(src.questionGroups) ? src.questionGroups : [];
  const groups = rawGroups
    .map((g) => normalizeGroup(g, { skill: "READING", partNo: ctx.partNo, labels }))
    .filter((g): g is NormGroup => g !== null);
  trimExcess(groups, ctx.count);
  renumber(groups, ctx.startAt);
  const subtitle = oneLine(src.subtitle ?? src.standfirst);
  return {
    id: `passage-${ctx.partNo}`,
    title: oneLine(src.title) || `Reading Passage ${ctx.partNo}`,
    ...(subtitle ? { subtitle } : {}),
    paragraphs,
    groups: groups.map((g) => g.group),
  };
}

const NARRATOR = "Narrator";

function normGender(v: unknown): VoiceGender | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (/^(f|female|woman|w|girl|lady)$/.test(s)) return "female";
  if (/^(m|male|man|boy|gentleman)$/.test(s)) return "male";
  return null;
}

function normAccent(v: unknown): VoiceAccent | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (/brit|^uk$|engl|scot|irish|wales|welsh/.test(s)) return "british";
  if (/americ|^us$|^usa$|canad/.test(s)) return "american";
  if (/austral|^aus$|zealand|^nz$/.test(s)) return "australian";
  return null;
}

/** Gender for a speaker the model forgot to list: title first, then balance the voices. */
function guessGender(name: string, speakers: ListeningSpeaker[]): VoiceGender {
  if (/^(mrs|ms|miss|madam)\b/i.test(name)) return "female";
  if (/^(mr|sir)\b/i.test(name)) return "male";
  const female = speakers.filter((s) => s.gender === "female").length;
  return female <= speakers.length - female ? "female" : "male";
}

function readSpeakers(raw: unknown): ListeningSpeaker[] {
  const out: ListeningSpeaker[] = [];
  for (const s of Array.isArray(raw) ? raw : []) {
    const name = isObj(s) ? oneLine(s.name ?? s.speaker ?? s.role) : oneLine(s);
    if (!name || /^narrator$/i.test(name) || out.some((x) => x.name.toLowerCase() === name.toLowerCase())) continue;
    const gender = (isObj(s) ? normGender(s.gender ?? s.sex) : null) ?? guessGender(name, out);
    const accent = isObj(s) ? normAccent(s.accent) : null;
    out.push({ name, gender, ...(accent ? { accent } : {}) });
  }
  return out;
}

const isNarratorName = (s: string): boolean => /^(narrator|announcer|examiner|voice[- ]?over|recording)$/i.test(s.trim());
const STAGE_DIRECTIONS = /\[[^\]]{0,40}\]|\((?:laughs?|laughing|pause[sd]?|sighs?|coughs?|music[^)]*|sound[^)]*)\)/gi;

function readScript(raw: unknown, speakers: ListeningSpeaker[]): ScriptLine[] {
  const items: unknown[] = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/\n+/) : [];
  const lines: ScriptLine[] = [];
  for (const it of items) {
    let speaker = "";
    let text = "";
    let pause: number | null = null;
    if (typeof it === "string") {
      const m = /^\s*([^:]{1,40}):\s*(.+)$/.exec(it);
      speaker = m ? m[1] : "";
      text = m ? m[2] : it;
    } else if (isObj(it)) {
      speaker = oneLine(it.speaker ?? it.name ?? it.role ?? it.voice);
      text = String(it.text ?? it.line ?? it.content ?? it.words ?? it.utterance ?? "");
      pause = toNum(it.pauseAfter ?? it.pause ?? it.pauseSeconds);
    }
    text = oneLine(text.replace(STAGE_DIRECTIONS, " "));
    const p = pause != null && pause > 0 ? Math.min(30, Math.max(1, Math.round(pause))) : 0;
    if (!text) {
      const prev = lines[lines.length - 1];
      if (p && prev) prev.pauseAfter = Math.max(prev.pauseAfter ?? 0, p);
      continue;
    }
    if (isNarratorName(speaker)) speaker = NARRATOR;
    else {
      const known = speakers.find((s) => s.name.toLowerCase() === speaker.toLowerCase());
      if (known) speaker = known.name;
      else if (!speaker) speaker = lines[lines.length - 1]?.speaker ?? speakers[0]?.name ?? "Speaker";
      if (speaker !== NARRATOR && !speakers.some((s) => s.name === speaker)) speakers.push({ name: speaker, gender: guessGender(speaker, speakers) });
    }
    const pauseAfter = p || (speaker === NARRATOR && /time to look|look at question/i.test(text) ? 20 : 0);
    lines.push({ speaker, text, ...(pauseAfter ? { pauseAfter } : {}) });
  }
  // The player announces the part and its end itself — drop the model's own intro / outro lines.
  const first = lines.findIndex((l) => l.speaker !== NARRATOR);
  const last = lines.length - 1 - [...lines].reverse().findIndex((l) => l.speaker !== NARRATOR);
  return first < 0 ? [] : lines.slice(first, last + 1);
}

const QUESTION_RANGE = /\bquestions?\s+\d+(?:\s*(?:to|and|-|–|—)\s*\d+)?/i;

export function rangePhrase(from: number, to: number): string {
  if (from === to) return `question ${from}`;
  return to === from + 1 ? `questions ${from} and ${to}` : `questions ${from} to ${to}`;
}

/** The k-th mid-part Narrator announcement introduces group k+1: make its numbers match the renumbered groups. */
function rewriteNarratorRanges(script: ScriptLine[], groups: ExamGroup[]): ScriptLine[] {
  let k = 0;
  return script.map((line) => {
    if (line.speaker !== NARRATOR || !QUESTION_RANGE.test(line.text) || groups.length < 2) return line;
    k += 1;
    const g = groups[Math.min(k, groups.length - 1)];
    const ns = g.questions.map((q) => q.n);
    return { ...line, text: line.text.replace(QUESTION_RANGE, rangePhrase(Math.min(...ns), Math.max(...ns))) };
  });
}

export function normalizeListeningPart(raw: unknown, ctx: PartContext & { fallbackContext?: string }): ListeningPart {
  const src = unwrap(raw, ["part", "listeningPart", "listening", "data", "result"], (o) => Array.isArray(o.script) || Array.isArray(o.groups));
  const speakers = readSpeakers(src.speakers);
  const script = readScript(src.script ?? src.transcript ?? src.lines, speakers);
  const rawGroups = Array.isArray(src.groups) ? src.groups : Array.isArray(src.questionGroups) ? src.questionGroups : [];
  const groups = rawGroups
    .map((g) => normalizeGroup(g, { skill: "LISTENING", partNo: ctx.partNo, labels: [] }))
    .filter((g): g is NormGroup => g !== null);
  trimExcess(groups, ctx.count);
  renumber(groups, ctx.startAt);
  const examGroups = groups.map((g) => g.group);
  return {
    id: `part-${ctx.partNo}`,
    title: `Part ${ctx.partNo}`,
    context: oneLine(src.context ?? src.situation ?? src.intro ?? src.description) || ctx.fallbackContext || "",
    speakers,
    script: rewriteNarratorRanges(script, examGroups),
    groups: examGroups,
  };
}

// ---------------------------------------------------------------------------
// Per-part validation (before anything is saved)
// ---------------------------------------------------------------------------

const relabel = (msgs: string[], from: string, to: string): string[] =>
  from === to ? msgs : msgs.map((m) => (m.startsWith(from) ? to + m.slice(from.length) : m));

const partQuestions = (p: { groups: ExamGroup[] }): ExamQuestion[] => p.groups.flatMap((g) => (Array.isArray(g.questions) ? g.questions : []));

/** Validate one generated passage exactly as the full test will be validated, numbered from startAt. */
export function checkReadingPart(part: ReadingPart, ctx: PartContext): ValidationReport {
  const wrapper: ExamReadingTest = {
    format: "exam-v2",
    skill: "READING",
    id: "part-check",
    title: "part check",
    description: "part check",
    difficulty: "Medium",
    timeLimit: 60,
    source: "generated",
    parts: [part],
  };
  const r = validateReadingTest(wrapper, { startAt: ctx.startAt });
  const label = `Passage ${ctx.partNo}`;
  const errors = relabel(r.errors, "Passage 1", label);
  const warnings = relabel(r.warnings, "Passage 1", label);
  const n = partQuestions(part).length;
  if (n !== ctx.count) errors.push(`${label}: needs exactly ${ctx.count} questions (${ctx.startAt}–${ctx.startAt + ctx.count - 1}), got ${n}`);
  const words = part.paragraphs.reduce((s, p) => s + wordCount(p.text), 0);
  if (words < 500) errors.push(`${label}: passage is far too short (${words} words; write 750–950)`);
  if (part.paragraphs.length < 4) errors.push(`${label}: needs at least 4 paragraphs (got ${part.paragraphs.length})`);
  if (part.groups.length < 2) warnings.push(`${label}: only one question type — real passages mix two or three`);
  for (const g of part.groups) {
    if (g.kind === "mcq" && g.questions.some((q) => (q.options?.length ?? 0) !== 4)) warnings.push(`${label}: Reading multiple choice normally has four options (A–D)`);
  }
  const texts = partQuestions(part).map((q) => normText(q.text ?? "")).filter(Boolean);
  if (new Set(texts).size !== texts.length) warnings.push(`${label}: two questions have the same text`);
  return { errors, warnings };
}

const SPEAKERS_RULE: [number, number][] = [
  [2, 2],
  [1, 2],
  [2, 4],
  [1, 1],
];

export function checkListeningPart(part: ListeningPart, ctx: PartContext): ValidationReport {
  const wrapper: ExamListeningTest = {
    format: "exam-v2",
    skill: "LISTENING",
    id: "part-check",
    title: "part check",
    description: "part check",
    difficulty: "Medium",
    source: "generated",
    parts: [part],
  };
  const r = validateListeningTest(wrapper, { startAt: ctx.startAt });
  const label = `Part ${ctx.partNo}`;
  const errors = relabel(r.errors, "Part 1", label);
  const warnings = relabel(r.warnings, "Part 1", label);

  const n = partQuestions(part).length;
  if (n !== ctx.count) errors.push(`${label}: needs exactly ${ctx.count} questions (${ctx.startAt}–${ctx.startAt + ctx.count - 1}), got ${n}`);
  const words = part.script.reduce((s, l) => s + wordCount(l.text), 0);
  if (words < 300) errors.push(`${label}: script is far too short (${words} words; write 600–900)`);
  const [min, max] = SPEAKERS_RULE[ctx.partNo - 1] ?? [1, 4];
  const voices = part.speakers.length;
  if (voices < min) (ctx.partNo === 3 ? errors : warnings).push(`${label}: expected ${min === max ? min : `${min}–${max}`} speakers, got ${voices}`);
  else if (voices > max) warnings.push(`${label}: expected ${min === max ? min : `${min}–${max}`} speakers, got ${voices}`);
  if (part.context && !/^you will hear\b/i.test(part.context)) warnings.push(`${label}: context usually starts "You will hear …"`);
  for (const g of part.groups) {
    if (g.kind === "mcq" && g.questions.some((q) => (q.options?.length ?? 0) !== 3)) warnings.push(`${label}: Listening multiple choice normally has three options (A–C)`);
    if (ctx.partNo === 4 && g.kind === "gap" && (g.wordLimit ?? 1) > 1) warnings.push(`${label}: Part 4 notes are usually ONE WORD ONLY`);
  }
  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Speaking
// ---------------------------------------------------------------------------

export function normalizeSpeakingSet(raw: unknown, ctx: { id: string; topic: string }): SpeakingExamSet {
  const src = unwrap(raw, ["set", "test", "speaking", "speakingTest", "data", "result"], (o) => "part1" in o || "part2" in o);
  const p1raw = Array.isArray(src.part1) ? src.part1 : isObj(src.part1) && Array.isArray(src.part1.topics) ? src.part1.topics : [];
  const part1 = p1raw
    .map((t) => ({
      topic: isObj(t) ? oneLine(t.topic ?? t.name ?? t.title) : "",
      questions: isObj(t) ? strList(t.questions).slice(0, 5) : [],
    }))
    .filter((t) => t.topic || t.questions.length)
    .slice(0, 3);
  const p2 = isObj(src.part2) ? src.part2 : {};
  const points = strList(p2.points ?? p2.bullets ?? p2.youShouldSay).filter((p) => !/^you should say:?$/i.test(p));
  let closing = oneLine(p2.closing ?? p2.explain ?? p2.finalPoint);
  if (!closing && points.length && /^and\b/i.test(points[points.length - 1])) closing = points.pop() ?? "";
  if (closing && /^explain\b/i.test(closing)) closing = `and ${closing}`;
  if (closing && !/[.?!]$/.test(closing)) closing += ".";
  let cue = oneLine(p2.cue ?? p2.topic ?? p2.task).replace(/\s*you should say:?\s*$/i, "");
  if (cue && !/[.?!]$/.test(cue)) cue += ".";
  const followUp = oneLine(p2.followUp ?? p2.followUpQuestion ?? p2.roundingOff);
  const p3 = isObj(src.part3) ? src.part3 : {};
  const part3 = { theme: oneLine(p3.theme ?? p3.topic) || parseTopic(ctx.topic).base, questions: strList(p3.questions).slice(0, 6) };
  const title = oneLine(src.title) || cue.replace(/^describe\s+/i, "").replace(/[.?!]$/, "") || parseTopic(ctx.topic).base;
  return {
    format: "exam-v2",
    skill: "SPEAKING",
    id: ctx.id,
    title: title.charAt(0).toUpperCase() + title.slice(1),
    source: "generated",
    part1,
    part2: { cue, points: points.slice(0, 4), closing, ...(followUp ? { followUp } : {}) },
    part3,
  };
}

/** validateSpeakingSet plus the stricter exam shape the generator promises (2–3 × 3–5, 3–4 points, 4–6). */
export function checkSpeakingSet(data: unknown): ValidationReport {
  const report = validateSpeakingSet(data);
  if (!isObj(data)) return report;
  const s = data as unknown as SpeakingExamSet;
  const { errors, warnings } = report;
  if (Array.isArray(s.part1)) {
    if (s.part1.length < 2) errors.push("Part 1 needs 2–3 topics");
    s.part1.forEach((t, i) => {
      const n = Array.isArray(t?.questions) ? t.questions.length : 0;
      if (n < 3 || n > 5) errors.push(`Part 1 topic ${i + 1} needs 3–5 questions (got ${n})`);
    });
  }
  if (isObj(s.part3) && Array.isArray(s.part3.questions) && s.part3.questions.length > 6) errors.push("Part 3 needs 4–6 questions");
  if (isObj(s.part2) && typeof s.part2.cue === "string" && /you should say/i.test(s.part2.cue)) warnings.push('Part 2 cue should not contain "You should say"');
  return report;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export const TASK1_SUMMARISE = "Summarise the information by selecting and reporting the main features, and make comparisons where relevant.";
export const TASK1_WORDS = "Write at least 150 words.";
export const TASK2_REASONS = "Give reasons for your answer and include any relevant examples from your own knowledge or experience.";
export const TASK2_WORDS = "Write at least 250 words.";

/** Remove stock IELTS sentences (we re-add the canonical wording ourselves). */
function stripStock(text: string, phrases: string[]): string {
  let t = text;
  for (const p of phrases) {
    const re = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/,/g, ",?").replace(/\s+/g, "\\s+").replace(/\\\.$/, "\\.?"), "gi");
    t = t.replace(re, "");
  }
  return multiLine(t);
}

/** Paragraphs separated by one blank line (single line breaks become paragraph breaks). */
function paragraphs(v: unknown): string {
  const t = multiLine(v);
  return (/\n\n/.test(t) ? t : t.replace(/\n/g, "\n\n")).replace(/\n{3,}/g, "\n\n");
}

/** Uzbek Latin apostrophes as in the seed content: oʻ gʻ (U+02BB) and the tutuq belgisi ʼ (U+02BC). */
export function uzLatin(s: string): string {
  return s.replace(/([OoGg])['‘’`ʼ](?=\p{L})/gu, "$1ʻ").replace(/(\p{L})['’`](?=\p{L})/gu, "$1ʼ");
}

function readSeries(v: unknown): { name: string; values: number[] }[] {
  return (Array.isArray(v) ? v : []).filter(isObj).map((s) => ({
    name: oneLine(s.name ?? s.label ?? s.series),
    // Unreadable values are dropped, so a broken series fails the length check instead of being guessed.
    values: (Array.isArray(s.values) ? s.values : Array.isArray(s.data) ? s.data : []).map(toNum).filter((x): x is number => x !== null),
  }));
}

function readChart(c: unknown): Task1ChartData | null {
  if (!isObj(c)) return null;
  const k = String(c.kind ?? c.type ?? c.chartType ?? "").toLowerCase();
  const kind = /pie|donut|doughnut/.test(k)
    ? "pie"
    : /line/.test(k)
      ? "line"
      : /bar|column/.test(k)
        ? "bar"
        : Array.isArray(c.slices)
          ? "pie"
          : Array.isArray(c.xLabels)
            ? "line"
            : Array.isArray(c.groups)
              ? "bar"
              : "";
  const unit = oneLine(c.unit ?? c.units);
  const u = unit ? { unit } : {};
  if (kind === "pie") {
    const title = oneLine(c.title ?? c.label ?? c.name);
    const slices = (Array.isArray(c.slices) ? c.slices : Array.isArray(c.data) ? c.data : [])
      .filter(isObj)
      .map((s) => ({ label: oneLine(s.label ?? s.name ?? s.category), value: toNum(s.value ?? s.percent ?? s.share) }))
      .filter((s): s is { label: string; value: number } => !!s.label && s.value !== null);
    return { kind: "pie", ...u, ...(title ? { title } : {}), slices };
  }
  if (kind === "line") {
    return { kind: "line", ...u, xLabels: strList(c.xLabels ?? c.labels ?? c.x ?? c.years ?? c.groups), series: readSeries(c.series) };
  }
  if (kind === "bar") {
    return { kind: "bar", ...u, groups: strList(c.groups ?? c.categories ?? c.labels ?? c.xLabels), series: readSeries(c.series) };
  }
  return null;
}

const CHART_NAME: Record<Task1ChartData["kind"], string> = { bar: "Bar chart", line: "Line graph", pie: "Pie chart" };

/** "Bar chart", "Line graph", "Pie charts", "Pie chart and bar chart" … (the seed labels). */
function chartTypeLabel(chart: Task1ChartData[]): string {
  const kinds = chart.map((c) => c.kind);
  if (!kinds.length) return "";
  if (kinds.every((k) => k === kinds[0])) return CHART_NAME[kinds[0]] + (kinds.length > 1 ? "s" : "");
  const names = unique(kinds).map((k) => CHART_NAME[k].toLowerCase());
  const label = names.join(" and ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface WritingContext {
  id: string;
  topic: string;
}

function writingSource(raw: unknown): Obj {
  return unwrap(raw, ["task", "task1", "task2", "writingTask", "writing", "data", "result"], (o) => "prompt" in o || "sampleAnswer" in o);
}

function writingCommon(src: Obj) {
  return {
    sampleAnswer: paragraphs(src.sampleAnswer ?? src.modelAnswer ?? src.sample ?? src.answer),
    usefulPhrases: unique(strList(src.usefulPhrases ?? src.phrases)).slice(0, 10),
    strategyEn: oneLine(src.strategyEn ?? src.strategy ?? src.tip),
    strategyUz: uzLatin(oneLine(src.strategyUz ?? src.strategyUzbek ?? src.tipUz)),
  };
}

export function normalizeTask1(raw: unknown, ctx: WritingContext): WritingPrompt {
  const src = writingSource(raw);
  const rawChart = src.chart ?? src.charts ?? src.chartData;
  const chart = (Array.isArray(rawChart) ? rawChart : [rawChart]).map(readChart).filter((c): c is Task1ChartData => c !== null);
  const type = chartTypeLabel(chart) || oneLine(src.type) || "Chart";
  const intro = stripStock(multiLine(src.prompt ?? src.question ?? src.task), [
    "You should spend about 20 minutes on this task.",
    TASK1_SUMMARISE,
    TASK1_WORDS,
  ]);
  const title = oneLine(src.title) || `${type}: ${parseTopic(ctx.topic).base.replace(/^[^:]*:\s*/, "")}`;
  return {
    id: ctx.id,
    title,
    prompt: [intro, TASK1_SUMMARISE, TASK1_WORDS].filter(Boolean).join("\n\n"),
    type,
    chart,
    ...writingCommon(src),
  };
}

export function normalizeTask2(raw: unknown, ctx: WritingContext & { type: string }): WritingPrompt {
  const src = writingSource(raw);
  const intro = stripStock(multiLine(src.prompt ?? src.question ?? src.task), [
    "You should spend about 40 minutes on this task.",
    "Write about the following topic:",
    TASK2_REASONS,
    TASK2_WORDS,
  ]);
  return {
    id: ctx.id,
    title: oneLine(src.title) || parseTopic(ctx.topic).base,
    prompt: [intro, TASK2_REASONS, TASK2_WORDS].filter(Boolean).join("\n\n"),
    type: ctx.type || oneLine(src.type) || "Opinion",
    ...writingCommon(src),
  };
}

type SafeParser = { safeParse(v: unknown): { success: boolean; error?: { issues?: { path: (string | number)[]; message: string }[] } } };

/** Run the real zod schema the catalog uses (lib/test-schema) and report its issues. */
function schemaErrors(schema: SafeParser, data: unknown, label: string): string[] {
  const r = schema.safeParse(data);
  if (r.success) return [];
  const issues = r.error?.issues ?? [];
  if (!issues.length) return [`${label}: does not match the schema`];
  return issues.slice(0, 5).map((i) => `${label}: ${i.path.join(".") || "(root)"} — ${i.message}`);
}

function checkWritingCommon(w: Obj, task: 1 | 2, report: ValidationReport): void {
  const { errors, warnings } = report;
  const str = (k: string) => (typeof w[k] === "string" ? (w[k] as string) : "");
  if (!str("id") || str("title").length < 2 || !str("type")) errors.push("missing id, title or type");
  const words = wordCount(str("sampleAnswer"));
  const [minE, maxE, minW, maxW] = task === 1 ? [150, 300, 170, 220] : [250, 400, 270, 320];
  if (words < minE || words > maxE) errors.push(`model answer has ${words} words (needs ${minW}–${maxW})`);
  else if (words < minW || words > maxW) warnings.push(`model answer has ${words} words (target ${minW}–${maxW})`);
  if (str("sampleAnswer").split(/\n\s*\n/).filter((p) => p.trim()).length < 3) warnings.push("model answer should be in 4–5 paragraphs");
  const phrases = Array.isArray(w.usefulPhrases) ? w.usefulPhrases.filter((p) => typeof p === "string" && p.trim()) : [];
  if (phrases.length < 4) errors.push(`needs 6–8 useful phrases (got ${phrases.length})`);
  else if (phrases.length < 6) warnings.push(`only ${phrases.length} useful phrases (target 6–8)`);
  if (!str("strategyEn").trim()) errors.push("missing strategyEn");
  const uz = str("strategyUz");
  if (!uz.trim()) errors.push("missing strategyUz");
  else if (/[\u0400-\u04FF]/.test(uz)) errors.push("strategyUz must be Uzbek in Latin script (Cyrillic found)");
  else if (!/[oOgG]ʻ|sh|ch|ning\b|lar\b/.test(uz)) warnings.push("strategyUz does not look like Uzbek");
  const prompt = str("prompt");
  const [stock, need] = task === 1 ? [TASK1_SUMMARISE, TASK1_WORDS] : [TASK2_REASONS, TASK2_WORDS];
  const intro = prompt.split(stock)[0]?.trim() ?? "";
  if (!prompt.includes(stock) || !prompt.includes(need)) errors.push("prompt is missing the standard IELTS task wording");
  if (intro.length < (task === 1 ? 40 : 60)) errors.push("prompt needs a proper task statement before the standard wording");
  if (task === 2 && !intro.includes("?") && !/discuss both/i.test(intro)) warnings.push("the Task 2 question should end with the essay-type question");
}

function checkChart(c: unknown, i: number, errors: string[], warnings: string[]): number[] {
  const at = `chart ${i + 1}`;
  if (!isObj(c)) {
    errors.push(`${at}: not an object`);
    return [];
  }
  const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  if (c.kind === "pie") {
    const slices = Array.isArray(c.slices) ? c.slices.filter(isObj) : [];
    if (slices.length < 3) errors.push(`${at}: a pie chart needs at least 3 slices`);
    if (slices.length > 8) warnings.push(`${at}: ${slices.length} slices is a lot for one pie chart`);
    if (!slices.every((s) => typeof s.label === "string" && s.label.trim() && finite(s.value) && s.value >= 0)) errors.push(`${at}: every slice needs a label and a value ≥ 0`);
    const sum = slices.reduce((n, s) => n + (finite(s.value) ? s.value : 0), 0);
    if (typeof c.unit === "string" && c.unit.includes("%") && Math.abs(sum - 100) > 1.5) errors.push(`${at}: percentages add up to ${sum}, not 100`);
    return slices.map((s) => (finite(s.value) ? s.value : NaN));
  }
  if (c.kind !== "bar" && c.kind !== "line") {
    errors.push(`${at}: kind must be "bar", "line" or "pie"`);
    return [];
  }
  const labels = Array.isArray(c.kind === "bar" ? c.groups : c.xLabels) ? ((c.kind === "bar" ? c.groups : c.xLabels) as unknown[]) : [];
  const series = Array.isArray(c.series) ? c.series.filter(isObj) : [];
  if (labels.length < 2) errors.push(`${at}: needs at least 2 ${c.kind === "bar" ? "groups" : "xLabels"}`);
  if (!series.length) errors.push(`${at}: needs at least one series`);
  if (series.length > 5) warnings.push(`${at}: ${series.length} series is hard to read`);
  const values: number[] = [];
  series.forEach((s, j) => {
    const vs = Array.isArray(s.values) ? s.values : [];
    if (typeof s.name !== "string" || !s.name.trim()) errors.push(`${at} series ${j + 1}: missing name`);
    if (vs.length !== labels.length) errors.push(`${at} series ${j + 1}: ${vs.length} values for ${labels.length} labels`);
    if (!vs.every(finite)) errors.push(`${at} series ${j + 1}: values must be numbers`);
    values.push(...vs.filter(finite));
  });
  return values;
}

export function checkTask1(data: unknown): ValidationReport {
  const report: ValidationReport = { errors: [], warnings: [] };
  if (!isObj(data)) return { errors: ["task is not an object"], warnings: [] };
  checkWritingCommon(data, 1, report);
  const charts = Array.isArray(data.chart) ? data.chart : [];
  if (!charts.length) report.errors.push("Task 1 needs chart data");
  if (charts.length > 2) report.warnings.push("more than two charts");
  const values = charts.flatMap((c, i) => checkChart(c, i, report.errors, report.warnings)).filter((v) => Number.isFinite(v));
  // The model answer should quote the chart's own figures.
  const sample = typeof data.sampleAnswer === "string" ? data.sampleAnswer.replace(/(\d),(?=\d{3})/g, "$1") : "";
  const quoted = new Set((sample.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number));
  const matches = unique(values).filter((v) => quoted.has(v) || quoted.has(v / 1000) || quoted.has(v * 1000)).length;
  if (values.length && matches < 3) report.warnings.push(`the model answer quotes only ${matches} figure(s) from the chart`);
  report.errors.push(...schemaErrors(writingTask1Schema, data, "Task 1 schema"));
  return report;
}

export function checkTask2(data: unknown): ValidationReport {
  const report: ValidationReport = { errors: [], warnings: [] };
  if (!isObj(data)) return { errors: ["task is not an object"], warnings: [] };
  checkWritingCommon(data, 2, report);
  if ("chart" in data) report.warnings.push("Task 2 should not carry chart data");
  report.errors.push(...schemaErrors(writingPromptSchema, data, "Task 2 schema"));
  return report;
}

// ---------------------------------------------------------------------------
// Assembly (final step)
// ---------------------------------------------------------------------------

const listJoin = (items: string[]): string =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
const lowerFirst = (s: string): string => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/**
 * The three passage subjects of one Reading test. As in the real exam the
 * passages are on UNRELATED subjects: the draft's own topic for Passage 1,
 * then two companions from other subject areas, chosen deterministically from
 * the topic label (so a retried step always gets the same brief). Unknown
 * topics (not in the bank) fall back to one subject for all three passages.
 */
export function readingThemes(topic: string): [ReadingThemeBrief | null, ReadingThemeBrief | null, ReadingThemeBrief | null] {
  const lead = findReadingTopic(topic) ?? null;
  if (!lead) return [null, null, null];
  const h = hash(`${topic}::passages`);
  const second = READING_TOPICS.filter((t) => t.area !== lead.area);
  const b = second.length ? second[h % second.length] : null;
  const third = READING_TOPICS.filter((t) => t.area !== lead.area && t.area !== b?.area);
  const c = third.length ? third[Math.floor(h / 7919) % third.length] : null;
  return [lead, b, c];
}
type ReadingThemeBrief = (typeof READING_TOPICS)[number];

export function assembleReadingTest(id: string, draft: DraftData, parts: ReadingPart[]): ExamReadingTest {
  const { base } = parseTopic(draft.topic);
  const themes = readingThemes(draft.topic);
  const titles = parts.map((p) => `“${p.title}”`);
  const areas = themes.map((t) => t?.area).filter((t): t is string => !!t);
  const subjects = themes.slice(1).map((t) => t?.topic.toLowerCase()).filter((t): t is string => !!t);
  return {
    format: "exam-v2",
    skill: "READING",
    id,
    title: draft.title,
    description: themes[0]
      ? `A full Academic Reading test — three passages on different subjects: ${listJoin(titles)}. 40 questions.`
      : `A full Academic Reading test on ${lowerFirst(base)}: ${listJoin(titles)}. 3 passages, 40 questions.`,
    difficulty: draft.difficulty,
    timeLimit: 60,
    topics: unique([...areas, base.toLowerCase(), ...subjects]),
    source: "generated",
    parts: parts.map((p, i) => ({ ...p, id: `passage-${i + 1}` })),
  };
}

/** "You will hear part of a lecture on colour." → "a lecture on colour". */
const scene = (context: string): string =>
  context.replace(/^you will hear\s+(part of\s+)?/i, "").replace(/[.\s]+$/, "").trim();

export function assembleListeningTest(id: string, draft: DraftData, parts: ListeningPart[]): ExamListeningTest {
  const { base } = parseTopic(draft.topic);
  const scenes = parts.map((p, i) => `Part ${i + 1}: ${scene(p.context) || p.title}`);
  return {
    format: "exam-v2",
    skill: "LISTENING",
    id,
    title: draft.title,
    description: `A full Listening test (4 parts, 40 questions). ${scenes.join("; ")}.`,
    difficulty: draft.difficulty,
    topics: [base.toLowerCase()],
    source: "generated",
    parts: parts.map((p, i) => ({ ...p, id: `part-${i + 1}`, title: `Part ${i + 1}` })),
  };
}

// ---------------------------------------------------------------------------
// One generation step
// ---------------------------------------------------------------------------

export type StepOutcome =
  | { ok: true; final: false; part: GenPart; warnings: string[] }
  | { ok: true; final: true; data: FinalData; description: string; warnings: string[] }
  | { ok: false; error: string; errors: string[] };

/** "first error; second error; third error (+4 more)" — short enough for lastError. */
export function summarizeErrors(errors: string[], max = 3): string {
  const head = errors.slice(0, max).join("; ");
  const more = errors.length > max ? ` (+${errors.length - max} more)` : "";
  const s = `${head}${more}`;
  return s.length > 500 ? `${s.slice(0, 497)}…` : s;
}

const invalid = (errors: string[]): StepOutcome => ({ ok: false, error: `Invalid output: ${summarizeErrors(errors)}`, errors });

function finishReading(id: string, draft: DraftData, parts: ReadingPart[], warnings: string[]): StepOutcome {
  const test = assembleReadingTest(id, draft, parts);
  const full = validateReadingTest(test, { requireFull: true });
  if (full.errors.length) return invalid(full.errors.map((e) => `assembled test: ${e}`));
  return { ok: true, final: true, data: test, description: test.description, warnings: [...warnings, ...full.warnings] };
}

function finishListening(id: string, draft: DraftData, parts: ListeningPart[], warnings: string[]): StepOutcome {
  const test = assembleListeningTest(id, draft, parts);
  const full = validateListeningTest(test, { requireFull: true });
  if (full.errors.length) return invalid(full.errors.map((e) => `assembled test: ${e}`));
  return { ok: true, final: true, data: test, description: test.description, warnings: [...warnings, ...full.warnings] };
}

/**
 * Normalise + validate the model's JSON for the draft's next step. Pure and
 * synchronous (offline checks feed seed parts through it as fake model output).
 */
export function processModelOutput(id: string, draft: DraftData, raw: unknown): StepOutcome {
  const step = draft.parts.length;
  switch (draft.skill) {
    case "READING": {
      const range = READING_RANGES[step];
      const done = draft.parts as ReadingPart[];
      if (!range) return finishReading(id, draft, done, []);
      const ctx = { partNo: step + 1, ...range };
      const part = normalizeReadingPart(raw, ctx);
      const report = checkReadingPart(part, ctx);
      if (report.errors.length) return invalid(report.errors);
      if (step + 1 < READING_RANGES.length) return { ok: true, final: false, part, warnings: report.warnings };
      return finishReading(id, draft, [...done, part], report.warnings);
    }
    case "LISTENING": {
      const range = LISTENING_RANGES[step];
      const done = draft.parts as ListeningPart[];
      if (!range) return finishListening(id, draft, done, []);
      const ctx = { partNo: step + 1, ...range };
      const situation = findListeningSet(draft.topic)?.parts[step];
      const part = normalizeListeningPart(raw, { ...ctx, fallbackContext: situation ? `You will hear ${situation}.` : undefined });
      const report = checkListeningPart(part, ctx);
      if (report.errors.length) return invalid(report.errors);
      if (step + 1 < LISTENING_RANGES.length) return { ok: true, final: false, part, warnings: report.warnings };
      return finishListening(id, draft, [...done, part], report.warnings);
    }
    case "WRITING_TASK1": {
      const task = normalizeTask1(raw, { id, topic: draft.topic });
      const report = checkTask1(task);
      if (report.errors.length) return invalid(report.errors);
      return { ok: true, final: true, data: task, description: task.type, warnings: report.warnings };
    }
    case "WRITING_TASK2": {
      const type = findTask2Topic(draft.topic)?.type ?? "";
      const task = normalizeTask2(raw, { id, topic: draft.topic, type });
      const report = checkTask2(task);
      if (report.errors.length) return invalid(report.errors);
      return { ok: true, final: true, data: task, description: task.type, warnings: report.warnings };
    }
    case "SPEAKING": {
      const set = normalizeSpeakingSet(raw, { id, topic: draft.topic });
      const report = checkSpeakingSet(set);
      if (report.errors.length) return invalid(report.errors);
      return { ok: true, final: true, data: set, description: `Part 2: ${set.part2.cue}`, warnings: report.warnings };
    }
  }
}

export interface ModelRequest {
  system: string;
  user: string;
  maxTokens: number;
  /** For logs: "Reading passage 2" … */
  label: string;
}

export type Completer = (req: ModelRequest) => Promise<string>;

/**
 * Generate the draft's next missing step: build the prompt, call the model
 * (via `complete`), then normalise and validate. Model/transport errors are
 * thrown as ExamGenError; invalid output comes back as { ok: false }.
 */
export async function generateStep(input: { id: string; draft: DraftData; complete: Completer }): Promise<StepOutcome> {
  const { id, draft } = input;
  if (draft.parts.length >= STEPS_FOR[draft.skill]) return processModelOutput(id, draft, null); // parts complete: assemble only
  const text = await input.complete(buildStepPrompt(draft));
  try {
    return processModelOutput(id, draft, parseModelJson(text));
  } catch (e) {
    // Unusable output (or output we could not process) counts as one failed attempt.
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: e instanceof ExamGenError ? message : `Could not process the model output: ${message}`, errors: [] };
  }
}

/** New `data` for the row after a step (success, final, or one more failure). */
export function applyOutcome(draft: DraftData, outcome: StepOutcome): { data: DraftData | FinalData; final: boolean; description?: string } {
  if (outcome.ok && outcome.final) return { data: outcome.data, final: true, description: outcome.description };
  const base = cleanDraft(draft);
  if (outcome.ok) {
    const warnings = [...base.warnings, ...outcome.warnings].slice(0, 60);
    return { data: cleanDraft({ ...base, parts: [...base.parts, outcome.part], failures: 0, lastError: undefined, status: undefined, warnings }), final: false };
  }
  const failures = base.failures + 1;
  return {
    data: cleanDraft({ ...base, failures, lastError: outcome.error, ...(failures >= MAX_FAILURES ? { status: "failed" as const } : {}) }),
    final: false,
  };
}

/** Release the lock without counting a failure (rate limits, configuration or upstream outages). */
export function releaseDraft(draft: DraftData, lastError?: string): DraftData {
  return cleanDraft({ ...draft, ...(lastError ? { lastError } : {}) });
}

export function parseModelJson(text: string): unknown {
  let t = String(text ?? "").trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  if (fence) t = fence[1];
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(t.slice(a, b + 1));
      } catch {
        /* fall through */
      }
    }
    throw new ExamGenError("invalid", "The model returned invalid JSON.");
  }
}

// ---------------------------------------------------------------------------
// The model call
// ---------------------------------------------------------------------------

/**
 * config     — bad key / unknown model / rejected request: fix the setup (not the draft's fault)
 * rate_limit — OpenAI 429 or quota: retry later
 * upstream   — OpenAI 5xx / network: transient
 * timeout    — no answer within the budget (counts as a failed attempt)
 * invalid    — unusable output: empty, truncated or not JSON (counts as a failed attempt)
 */
export type ExamGenErrorKind = "config" | "rate_limit" | "upstream" | "timeout" | "invalid";

export class ExamGenError extends Error {
  readonly kind: ExamGenErrorKind;
  readonly retryAfterSec?: number;
  constructor(kind: ExamGenErrorKind, message: string, retryAfterSec?: number) {
    super(message);
    this.name = "ExamGenError";
    this.kind = kind;
    if (retryAfterSec != null) this.retryAfterSec = retryAfterSec;
  }
}

/** Only failures that say something about THIS draft's generation count toward MAX_FAILURES. */
export const countsAsFailure = (kind: ExamGenErrorKind): boolean => kind === "timeout" || kind === "invalid";

export const examModel = (): string => process.env.OPENAI_EXAM_MODEL || "gpt-4o";

interface ChatCompletionLike {
  choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
}
interface ChatClient {
  chat: { completions: { create(body: Record<string, unknown>, options?: Record<string, unknown>): Promise<ChatCompletionLike> } };
}

let client: ChatClient | null = null;

/** Lazily created OpenAI client (the SDK is only loaded when a step actually runs). */
async function getClient(): Promise<ChatClient> {
  if (client) return client;
  const mod = (await import("openai")) as { default?: unknown };
  const OpenAI = (mod.default ?? mod) as new (opts: Record<string, unknown>) => ChatClient;
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: MODEL_TIMEOUT_MS });
  return client;
}

function classifyModelError(e: unknown): ExamGenError {
  const err = (isObj(e) || e instanceof Error ? e : {}) as { status?: unknown; code?: unknown; name?: unknown; message?: unknown; error?: { code?: unknown } };
  const status = typeof err.status === "number" ? err.status : undefined;
  const code = String(err.code ?? err.error?.code ?? "");
  const name = String(err.name ?? "");
  const message = String(err.message ?? "The model call failed.").slice(0, 300);
  if (/abort|timeout/i.test(name) || /timed? ?out/i.test(message)) return new ExamGenError("timeout", "The model did not answer in time.");
  if (status === 401 || status === 403) return new ExamGenError("config", `OpenAI rejected the API key (${status}). Check OPENAI_API_KEY.`);
  if (status === 404) return new ExamGenError("config", `OpenAI model "${examModel()}" is not available (404). Check OPENAI_EXAM_MODEL.`);
  if (status === 400 || status === 422) return new ExamGenError("config", `OpenAI rejected the request (${status}): ${message}`);
  if (status === 429) {
    const quota = code === "insufficient_quota" || /quota/i.test(message);
    return quota
      ? new ExamGenError("rate_limit", "The OpenAI account has run out of quota — check billing.", 3600)
      : new ExamGenError("rate_limit", "OpenAI is rate-limiting requests — try again in a minute.", 60);
  }
  return new ExamGenError("upstream", `OpenAI error${status ? ` ${status}` : ""}: ${message}`);
}

/**
 * One chat completion in JSON mode, aborted after `timeoutMs` (≤ MODEL_TIMEOUT_MS)
 * so a /step request always ends inside its 60 s budget. No SDK retries.
 */
export async function callExamModel(req: ModelRequest, timeoutMs: number = MODEL_TIMEOUT_MS): Promise<string> {
  if (!process.env.OPENAI_API_KEY) throw new ExamGenError("config", "OpenAI is not configured (OPENAI_API_KEY).");
  const ms = Math.max(5_000, Math.min(timeoutMs, MODEL_TIMEOUT_MS));
  const ai = await getClient();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Abort the HTTP request AND stop waiting, even if the SDK ignored the signal.
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ExamGenError("timeout", `The model did not answer within ${Math.round(ms / 1000)} s (${req.label}).`));
    }, ms);
  });
  try {
    const call = ai.chat.completions.create(
      {
        model: examModel(),
        temperature: 0.7,
        max_tokens: req.maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
      },
      { signal: controller.signal, timeout: ms, maxRetries: 0 }
    );
    call.catch(() => undefined); // the loser of the race must not become an unhandled rejection
    const res = await Promise.race([call, deadline]);
    const choice = res.choices?.[0];
    if (choice?.finish_reason === "length") throw new ExamGenError("invalid", `The model hit the ${req.maxTokens}-token limit before finishing (${req.label}).`);
    const content = choice?.message?.content ?? "";
    if (!content.trim()) throw new ExamGenError("invalid", "The model returned an empty response.");
    return content;
  } catch (e) {
    if (e instanceof ExamGenError) throw e;
    if (controller.signal.aborted) throw new ExamGenError("timeout", `The model did not answer within ${Math.round(ms / 1000)} s (${req.label}).`);
    throw classifyModelError(e);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

type GroupStyle = "headings" | "information" | "features" | "endings" | "notes" | "summary" | "sentences" | "table" | "flow-chart" | "form";
interface PlanItem {
  kind: GroupKind;
  style?: GroupStyle;
  count: number;
  wordLimit?: number;
  allowNumber?: boolean;
}
interface Plan {
  /** Exact paragraph count (matching headings for every paragraph). */
  paragraphs?: number;
  items: PlanItem[];
}

/** Question-type plans per passage — rotated per draft so the library mixes all IELTS task types. */
const READING_PLANS: Plan[][] = [
  [
    { paragraphs: 7, items: [{ kind: "matching", style: "headings", count: 7 }, { kind: "tfng", count: 6 }] },
    { items: [{ kind: "tfng", count: 7 }, { kind: "gap", style: "notes", count: 6, wordLimit: 2 }] },
    { items: [{ kind: "matching", style: "information", count: 4 }, { kind: "tfng", count: 5 }, { kind: "gap", style: "sentences", count: 4, wordLimit: 1 }] },
    { items: [{ kind: "gap", style: "table", count: 6, wordLimit: 2, allowNumber: true }, { kind: "tfng", count: 7 }] },
  ],
  [
    { items: [{ kind: "matching", style: "features", count: 5 }, { kind: "gap", style: "summary", count: 6, wordLimit: 2 }, { kind: "mcq-multi", count: 2 }] },
    { paragraphs: 6, items: [{ kind: "matching", style: "headings", count: 6 }, { kind: "mcq", count: 4 }, { kind: "gap", style: "sentences", count: 3, wordLimit: 2 }] },
    { items: [{ kind: "matching", style: "information", count: 5 }, { kind: "gap", style: "flow-chart", count: 4, wordLimit: 2 }, { kind: "tfng", count: 4 }] },
    { items: [{ kind: "mcq", count: 4 }, { kind: "gap-box", count: 5 }, { kind: "matching", style: "features", count: 4 }] },
  ],
  [
    { items: [{ kind: "mcq", count: 5 }, { kind: "ynng", count: 5 }, { kind: "gap-box", count: 4 }] },
    { items: [{ kind: "ynng", count: 6 }, { kind: "matching", style: "endings", count: 4 }, { kind: "mcq", count: 4 }] },
    { items: [{ kind: "mcq", count: 4 }, { kind: "gap", style: "summary", count: 5, wordLimit: 2 }, { kind: "ynng", count: 5 }] },
    { items: [{ kind: "matching", style: "features", count: 5 }, { kind: "ynng", count: 5 }, { kind: "mcq", count: 4 }] },
  ],
];

const LISTENING_PLANS: Plan[][] = [
  [
    { items: [{ kind: "gap", style: "form", count: 10, wordLimit: 1, allowNumber: true }] },
    { items: [{ kind: "gap", style: "form", count: 6, wordLimit: 1, allowNumber: true }, { kind: "gap", style: "table", count: 4, wordLimit: 2, allowNumber: true }] },
    { items: [{ kind: "gap", style: "notes", count: 7, wordLimit: 1, allowNumber: true }, { kind: "mcq", count: 3 }] },
  ],
  [
    { items: [{ kind: "mcq", count: 5 }, { kind: "matching", count: 5 }] },
    { items: [{ kind: "mcq-multi", count: 2 }, { kind: "mcq-multi", count: 2 }, { kind: "matching", count: 6 }] },
    { items: [{ kind: "gap", style: "notes", count: 6, wordLimit: 2 }, { kind: "mcq", count: 4 }] },
  ],
  [
    { items: [{ kind: "mcq", count: 5 }, { kind: "matching", count: 5 }] },
    { items: [{ kind: "mcq-multi", count: 2 }, { kind: "mcq", count: 4 }, { kind: "matching", count: 4 }] },
    { items: [{ kind: "mcq", count: 6 }, { kind: "gap", style: "flow-chart", count: 4, wordLimit: 2 }] },
  ],
  [{ items: [{ kind: "gap", style: "notes", count: 10, wordLimit: 1 }] }, { items: [{ kind: "mcq", count: 3 }, { kind: "gap", style: "notes", count: 7, wordLimit: 1 }] }],
];

const pickPlan = (plans: Plan[], key: string): Plan => plans[hash(key) % plans.length];

export function wordRule(limit: number, allowNumber?: boolean): string {
  const w = NUMBER_WORD[limit] ?? String(limit);
  const base = limit === 1 ? "ONE WORD ONLY" : `NO MORE THAN ${w} WORDS`;
  if (!allowNumber) return base;
  return limit === 1 ? "ONE WORD AND/OR A NUMBER" : `${base} AND/OR A NUMBER`;
}

interface PlannedGroup {
  item: PlanItem;
  from: number;
  to: number;
}

function planRanges(items: PlanItem[], startAt: number): PlannedGroup[] {
  let n = startAt;
  return items.map((item) => {
    const from = n;
    n += item.count;
    return { item, from, to: n - 1 };
  });
}

function describePlanItem({ item, from, to }: PlannedGroup, skill: "READING" | "LISTENING", paragraphs?: number): string {
  const range = `Questions ${from}–${to}`;
  const rule = item.wordLimit ? ` — ${wordRule(item.wordLimit, item.allowNumber)} ("wordLimit": ${item.wordLimit}${item.allowNumber ? ', "allowNumber": true' : ""})` : "";
  const c = item.count;
  switch (item.kind) {
    case "tfng":
      return `${range}: "tfng" — ${c} TRUE / FALSE / NOT GIVEN statements`;
    case "ynng":
      return `${range}: "ynng" — ${c} YES / NO / NOT GIVEN statements about the writer's views`;
    case "mcq":
      return `${range}: "mcq" — ${c} multiple-choice questions, options ${skill === "READING" ? "A–D" : "A–C"}`;
    case "mcq-multi":
      return `${range}: "mcq-multi" — ONE "Choose TWO letters, A–E" question (two question numbers, same answer pair)`;
    case "gap-box":
      return `${range}: "gap-box" — summary completion from a box of ${c + 4} words/phrases, A–${LETTERS[c + 3]}`;
    case "matching":
      if (skill === "LISTENING") return `${range}: "matching" — ${c} items matched to a box of ${c + 2} options, A–${LETTERS[c + 1]}`;
      if (item.style === "headings") {
        const p = paragraphs ?? c;
        return `${range}: "matching" — list of ${c + 3} headings (keys "i", "ii" …) for paragraphs A–${LETTERS[p - 1]}, one question per paragraph`;
      }
      if (item.style === "information") return `${range}: "matching" — which paragraph contains the following information? (${c} items; options = the paragraph letters; allowReuse true)`;
      if (item.style === "endings") return `${range}: "matching" — ${c} sentence beginnings, each completed by one of ${c + 3} endings, A–${LETTERS[c + 2]}`;
      return `${range}: "matching" — ${c} statements matched to a list of 4–6 people or organisations named in the passage (A–E)`;
    case "gap": {
      const how: Record<string, string> = {
        notes: 'notes completion (template with "# heading" and "- bullet" lines)',
        summary: "summary completion (template = one paragraph)",
        sentences: 'sentence completion (no template; each question "text" contains its own [[n]])',
        table: 'table completion (template of "| … |" rows; the first row holds the column headings)',
        "flow-chart": 'flow-chart completion (template: one step per line with a "↓" line between steps)',
        form: 'form completion (template: "# heading" and "- Label: … [[n]]" lines)',
      };
      return `${range}: "gap" — ${how[item.style ?? "notes"] ?? how.notes}${rule}`;
    }
  }
}

function generalRules(skill: "READING" | "LISTENING", start: number, end: number, groups: PlannedGroup[]): string[] {
  const src = skill === "READING" ? "passage" : "recording";
  const multi = groups.some((g) => g.item.kind === "mcq-multi") ? '; a "mcq-multi" group uses two consecutive numbers' : "";
  return [
    `- "n" runs ${start}, ${start + 1} … ${end} in document order with no gaps or repeats${multi}.`,
    `- Within each group the answers follow the order of the ${src}${skill === "READING" ? " (matching groups may jump around)" : ""}.`,
    `- Each question has "answer" (an array of strings) and ONE short "explanation" sentence citing the evidence${
      skill === "READING" ? ', e.g. "Paragraph C: ‘…’."' : " (quote what the speaker says)"
    }.`,
    '- Use real IELTS wording in "instructions". Never write the bold answer rule ("Write NO MORE THAN TWO WORDS …") — it is generated from "wordLimit" / "allowNumber".',
    `- Every question must be answerable only from this ${src}, with exactly one defensible answer.`,
  ];
}

function kindRules(skill: "READING" | "LISTENING", k: number, groups: PlannedGroup[], paragraphs?: number): string[] {
  const has = (kind: GroupKind, style?: GroupStyle) => groups.some((g) => g.item.kind === kind && (!style || g.item.style === style));
  const P = `Reading Passage ${k}`;
  const paraSpan = paragraphs ? `has ${NUMBER_WORD[paragraphs]?.toLowerCase() ?? paragraphs} paragraphs, A–${LETTERS[paragraphs - 1]}` : "has <N> paragraphs, A–<last letter>";
  const out: string[] = [];
  if (has("tfng"))
    out.push(`- "tfng": factual statements that paraphrase the passage. Answer exactly "TRUE", "FALSE" or "NOT GIVEN". FALSE = the passage clearly contradicts it; NOT GIVEN = on-topic and plausible, but the passage gives no information either way. Use all three answers. Instructions: "Do the following statements agree with the information given in ${P}?"`);
  if (has("ynng"))
    out.push(`- "ynng": statements about the WRITER'S opinions or claims. Answer exactly "YES", "NO" or "NOT GIVEN" (NO = the writer clearly holds the opposite view; NOT GIVEN = the writer does not say). Use all three answers. Instructions: "Do the following statements agree with the claims of the writer in ${P}?"`);
  if (has("mcq"))
    out.push(
      skill === "READING"
        ? '- "mcq": each question has its own "options" A–D: one correct answer and three plausible distractors that use ideas from the passage but do not answer the question; "answer": ["C"]. Instructions: "Choose the correct letter, A, B, C or D."'
        : '- "mcq": each question has its own three "options" A–C; the speakers also mention the wrong options (rejected ideas, earlier plans, other people\'s views); "answer": ["B"]. Instructions: "Choose the correct letter, A, B or C."'
    );
  if (has("mcq-multi"))
    out.push('- "mcq-multi": put the question stem ("Which TWO … ?") in the group "title", five shared "options" A–E, and exactly TWO questions WITHOUT "text" whose "answer" is the SAME full key set, e.g. both ["B","E"]. Instructions: "Choose TWO letters, A–E."');
  const lm = skill === "LISTENING" ? groups.find((g) => g.item.kind === "matching") : undefined;
  if (lm) {
    const n = lm.item.count;
    out.push(
      `- "matching": "options" = a box of short items keyed "A", "B" … (two more options than questions); question "text" = the person / place / feature being asked about; "answer": ["E"]; "allowReuse": true only if a letter is used twice. Instructions like "What does the speaker say about each of the following? Choose ${NUMBER_WORD[n] ?? n} answers from the box and write the correct letter, A–${LETTERS[n + 1]}, next to Questions ${lm.from}–${lm.to}."`
    );
  }
  if (skill === "READING" && has("matching", "headings"))
    out.push(`- "matching" (headings): group "title": "List of Headings"; "options" keyed "i", "ii", "iii" … with three more headings than paragraphs (distractors that only fit one detail of a paragraph); question "text" = "Paragraph A", "Paragraph B" …; "answer": ["iv"]; each heading used once; "allowReuse": false. Instructions: "${P} ${paraSpan}. Choose the correct heading for each paragraph from the list of headings below."`);
  if (skill === "READING" && has("matching", "information"))
    out.push(`- "matching" (information): "options" = one per paragraph, {"key":"A","text":"Paragraph A"} …; question "text" = a paraphrased detail (e.g. "a reference to an early design that failed"); "answer": ["D"]; "allowReuse": true. Instructions: "${P} ${paraSpan}. Which paragraph contains the following information?"`);
  if (skill === "READING" && has("matching", "features"))
    out.push('- "matching" (features): group "title" such as "List of Researchers"; "options" = 4–6 people / organisations / theories from the passage keyed "A", "B" …; question "text" = a paraphrased statement or finding; "answer": ["B"]; "allowReuse": true if a letter is used twice. Instructions: "Look at the following statements (Questions X–Y) and the list of researchers below. Match each statement with the correct researcher, A–E."');
  if (skill === "READING" && has("matching", "endings"))
    out.push('- "matching" (sentence endings): question "text" = a sentence beginning; "options" = endings keyed "A" … (three more than questions, all grammatically possible); "answer": ["F"]. Instructions: "Complete each sentence with the correct ending, A–G, below."');
  return [...out, ...gapRules(skill, has("gap"), has("gap-box"))];
}

function gapRules(skill: "READING" | "LISTENING", gap: boolean, box: boolean): string[] {
  const out: string[] = [];
  const layout =
    '"template" whose lines are "# Heading", "- bullet text [[n]]", "| cell | cell [[n]] |" (first table row = column headings), "↓" between flow-chart steps, or plain sentences — each placeholder [[n]] exactly once, and the questions of a template group have NO "text"';
  if (gap && skill === "READING")
    out.push(`- "gap": every answer is copied EXACTLY from the passage (same spelling and word form) and fits "wordLimit" ("allowNumber": true when an answer is a number). Either a ${layout}; or (sentence completion) no template and each question "text" containing its own [[n]]. The words around each gap paraphrase the passage and make the answer grammatical. List accepted variants, e.g. ["40", "forty"]; optional words in brackets, e.g. ["(daily) exercise"].`);
  if (gap && skill === "LISTENING")
    out.push(`- "gap": every answer is a word the speakers actually SAY, spelled exactly as in the script, and fits "wordLimit" ("allowNumber": true when an answer is a number). Say a spelled name as a whole word AND letter by letter ("It's Kerrigan — K, E, double R, I, G, A, N"). Write numbers in the script the way they are spoken ("twelve pounds") and accept both forms (["12", "twelve"]); a code or postcode appears in the script exactly as in the answer ("BT7 3QR"); avoid phone numbers. Use a ${layout}.`);
  if (box)
    out.push('- "gap-box": a summary "template" with [[n]] placeholders; "options" = a box of single words or short phrases keyed "A", "B" … (at least three more than gaps, all the same word class so every option looks possible); "answer" = the key, e.g. ["F"]; the summary paraphrases the passage. Instructions: "Complete the summary using the list of words, A–I, below."');
  return out;
}

const GROUP_SHAPE =
  'GROUP = {"kind":"tfng"|"ynng"|"mcq"|"mcq-multi"|"matching"|"gap"|"gap-box","instructions":string,"title"?:string,"wordLimit"?:number,"allowNumber"?:boolean,"options"?:[{"key":string,"text":string}],"allowReuse"?:boolean,"template"?:string,"questions":[{"n":number,"text"?:string,"options"?:[{"key":"A","text":string}],"answer":[string],"explanation":string}]}\n("options" on the GROUP = shared list for matching / mcq-multi / gap-box; "options" on a QUESTION = mcq only.)';

const READING_SHAPE = `{"title":string,"subtitle":string,"paragraphs":[{"label":"A","text":string}],"groups":[GROUP]}\n${GROUP_SHAPE}`;
const LISTENING_SHAPE = `{"context":"You will hear …","speakers":[{"name":string,"gender":"female"|"male","accent":"british"|"american"|"australian"}],"script":[{"speaker":string,"text":string,"pauseAfter"?:number}],"groups":[GROUP]}\n${GROUP_SHAPE}`;

/** FORMAT reference only, trimmed from the hand-written seed (lib/ielts/content/reading-a.ts). */
export const READING_FORMAT_EXAMPLE: ReadingPart = {
  id: "passage-1",
  title: "The Rise of the Vertical Farm",
  subtitle: "How growing crops in stacked layers indoors became an industry",
  paragraphs: [
    { label: "A", text: "For most of human history, the food a community could grow was limited by the fertile land within its reach. Vertical farming grows crops in stacked layers inside buildings … Sceptics respond that the approach is costly and consumes vast amounts of electricity." },
    { label: "B", text: "In 1909 the engineer Aurelio Cassani published drawings for a ‘garden tower’: a fifteen-storey steel frame which, he calculated, could feed around two thousand residents. It was never built. Daylight entering through the walls would have penetrated only a few metres …" },
  ],
  groups: [
    {
      kind: "matching",
      instructions: "Reading Passage 1 has seven paragraphs, A–G. Choose the correct heading for each paragraph from the list of headings below.",
      title: "List of Headings",
      allowReuse: false,
      options: [
        { key: "i", text: "Early artificial lighting and its drawbacks" },
        { key: "ii", text: "Competing views of an alternative way to grow food" },
        { key: "iii", text: "An ambitious plan defeated by a basic obstacle" },
      ],
      questions: [
        { n: 1, text: "Paragraph A", answer: ["ii"], explanation: "Paragraph A sets what supporters claim against how ‘sceptics respond’." },
        { n: 2, text: "Paragraph B", answer: ["iii"], explanation: "Paragraph B: the tower ‘was never built’ because daylight would reach ‘only a few metres’." },
      ],
    },
    {
      kind: "tfng",
      instructions: "Do the following statements agree with the information given in Reading Passage 1?",
      questions: [
        { n: 3, text: "Cassani expected one tower to feed a few hundred people.", answer: ["FALSE"], explanation: "Paragraph B: it ‘could feed around two thousand residents’." },
        { n: 4, text: "Farmers at the time welcomed Cassani's design.", answer: ["NOT GIVEN"], explanation: "Paragraph B says nothing about how farmers reacted." },
      ],
    },
    {
      kind: "gap",
      instructions: "Complete the notes below.",
      title: "The garden tower",
      wordLimit: 2,
      allowNumber: true,
      template: "# Cassani's design (1909)\n- a steel frame of [[5]] storeys\n- daylight would reach only a few [[6]] inside",
      questions: [
        { n: 5, answer: ["fifteen", "15"], explanation: "Paragraph B: ‘a fifteen-storey steel frame’." },
        { n: 6, answer: ["metres"], explanation: "Paragraph B: daylight ‘would have penetrated only a few metres’." },
      ],
    },
  ],
};

/** FORMAT reference only, trimmed from the hand-written seed (lib/ielts/content/listening-b.ts). */
export const LISTENING_FORMAT_EXAMPLE: ListeningPart = {
  id: "part-1",
  title: "Part 1",
  context: "You will hear a traveller reporting a lost bag at the lost-property office of a railway station.",
  speakers: [
    { name: "Clerk", gender: "male", accent: "british" },
    { name: "Tessa", gender: "female", accent: "australian" },
  ],
  script: [
    { speaker: "Clerk", text: "Good afternoon, lost property. How can I help you?" },
    { speaker: "Tessa", text: "Hi. I think I left my bag somewhere in the station about an hour ago." },
    { speaker: "Clerk", text: "Let's fill in a report, then. Can I take your surname?" },
    { speaker: "Tessa", text: "It's Kerrigan. That's K, E, double R, I, G, A, N." },
    { speaker: "Clerk", text: "Thanks. And where are you staying?" },
    { speaker: "Tessa", text: "At the Kingfisher Hotel. Oh, no, sorry, that was in the last town. Here I'm at the Kestrel.", pauseAfter: 2 },
    { speaker: "Narrator", text: "Before you hear the rest of the conversation, you have some time to look at questions 3 and 4.", pauseAfter: 20 },
    { speaker: "Clerk", text: "Right. What kind of bag is it?" },
    { speaker: "Tessa", text: "A rucksack. People think it's black, but it's actually dark green." },
    { speaker: "Clerk", text: "And where do you think you left it?" },
    { speaker: "Tessa", text: "I thought it was the ticket hall, but no, I put it down at the coffee kiosk." },
  ],
  groups: [
    {
      kind: "gap",
      instructions: "Complete the form below.",
      title: "Lost Property Report",
      wordLimit: 1,
      allowNumber: true,
      template: "- Surname: [[1]]\n- Staying at: the [[2]] Hotel",
      questions: [
        { n: 1, answer: ["Kerrigan"], explanation: "She spells it: “K, E, double R, I, G, A, N.”" },
        { n: 2, answer: ["Kestrel"], explanation: "She corrects herself: “Here I'm at the Kestrel.”" },
      ],
    },
    {
      kind: "mcq",
      instructions: "Choose the correct letter, A, B or C.",
      questions: [
        {
          n: 3,
          text: "What colour is the bag?",
          options: [
            { key: "A", text: "black" },
            { key: "B", text: "dark green" },
            { key: "C", text: "grey" },
          ],
          answer: ["B"],
          explanation: "“People think it's black, but it's actually dark green.”",
        },
        {
          n: 4,
          text: "Where did Tessa leave the bag?",
          options: [
            { key: "A", text: "on the train" },
            { key: "B", text: "in the ticket hall" },
            { key: "C", text: "at a coffee kiosk" },
          ],
          answer: ["C"],
          explanation: "“I thought it was the ticket hall, but no, I put it down at the coffee kiosk.”",
        },
      ],
    },
  ],
};

const exampleJson = (part: object, drop: string[]): string =>
  JSON.stringify(Object.fromEntries(Object.entries(part).filter(([k]) => !drop.includes(k))));

function originality(example: boolean): string {
  return [
    "ORIGINALITY — non-negotiable:",
    "- Write everything from scratch. Never copy, adapt, paraphrase, summarise, translate or imitate material from Cambridge IELTS books, the British Council, IDP, IELTS.org or any other official or published IELTS test, book, article or website.",
    "- Invent the specific people, organisations, studies, places and figures you mention (plausible fictional names). Never name or quote real living people. General facts and background must be accurate and uncontroversial.",
    ...(example ? ["- The FORMAT EXAMPLE only shows the JSON shape: do not reuse its topic, sentences, names or questions."] : []),
    "- Keep everything suitable for a school: no politics, religion, violence, crime, alcohol, drugs, gambling or distressing detail.",
  ].join("\n");
}

const OUTPUT_RULE = "OUTPUT: exactly one compact JSON object (no indentation, no markdown, no comments, nothing outside the JSON).";

const READING_SYSTEM = `You are a senior IELTS Academic Reading item writer creating ORIGINAL practice tests for Averna, an IELTS preparation school, in the computer-delivered IELTS format.\n\n${originality(true)}\n\n${OUTPUT_RULE}`;
const LISTENING_SYSTEM = `You are a senior IELTS Listening item writer creating ORIGINAL practice tests for Averna, an IELTS preparation school, in the computer-delivered IELTS format. Scripts are read aloud by text-to-speech voices.\n\n${originality(true)}\n\n${OUTPUT_RULE}`;
const WRITING_SYSTEM = `You are a senior IELTS Writing examiner and item writer creating ORIGINAL practice tasks and model answers for Averna, an IELTS preparation school.\n\n${originality(false)}\n- Chart data is invented: never present it as real statistics of a named real organisation.\n\n${OUTPUT_RULE}`;
const SPEAKING_SYSTEM = `You are a senior IELTS Speaking examiner creating ORIGINAL speaking tests for Averna, an IELTS preparation school.\n\n${originality(false)}\n\n${OUTPUT_RULE}`;

const READING_BANDS: Record<GenDifficulty, [string, string, string]> = {
  Easy: ["5.0–5.5", "5.5–6.0", "6.0–6.5"],
  Medium: ["5.5–6.5", "6.5–7.0", "7.0–7.5"],
  Hard: ["6.5–7.0", "7.0–7.5", "7.5–8.5"],
};

const READING_POSITION = [
  "the most accessible passage: a descriptive or historical text with a clear sequence of events or developments.",
  "the middle passage: an analytical text explaining research, processes or causes; cite several named (fictional) researchers or organisations whose findings or views differ.",
  "the most demanding passage: a discursive or argumentative text with abstract ideas, hedging and concession, in which the writer weighs a debate and states their own views (\"In my view…\", \"it seems to me…\").",
];

const variationLine = (topic: string, what: string): string => {
  const v = parseTopic(topic).variation;
  return v > 1 ? `This is version ${v} of this ${what}: choose a less obvious sub-topic and completely different details, names and examples from the standard treatment.` : "";
};

const kindsOf = (p: { groups?: ExamGroup[] }): string => unique((p.groups ?? []).map((g) => g.kind)).join(", ");

function readingPrompt(d: DraftData, step: number): ModelRequest {
  const k = step + 1;
  const { startAt, count } = READING_RANGES[Math.min(step, 2)];
  const end = startAt + count - 1;
  const { base } = parseTopic(d.topic);
  // Real tests put three UNRELATED subjects side by side (see readingThemes).
  const brief = readingThemes(d.topic)[Math.min(step, 2)];
  const subject = step === 0 || !brief ? base : brief.topic;
  const angle = brief?.angles[Math.min(step, 2)] ?? ["the history and development of the subject", "research findings and how the subject works", "a debate about the subject's future"][Math.min(step, 2)];
  const plan = pickPlan(READING_PLANS[Math.min(step, 2)], `${d.topic}#R${k}`);
  const groups = planRanges(plan.items, startAt);
  const earlier = (d.parts as ReadingPart[]).map(
    (p, i) => `- Passage ${i + 1}: “${p.title}”${p.subtitle ? ` — ${p.subtitle}` : ""} (question types: ${kindsOf(p)})`
  );
  const user = [
    `Write READING PASSAGE ${k} of 3 for a full IELTS Academic Reading test.`,
    "",
    `PASSAGE SUBJECT: ${subject}${brief ? ` (${brief.area})` : ""}. Angle for this passage: ${angle}.`,
    brief
      ? "As in the real exam, the three passages of this test are on unrelated subjects: write about this passage's own subject only, and don't refer to the other passages."
      : "",
    step === 0 || !brief ? variationLine(d.topic, "theme") : "",
    `LEVEL: the test is "${d.difficulty}"; Passage ${k} targets readers of about band ${READING_BANDS[d.difficulty][Math.min(step, 2)]}. It is ${READING_POSITION[Math.min(step, 2)]}`,
    earlier.length ? `EARLIER PASSAGES IN THIS TEST — make this one clearly different in sub-topic, text type, names and facts:\n${earlier.join("\n")}` : "",
    "",
    "PASSAGE",
    '- A "title" (2–7 words) and a one-sentence "subtitle".',
    `- ${plan.paragraphs ? `Exactly ${plan.paragraphs}` : "6–8"} paragraphs in "paragraphs", labelled "A", "B", "C" … in order; 750–950 words in total (count carefully: under 650 words is rejected).`,
    "- Each paragraph has one clear main idea and concrete, testable detail (dates, quantities, named fictional people and places, causes and effects).",
    "",
    `QUESTIONS — exactly ${count} questions numbered ${startAt}–${end}, in these groups, in this order:`,
    ...groups.map((g, i) => `${i + 1}. ${describePlanItem(g, "READING", plan.paragraphs)}`),
    "",
    "RULES",
    ...generalRules("READING", startAt, end, groups),
    ...kindRules("READING", k, groups, plan.paragraphs),
    "",
    "JSON SHAPE (exam-v2 ReadingPart):",
    READING_SHAPE,
    "",
    "FORMAT EXAMPLE (trimmed; shape only — invent everything):",
    exampleJson(READING_FORMAT_EXAMPLE, ["id"]),
  ];
  return { system: READING_SYSTEM, user: joinPrompt(user), maxTokens: 4000, label: `Reading passage ${k}` };
}

/** Join prompt lines, dropping empty optional lines but keeping single blank separators. */
const joinPrompt = (lines: string[]): string => lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

const LISTENING_PART_GUIDE = [
  "Part 1: an everyday TRANSACTIONAL CONVERSATION between exactly two speakers (e.g. a customer and a receptionist, agent or official) in which one of them gives personal and practical details. Include a surname, street or place name that is said and then spelled letter by letter; numbers such as a price, date, time, quantity, postcode or reference code; and at least three distractors: a detail given and then corrected (\"fifty… no, actually forty\"), a plan that changes, or an option that is considered and rejected.",
  "Part 2: a MONOLOGUE in an everyday social context (e.g. a guide, organiser, manager or presenter speaking to a group or on the radio); one speaker (an interviewer may ask one or two short questions). It gives practical information about a place, event, service or facilities, with signposting (\"Now, a few words about…\").",
  "Part 3: an ACADEMIC DISCUSSION between two to four speakers (students and a tutor or lecturer) about an assignment, project, research or course. They give opinions, agree and disagree, change their minds and reach decisions; answers depend on what is finally agreed, not on the first idea mentioned.",
  "Part 4: an ACADEMIC LECTURE by one speaker with no interruptions and no break: clear structure and signposting (\"First…\", \"Turning now to…\", \"Finally…\"), definitions, examples, causes and effects.",
];
const LISTENING_SPEAKERS = ["exactly two speakers", "one main speaker (optionally a second who only asks brief questions)", "two to four speakers", "exactly one speaker (the lecturer)"];
const LISTENING_NOUN = ["conversation", "talk", "discussion", "lecture"];
const LISTENING_LEVEL: Record<GenDifficulty, string> = {
  Easy: "clear, unhurried speech, familiar vocabulary and obvious signposting (about band 5.0–6.0)",
  Medium: "natural speed with typical distractors and paraphrase (about band 6.0–7.0)",
  Hard: "fast natural speech, dense information, subtle distractors and paraphrase (about band 7.0–8.0)",
};

function listeningPrompt(d: DraftData, step: number): ModelRequest {
  const i = Math.min(step, 3);
  const k = i + 1;
  const { startAt, count } = LISTENING_RANGES[i];
  const end = startAt + count - 1;
  const set = findListeningSet(d.topic);
  const situation = set?.parts[i] ?? ["an everyday booking or enquiry", "a talk about a local place or event", "students discussing a project with a tutor", "a lecture on an academic subject"][i];
  const plan = pickPlan(LISTENING_PLANS[i], `${d.topic}#L${k}`);
  const groups = planRanges(plan.items, startAt);
  const earlier = (d.parts as ListeningPart[]).map(
    (p, j) => `- Part ${j + 1}: ${p.context} (voices: ${(p.speakers ?? []).map((s) => `${s.name}, ${s.gender}${s.accent ? `, ${s.accent}` : ""}`).join("; ")})`
  );
  const breakLine =
    k <= 3 && groups.length > 1
      ? `- Where the recording moves on to the next question group, give the last line before the change "pauseAfter": 2 and then add ONE line {"speaker":"Narrator","text":"Before you hear the rest of the ${LISTENING_NOUN[i]}, you have some time to look at questions X to Y.","pauseAfter":20}.`
      : "";
  const user = [
    `Write PART ${k} of 4 of a full IELTS Listening test (questions ${startAt}–${end}).`,
    "",
    `SCENARIO SET: ${parseTopic(d.topic).base}. Situation for Part ${k}: ${situation}.`,
    variationLine(d.topic, "scenario set"),
    `LEVEL: the test is "${d.difficulty}": ${LISTENING_LEVEL[d.difficulty]}. Part ${k} of 4 — difficulty rises from Part 1 to Part 4.`,
    LISTENING_PART_GUIDE[i],
    earlier.length ? `EARLIER PARTS IN THIS TEST — use different names, voices and details:\n${earlier.join("\n")}` : "",
    "",
    "SCRIPT",
    "- 600–900 words of natural spoken English: contractions, short turns in dialogues, occasional hesitation (\"um\", \"let me see\") and self-correction. It is read by text-to-speech: no stage directions, sound effects, brackets or emojis.",
    `- "speakers": ${LISTENING_SPEAKERS[i]}; each with "name" (a first name or a role such as "Receptionist" or "Lecturer"), "gender" ("female" or "male") and "accent" ("british", "american" or "australian"); vary genders and accents.`,
    '- "script" lines: {"speaker": <a name from "speakers">, "text": …}; split long monologue turns into lines of 2–5 sentences.',
    `- Do NOT write the part introduction ("Part ${k}. You will hear…"), "you have some time to look at questions…" before the recording starts, or "That is the end of Part ${k}" — the audio player adds those.`,
    breakLine,
    '- "context": ONE sentence starting "You will hear …" that describes the situation without giving any answers.',
    "",
    `QUESTIONS — exactly ${count} questions numbered ${startAt}–${end}, in these groups, in this order:`,
    ...groups.map((g, j) => `${j + 1}. ${describePlanItem(g, "LISTENING")}`),
    "",
    "RULES",
    ...generalRules("LISTENING", startAt, end, groups),
    ...kindRules("LISTENING", k, groups),
    "",
    "JSON SHAPE (exam-v2 ListeningPart):",
    LISTENING_SHAPE,
    "",
    "FORMAT EXAMPLE (trimmed Part 1; shape only — invent everything):",
    exampleJson(LISTENING_FORMAT_EXAMPLE, ["id", "title"]),
  ];
  return { system: LISTENING_SYSTEM, user: joinPrompt(user), maxTokens: 3600, label: `Listening part ${k}` };
}

const CHART_SPEC: Record<Task1Chart, { noun: string; label: string; shape: (unit: string) => string }> = {
  bar: {
    noun: "bar chart",
    label: "Bar Chart",
    shape: (u) => `ONE bar chart: [{"kind":"bar","unit":"${u}","groups":[3–6 category labels],"series":[2–4 × {"name":string,"values":[one number per group]}]}]`,
  },
  line: {
    noun: "line graph",
    label: "Line Graph",
    shape: (u) => `ONE line graph: [{"kind":"line","unit":"${u}","xLabels":[5–12 time points in order],"series":[2–4 × {"name":string,"values":[one number per xLabel]}]}]`,
  },
  pie: {
    noun: "pie chart",
    label: "Pie Chart",
    shape: () => 'ONE pie chart: [{"kind":"pie","unit":"%","title":string,"slices":[4–7 × {"label":string,"value":number}]}] — the values add up to exactly 100',
  },
  "two pies": {
    noun: "two pie charts",
    label: "Pie Charts",
    shape: () => 'TWO pie charts with the SAME slice labels in the same order: [{"kind":"pie","unit":"%","title":"<first year or group>","slices":[…]},{"kind":"pie","unit":"%","title":"<second>","slices":[…]}] — each adds up to exactly 100',
  },
  "pie and bar": {
    noun: "pie chart and bar chart",
    label: "Pie and Bar Chart",
    shape: (u) => `a pie chart then a bar chart about the same categories: [{"kind":"pie","unit":"%","title":string,"slices":[4–5 slices adding up to 100]},{"kind":"bar","unit":"${u.replace(/^.*\(pie\)\s*and\s*/i, "").replace(/\s*\(bar\)$/i, "")}","groups":[the same categories],"series":[{"name":string,"values":[one number per group]}]}]`,
  },
};

const TASK1_LEVEL: Record<GenDifficulty, string> = {
  Easy: "clear trends with 3–4 categories or lines and obvious highs and lows",
  Medium: "4–5 categories or lines with one or two exceptions to the main trend",
  Hard: "several categories, crossing lines or contrasting charts that require careful selection of the key features",
};

const WRITING_TAIL = [
  '- "usefulPhrases": 6–8 reusable phrases taken from your answer ("…" for the variable part).',
  '- "strategyEn": 2–3 sentences of strategy advice specific to this task.',
  '- "strategyUz": the same advice written naturally in Uzbek, LATIN script (oʻ, gʻ, sh, ch), never Cyrillic and not a word-for-word translation.',
];

function task1Prompt(d: DraftData): ModelRequest {
  const sc = findTask1Scenario(d.topic);
  const chart: Task1Chart = sc?.chart ?? "bar";
  const spec = CHART_SPEC[chart];
  const subject = sc?.subject ?? parseTopic(d.topic).base.replace(/^[^:]*:\s*/, "");
  const unit = sc?.unit ?? "";
  const user = [
    "Create ONE original IELTS Academic Writing Task 1 task with a band-8 model answer.",
    "",
    `SCENARIO: a ${spec.noun} showing ${subject}.${unit ? ` Unit: ${unit}.` : ""}${sc ? ` Plausible data: ${sc.data}.` : ""}`,
    variationLine(d.topic, "scenario"),
    `LEVEL: "${d.difficulty}" — ${TASK1_LEVEL[d.difficulty]}.`,
    "",
    "REQUIREMENTS",
    `- "chart": ${spec.shape(unit || "units")}. Invent realistic, internally consistent figures (whole numbers or one decimal place) with clear trends, a highest and a lowest value, and at least one notable exception or change in ranking. Every "values" array has exactly one number per label.`,
    `- "prompt": real IELTS wording: first "The ${spec.noun} below show${chart === "two pies" || chart === "pie and bar" ? "" : "s"} …" (one or two sentences: what is measured, where, when, in what units), then a blank line, then exactly "${TASK1_SUMMARISE}", then a blank line, then exactly "${TASK1_WORDS}"`,
    `- "title": "${spec.label}: <short subject>", e.g. "Line Graph: Visitors to Three Attractions".`,
    '- "sampleAnswer": an original band-8 report of 170–220 words in four paragraphs separated by blank lines ("\\n\\n"): (1) a paraphrase of the task; (2) an overview of the main trends with no figures; (3) and (4) grouped details with accurate figures and comparisons. Every figure you quote must match "chart" exactly; no opinions, no explanations of causes, no conclusion paragraph.',
    ...WRITING_TAIL,
    "",
    'JSON SHAPE: {"title":string,"prompt":string,"chart":[CHART],"sampleAnswer":string,"usefulPhrases":[string],"strategyEn":string,"strategyUz":string}',
  ];
  return { system: WRITING_SYSTEM, user: joinPrompt(user), maxTokens: 2000, label: "Writing Task 1" };
}

const ESSAY_QUESTION: Record<EssayType, string> = {
  Opinion: '"To what extent do you agree or disagree?"',
  Discussion: '"Discuss both these views and give your own opinion." (the statement must present two opposing views: "Some people think … Others believe …")',
  "Advantages and disadvantages": '"Do the advantages of this outweigh the disadvantages?"',
  "Problem and solution": '"What problems does this cause? What solutions can you suggest?" (or "Why is this happening? What can be done …?")',
  "Two-part question": "two direct questions that match the issue, e.g. \"Why do people …? What problems might they face?\"",
  "Positive or negative development": '"Is this a positive or negative development?"',
};

const TASK2_LEVEL: Record<GenDifficulty, string> = {
  Easy: "a familiar, concrete issue in straightforward wording",
  Medium: "a typical IELTS issue that needs a clear, balanced argument",
  Hard: "a more abstract issue that needs careful qualification and precise vocabulary",
};

function task2Prompt(d: DraftData): ModelRequest {
  const t = findTask2Topic(d.topic);
  const type: EssayType = t?.type ?? "Opinion";
  const user = [
    "Create ONE original IELTS Writing Task 2 essay question with a band-8 model essay.",
    "",
    `THEME: ${parseTopic(d.topic).base}${t ? ` — ${t.issue}` : ""}. ESSAY TYPE: ${type}.`,
    variationLine(d.topic, "theme"),
    `LEVEL: "${d.difficulty}" — ${TASK2_LEVEL[d.difficulty]}.`,
    "",
    "REQUIREMENTS",
    `- "prompt": real IELTS wording in this order, separated by blank lines: (1) one or two sentences presenting the issue; (2) the question for this essay type: ${ESSAY_QUESTION[type]}; (3) exactly "${TASK2_REASONS}"; (4) exactly "${TASK2_WORDS}"`,
    '- "title": 2–6 words naming the issue, e.g. "The Four-Day School Week".',
    '- "sampleAnswer": an original band-8 essay of 270–320 words in 4–5 paragraphs separated by blank lines ("\\n\\n"): an introduction that paraphrases the issue and states a clear position (where the question asks for one); body paragraphs with one main idea each, developed with explanation and a specific example; a conclusion that answers the question directly. Precise, natural academic vocabulary; no memorised clichés.',
    ...WRITING_TAIL,
    "",
    'JSON SHAPE: {"title":string,"prompt":string,"sampleAnswer":string,"usefulPhrases":[string],"strategyEn":string,"strategyUz":string}',
  ];
  return { system: WRITING_SYSTEM, user: joinPrompt(user), maxTokens: 2200, label: "Writing Task 2" };
}

const SPEAKING_LEVEL: Record<GenDifficulty, string> = {
  Easy: "familiar, concrete questions in simple wording",
  Medium: "typical exam questions",
  Hard: "Part 3 questions that push towards abstract, society-level reasoning",
};

function speakingPrompt(d: DraftData): ModelRequest {
  const th = findSpeakingTheme(d.topic);
  const [a, b, c] = th?.part1 ?? ["Work or studies", "Free time", "Your neighbourhood"];
  const cue = th?.cue ?? parseTopic(d.topic).base;
  const p3 = th?.part3 ?? parseTopic(d.topic).base;
  const user = [
    "Create ONE original, complete IELTS Speaking test (Parts 1–3).",
    "",
    `THEME: ${parseTopic(d.topic).base}. Part 1 topics in this order: "${a}" (the opening topic about the candidate), "${b}", "${c}". Part 2 cue card: Describe ${cue}. Part 3 discussion theme: ${p3}.`,
    variationLine(d.topic, "theme"),
    `LEVEL: "${d.difficulty}" — ${SPEAKING_LEVEL[d.difficulty]}.`,
    "",
    "REQUIREMENTS",
    '- "title": 2–6 words naming the Part 2 topic, e.g. "Someone careful with money".',
    '- "part1": the 3 topics above, each {"topic": string, "questions": [4 short questions]} in natural examiner wording about the candidate\'s own life, habits, preferences and past ("How often do you…?", "Did you… when you were a child?"); no abstract questions.',
    '- "part2": {"cue": "Describe …" (one sentence ending with a full stop), "points": 3 "You should say" prompts without bullets (e.g. "who this person is"), "closing": "and explain …", "followUp": one short rounding-off question}.',
    `- "part3": {"theme": "${p3}", "questions": 5 discussion questions linked to Part 2, moving from describing and comparing to evaluating and predicting ("Why do some people…?", "How has … changed?", "Should schools…?")}.`,
    "",
    'JSON SHAPE: {"title":string,"part1":[{"topic":string,"questions":[string]}],"part2":{"cue":string,"points":[string],"closing":string,"followUp":string},"part3":{"theme":string,"questions":[string]}}',
  ];
  return { system: SPEAKING_SYSTEM, user: joinPrompt(user), maxTokens: 1500, label: "Speaking set" };
}

/** Prompt for the draft's next missing step. */
export function buildStepPrompt(d: DraftData): ModelRequest {
  switch (d.skill) {
    case "READING":
      return readingPrompt(d, d.parts.length);
    case "LISTENING":
      return listeningPrompt(d, d.parts.length);
    case "WRITING_TASK1":
      return task1Prompt(d);
    case "WRITING_TASK2":
      return task2Prompt(d);
    case "SPEAKING":
      return speakingPrompt(d);
  }
}
