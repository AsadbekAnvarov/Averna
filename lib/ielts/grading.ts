/**
 * Server-side grading for exam-v2 tests. Pure and deterministic.
 *
 * Marking follows the real exam's conventions where they matter for fairness:
 *  - completion answers must be words from the text, spelled correctly, and
 *    must respect the word limit (an answer over the limit is wrong);
 *  - case, surrounding punctuation, a leading article, hyphen-vs-space,
 *    thousands separators and 9.30/9:30 style times don't matter;
 *  - optional words in the key are written in brackets: "(the) river bank";
 *  - "choose TWO letters" questions give one mark per correct letter, in any order.
 */

import type {
  ExamAnswers,
  ExamGroup,
  ExamTest,
  GradeItem,
  GradeResult,
  GroupKind,
} from "./types";

/** Canonical comparison form of a typed answer. */
export function normalizeAnswer(raw: unknown): string {
  let s = String(raw ?? "").normalize("NFKC").toLowerCase();
  s = s.replace(/[\u2018\u2019\u201B\u2032]/g, "'").replace(/[\u201C\u201D\u2033]/g, '"');
  s = s.replace(/[\u2010-\u2015\u2212]/g, "-");
  s = s.replace(/(\d),(?=\d{3}\b)/g, "$1"); // 1,500 → 1500
  s = s.replace(/(\d)[.:](\d{2})\b/g, "$1:$2"); // 9.30 → 9:30
  s = s.replace(/[£$€]/g, "");
  s = s.replace(/\s*-\s*/g, " "); // part-time == part time
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%]+$/gu, ""); // surrounding punctuation (keeps é, ü …)
  s = s.replace(/^(a|an|the)\s+/, "");
  return s;
}

/** "(the) river bank" → ["the river bank", "river bank"]. Max 3 optional segments. */
export function expandOptional(key: string): string[] {
  const segments = key.match(/\(([^)]*)\)/g) ?? [];
  if (!segments.length) return [key];
  const opts = segments.slice(0, 3);
  const out = new Set<string>();
  const total = 1 << opts.length;
  for (let mask = 0; mask < total; mask++) {
    let s = key;
    opts.forEach((seg, i) => {
      s = s.replace(seg, mask & (1 << i) ? seg.slice(1, -1) : "");
    });
    out.add(s.replace(/\s+/g, " ").trim());
  }
  return Array.from(out).filter(Boolean);
}

const NUMERIC_TOKEN = /^[£$€]?\d[\d,.:/]*(%|st|nd|rd|th|am|pm)?$/i;

/** Words that count toward the limit. Hyphenated words count once; numbers are free when allowed. */
export function countLimitedWords(answer: string, allowNumber?: boolean): number {
  const tokens = answer.trim().split(/\s+/).filter(Boolean);
  return tokens.filter((t) => !(allowNumber && NUMERIC_TOKEN.test(t))).length;
}

export function isGapCorrect(
  given: string,
  accepted: string[],
  group: Pick<ExamGroup, "wordLimit" | "allowNumber">
): { correct: boolean; overLimit: boolean } {
  const g = normalizeAnswer(given);
  if (!g) return { correct: false, overLimit: false };
  const overLimit = group.wordLimit != null && countLimitedWords(given, group.allowNumber) > group.wordLimit;
  const variants = accepted.flatMap(expandOptional).map(normalizeAnswer).filter(Boolean);
  const match = variants.includes(g);
  return { correct: match && !overLimit, overLimit };
}

const BINARY: Record<string, string> = {
  t: "TRUE",
  true: "TRUE",
  f: "FALSE",
  false: "FALSE",
  y: "YES",
  yes: "YES",
  n: "NO",
  no: "NO",
  ng: "NOT GIVEN",
  "not given": "NOT GIVEN",
  "not-given": "NOT GIVEN",
  notgiven: "NOT GIVEN",
};

/** Canonical TRUE/FALSE/YES/NO/NOT GIVEN (or "" when unrecognised). */
export function canonicalBinary(raw: unknown): string {
  const k = String(raw ?? "").trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  return BINARY[k] ?? "";
}

function keyOf(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

function displayKey(raw: string): string {
  return /^[ivx]+$/i.test(raw) ? raw.toLowerCase() : raw.toUpperCase();
}

function asString(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v.join(", ");
  return typeof v === "string" ? v : "";
}

function pickedKeys(v: string | string[] | undefined): string[] {
  const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
  return Array.from(new Set(arr.map(keyOf).filter(Boolean)));
}

export function gradeGroup(group: ExamGroup, answers: ExamAnswers): GradeItem[] {
  const items: GradeItem[] = [];
  const kind: GroupKind = group.kind;

  if (kind === "mcq-multi") {
    const first = group.questions[0];
    const set = Array.from(new Set((first?.answer ?? []).map(keyOf)));
    const picked = pickedKeys(first ? answers[String(first.n)] : undefined)
      .slice(0, group.questions.length)
      .sort();
    const hits = picked.filter((k) => set.includes(k));
    const misses = picked.filter((k) => !set.includes(k));
    // Present each question as one "slot": correct letters first, then wrong picks.
    const ordered = [...hits, ...misses];
    const remainingExpected = set.filter((k) => !hits.includes(k)).sort();
    group.questions.forEach((q, i) => {
      const given = ordered[i] ?? "";
      const correct = i < hits.length;
      const expected = correct ? given : remainingExpected.shift() ?? set[i] ?? "";
      items.push({
        n: q.n,
        kind,
        correct,
        given: given ? displayKey(given) : "",
        expected: displayKey(expected),
        accepted: set.map(displayKey),
        explanation: q.explanation,
      });
    });
    return items;
  }

  for (const q of group.questions) {
    const raw = answers[String(q.n)];
    const givenStr = asString(raw);
    const accepted = q.answer ?? [];
    let correct = false;
    let overLimit = false;
    let givenDisplay = givenStr.trim();
    let acceptedDisplay = accepted;

    if (kind === "tfng" || kind === "ynng") {
      const g = canonicalBinary(givenStr);
      givenDisplay = g || givenStr.trim();
      acceptedDisplay = accepted.map(canonicalBinary).filter(Boolean);
      correct = !!g && acceptedDisplay.includes(g);
    } else if (kind === "mcq" || kind === "matching" || kind === "gap-box") {
      const g = keyOf(givenStr);
      givenDisplay = g ? displayKey(g) : "";
      acceptedDisplay = accepted.map((a) => displayKey(keyOf(a)));
      correct = !!g && accepted.map(keyOf).includes(g);
    } else {
      const r = isGapCorrect(givenStr, accepted, group);
      correct = r.correct;
      overLimit = r.overLimit;
    }

    items.push({
      n: q.n,
      kind,
      correct,
      given: givenDisplay,
      expected: acceptedDisplay[0] ?? "",
      accepted: acceptedDisplay,
      explanation: q.explanation,
      ...(overLimit ? { overLimit } : {}),
    });
  }
  return items;
}

/** Grade a whole test, or only one part of it (practice mode). */
export function gradeTest(test: ExamTest, answers: ExamAnswers, partIndex?: number): GradeResult {
  const parts = partIndex == null ? test.parts : test.parts.slice(partIndex, partIndex + 1);
  const groups: ExamGroup[] = parts.flatMap((p) => p.groups as ExamGroup[]);
  return gradeGroups(groups, answers);
}

export function gradeGroups(groups: ExamGroup[], answers: ExamAnswers): GradeResult {
  const items = groups.flatMap((g) => gradeGroup(g, answers)).sort((a, b) => a.n - b.n);
  const byKind: GradeResult["byKind"] = {};
  for (const it of items) {
    const k = byKind[it.kind] ?? { correct: 0, total: 0 };
    k.total += 1;
    if (it.correct) k.correct += 1;
    byKind[it.kind] = k;
  }
  return {
    correct: items.filter((i) => i.correct).length,
    total: items.length,
    answered: items.filter((i) => i.given.trim().length > 0).length,
    items,
    byKind,
  };
}

/**
 * Keep only answers for questions that exist in the graded scope, trimmed and
 * length-capped — what gets stored with the attempt.
 */
export function sanitizeAnswers(groups: ExamGroup[], raw: unknown): ExamAnswers {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: ExamAnswers = {};
  for (const g of groups) {
    if (g.kind === "mcq-multi") {
      const first = g.questions[0]?.n;
      if (first == null) continue;
      const v = src[String(first)];
      const arr = (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [])
        .map((x) => String(x).trim().slice(0, 8))
        .filter(Boolean)
        .slice(0, g.questions.length);
      if (arr.length) out[String(first)] = arr;
      continue;
    }
    for (const q of g.questions) {
      const v = src[String(q.n)];
      if (typeof v === "string" && v.trim()) out[String(q.n)] = v.trim().slice(0, 120);
    }
  }
  return out;
}
