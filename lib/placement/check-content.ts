/**
 * Offline check of the placement test content and scoring.
 *
 * Runs the exam-v2 validators (lib/ielts/validate) on the Listening part and
 * the Reading passage, checks the Grammar & Vocabulary items (30 items, 5–6
 * per level A1 → C1, four options, one key, a one-line explanation), grades
 * every section with its own key (must score 100 %) and blank (must score 0),
 * and sanity-checks the scoring (monotonic, perfect → C1, blank → A1).
 *
 * Pure (no database): compile with tsc and run with node, e.g.
 *   /projects/sandbox/check-placement.sh
 */

import { gradeGroups, gradeTest } from "../ielts/grading";
import { estimateListeningMinutes, partWordCount, questionCount, scriptWordCount } from "../ielts/format";
import { validateGroup, validateListeningTest, validateReadingTest, type ValidationReport } from "../ielts/validate";
import type { ExamAnswers, ExamTest } from "../ielts/types";
import { CEFR_LEVELS, GV_TOPICS, type PlacementForm } from "./types";
import { CURRENT_FORM_ID, PLACEMENT_FORMS, getPlacementForm } from "./content";
import { GV_THRESHOLDS } from "./config";
import {
  capWritingBand,
  grammarGroups,
  grammarLevel,
  objectiveBand,
  scoreGrammar,
  scoreObjective,
  scoreWriting,
  skippedWriting,
  summarize,
  type SectionResults,
} from "./scoring";

function keyAnswers(test: ExamTest): ExamAnswers {
  const a: ExamAnswers = {};
  for (const p of test.parts) {
    for (const g of p.groups) {
      if (g.kind === "mcq-multi") {
        a[String(g.questions[0].n)] = [...g.questions[0].answer];
        continue;
      }
      for (const q of g.questions) a[String(q.n)] = q.answer[0].replace(/[()]/g, "");
    }
  }
  return a;
}

/** Answers where only the first `k` questions (in number order) are right. */
function firstRight(test: ExamTest, k: number): ExamAnswers {
  const all = keyAnswers(test);
  const out: ExamAnswers = {};
  Object.keys(all)
    .map(Number)
    .sort((a, b) => a - b)
    .slice(0, k)
    .forEach((n) => (out[String(n)] = all[String(n)]));
  return out;
}

export function checkPlacementContent(): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  let ok = true;
  const show = (label: string, r: ValidationReport, extra: string) => {
    if (r.errors.length) ok = false;
    lines.push(`${r.errors.length ? "✗" : "✓"} ${label} — ${extra}`);
    r.errors.forEach((e) => lines.push(`    ERROR   ${e}`));
    r.warnings.forEach((w) => lines.push(`    warning ${w}`));
  };

  if (!getPlacementForm(CURRENT_FORM_ID)) {
    ok = false;
    lines.push(`✗ CURRENT_FORM_ID "${CURRENT_FORM_ID}" is not in PLACEMENT_FORMS`);
  }
  const ids = new Set<string>();
  for (const form of PLACEMENT_FORMS) {
    if (ids.has(form.id)) {
      ok = false;
      lines.push(`✗ duplicate form id ${form.id}`);
    }
    ids.add(form.id);
    checkGrammar(form, show);
    checkListening(form, show);
    checkReading(form, show);
    checkWriting(form, show);
    checkScoring(form, show, lines);
  }
  lines.push(ok ? "\nPASSED" : "\nFAILED — fix every ERROR above");
  return { ok, lines };
}

type Show = (label: string, r: ValidationReport, extra: string) => void;

function checkGrammar(form: PlacementForm, show: Show) {
  const r: ValidationReport = { errors: [], warnings: [] };
  const items = form.grammar;
  if (items.length !== 30) r.errors.push(`expected 30 items, found ${items.length}`);
  items.forEach((it, i) => {
    const at = `item ${it.n}`;
    if (it.n !== i + 1) r.errors.push(`${at}: numbers must run 1, 2, 3 … (found ${it.n} at position ${i + 1})`);
    if (!CEFR_LEVELS.includes(it.level)) r.errors.push(`${at}: unknown level ${String(it.level)}`);
    if (i > 0 && CEFR_LEVELS.indexOf(it.level) < CEFR_LEVELS.indexOf(items[i - 1].level)) r.errors.push(`${at}: levels must rise A1 → C1`);
    if (!GV_TOPICS.includes(it.topic)) r.errors.push(`${at}: unknown topic ${String(it.topic)}`);
    if (!it.text.includes("_____")) r.errors.push(`${at}: the sentence needs a "_____" gap`);
    const keys = it.options.map((o) => o.key).join("");
    if (keys !== "ABCD") r.errors.push(`${at}: options must be A, B, C, D (found ${keys})`);
    if (new Set(it.options.map((o) => o.text.trim().toLowerCase())).size !== it.options.length) r.errors.push(`${at}: duplicate options`);
    if (!it.options.some((o) => o.key === it.answer)) r.errors.push(`${at}: the answer "${it.answer}" is not an option`);
    const e = (it.explanation ?? "").trim();
    if (!e) r.errors.push(`${at}: missing explanation`);
    else if (/\n/.test(e) || e.length > 170) r.errors.push(`${at}: the explanation must be one short line (${e.length} chars)`);
  });
  for (const level of CEFR_LEVELS) {
    const count = items.filter((it) => it.level === level).length;
    if (count < 5 || count > 6) r.errors.push(`${level}: needs 5–6 items (found ${count})`);
  }
  const missingTopics = GV_TOPICS.filter((t) => !items.some((it) => it.topic === t));
  if (missingTopics.length) r.warnings.push(`topics not covered: ${missingTopics.join(", ")}`);
  const letters = ["A", "B", "C", "D"].map((k) => items.filter((it) => it.answer === k).length);
  if (letters.some((c) => c < items.length * 0.15 || c > items.length * 0.4)) r.warnings.push(`unbalanced answer letters A–D: ${letters.join("/")}`);
  const groups = grammarGroups(items);
  groups.forEach((g, i) => validateGroup(g, { where: `Grammar part ${i + 1}`, skill: "READING", source: "" }, r));
  const key: ExamAnswers = {};
  items.forEach((it) => (key[String(it.n)] = it.answer));
  const perfect = gradeGroups(groups, key);
  const blank = gradeGroups(groups, {});
  if (perfect.correct !== perfect.total || blank.correct !== 0) r.errors.push(`self-grading scored ${perfect.correct}/${perfect.total} (blank ${blank.correct})`);
  const perLevel = CEFR_LEVELS.map((l) => `${l} ${items.filter((it) => it.level === l).length}`).join(", ");
  show(`${form.id} Grammar & Vocabulary`, r, `${items.length} items (${perLevel}) · answers A–D ${letters.join("/")}`);
}

function checkListening(form: PlacementForm, show: Show) {
  const t = form.listening;
  const r = validateListeningTest(t);
  if (t.parts.length !== 1) r.errors.push(`the placement Listening has exactly 1 part (found ${t.parts.length})`);
  if (questionCount(t) !== 10) r.errors.push(`the placement Listening has 10 questions (found ${questionCount(t)})`);
  const kinds = new Set(t.parts.flatMap((p) => p.groups.map((g) => g.kind)));
  if (!kinds.has("gap") || !kinds.has("mcq")) r.errors.push("Listening needs form/notes completion (gap) and multiple choice (mcq)");
  const perfect = gradeTest(t, keyAnswers(t));
  const blank = gradeTest(t, {});
  if (perfect.correct !== perfect.total || blank.correct !== 0) r.errors.push(`self-grading scored ${perfect.correct}/${perfect.total} (blank ${blank.correct})`);
  const words = t.parts.map((p) => scriptWordCount(p.script)).join("/");
  show(`${form.id} Listening "${t.title}"`, r, `${questionCount(t)} questions · script ${words} words · ≈${estimateListeningMinutes(t)} min · kinds ${[...kinds].join(", ")}`);
}

function checkReading(form: PlacementForm, show: Show) {
  const t = form.reading;
  const r = validateReadingTest(t);
  // A placement passage is deliberately shorter than an IELTS passage.
  r.warnings = r.warnings.filter((w) => !/passage is short/.test(w));
  if (t.parts.length !== 1) r.errors.push(`the placement Reading has exactly 1 passage (found ${t.parts.length})`);
  const words = t.parts[0] ? partWordCount(t.parts[0]) : 0;
  if (words < 450 || words > 550) r.errors.push(`the passage should be 450–550 words (found ${words})`);
  const n = questionCount(t);
  if (n < 10 || n > 12) r.errors.push(`10–12 questions expected (found ${n})`);
  const kinds = new Set(t.parts.flatMap((p) => p.groups.map((g) => g.kind)));
  for (const k of ["tfng", "mcq", "gap"] as const) if (!kinds.has(k)) r.errors.push(`Reading needs a "${k}" group`);
  if (t.timeLimit !== 15) r.warnings.push(`timeLimit is ${t.timeLimit} (the brief says 15 minutes)`);
  const perfect = gradeTest(t, keyAnswers(t));
  const blank = gradeTest(t, {});
  if (perfect.correct !== perfect.total || blank.correct !== 0) r.errors.push(`self-grading scored ${perfect.correct}/${perfect.total} (blank ${blank.correct})`);
  show(`${form.id} Reading "${t.parts[0]?.title ?? t.title}"`, r, `${n} questions · ${words} words · ${t.timeLimit} min · kinds ${[...kinds].join(", ")}`);
}

function checkWriting(form: PlacementForm, show: Show) {
  const w = form.writing;
  const r: ValidationReport = { errors: [], warnings: [] };
  if (!w.id || !w.title || (w.prompt ?? "").length < 60) r.errors.push("missing id / title / prompt");
  if (w.minWords !== 120 || w.maxWords !== 150) r.warnings.push(`word target is ${w.minWords}–${w.maxWords} (the brief says 120–150)`);
  if (!Array.isArray(w.tips) || w.tips.length < 3) r.errors.push("needs 3+ tips");
  show(`${form.id} Writing "${w.title}"`, r, `${w.minWords}–${w.maxWords} words`);
}

function checkScoring(form: PlacementForm, show: Show, lines: string[]) {
  const r: ValidationReport = { errors: [], warnings: [] };
  const meta = { auto: false, submittedAt: new Date(0).toISOString() };
  const items = form.grammar;
  const key: ExamAnswers = {};
  items.forEach((it) => (key[String(it.n)] = it.answer));
  const firstK = (k: number): ExamAnswers => {
    const a: ExamAnswers = {};
    items.slice(0, k).forEach((it) => (a[String(it.n)] = it.answer));
    return a;
  };

  // Grammar & Vocabulary: more right answers never lower the level.
  let prev = -1;
  const table: string[] = [];
  for (let k = 0; k <= items.length; k++) {
    const g = grammarLevel(k, items.length);
    if (g.index < prev) r.errors.push(`G&V index drops at ${k}/${items.length}`);
    prev = g.index;
    if (k === 0 || grammarLevel(k - 1, items.length).cefr !== g.cefr) table.push(`${k}+ → ${g.cefr}`);
  }
  const expected = [...GV_THRESHOLDS].sort((a, b) => a.min - b.min).map((t) => `${t.min}+ → ${t.cefr}`);
  if (table.join(", ") !== expected.join(", ")) r.errors.push(`G&V thresholds resolve to ${table.join(", ")} (config: ${expected.join(", ")})`);

  const L = form.listening;
  const R = form.reading;
  const run = (gv: ExamAnswers, l: ExamAnswers, rd: ExamAnswers, writing: number | null): SectionResults => ({
    GRAMMAR: scoreGrammar(items, gv, meta),
    LISTENING: scoreObjective("LISTENING", gradeTest(L, l), meta),
    READING: scoreObjective("READING", gradeTest(R, rd), meta),
    WRITING:
      writing == null
        ? skippedWriting({ ...meta, blank: false })
        : scoreWriting({ band: capWritingBand(writing, 140, "ai"), words: 140, assessedBy: "ai", feedback: [], essay: "…" }, meta),
  });
  const scenarios: { name: string; sections: SectionResults; expect?: string }[] = [
    { name: "everything right, Writing 8.0", sections: run(key, keyAnswers(L), keyAnswers(R), 8), expect: "C1" },
    { name: "everything blank, Writing skipped", sections: run({}, {}, {}, null), expect: "A1" },
    { name: "typical A2 (G&V 11, L 3/10, R 3/12, no Writing)", sections: run(firstK(11), firstRight(L, 3), firstRight(R, 3), null) },
    { name: "typical B1 (G&V 18, L 6/10, R 6/12, W 5.0)", sections: run(firstK(18), firstRight(L, 6), firstRight(R, 6), 5) },
    { name: "typical B2 (G&V 23, L 8/10, R 9/12, W 6.0)", sections: run(firstK(23), firstRight(L, 8), firstRight(R, 9), 6) },
    { name: "Listening audio failed (G&V 18, L blank, R 6/12)", sections: run(firstK(18), {}, firstRight(R, 6), null) },
  ];
  const out: string[] = [];
  for (const s of scenarios) {
    const sum = summarize(items, s.sections);
    if (s.expect && sum.cefr !== s.expect) r.errors.push(`${s.name}: expected ${s.expect}, got ${sum.cefr}`);
    if (sum.band > 7.5 || sum.band < 2) r.errors.push(`${s.name}: band ${sum.band} is outside 2.0–7.5`);
    const parts = (["GRAMMAR", "LISTENING", "READING", "WRITING"] as const)
      .map((k) => {
        const x = s.sections[k];
        if (!x) return `${k[0]} –`;
        return `${k[0]} ${x.scored ? `${x.cefr}/${x.band.toFixed(1)}` : "not counted"}`;
      })
      .join(" · ");
    out.push(`    ${s.name}: ${sum.level} → ${sum.recommendation.label} [${parts}; index ${sum.index}]`);
    out.push(`      study first: ${sum.studyFirst.map((l) => l.href).join(", ")} · review ${sum.review.length} · strengths ${sum.strengths.length} · weaknesses ${sum.weaknesses.length}`);
  }
  // Listening / Reading conversion tables as the student will meet them.
  const conv = (section: "LISTENING" | "READING", total: number) =>
    Array.from({ length: total + 1 }, (_, k) => `${k}:${objectiveBand(section, k, total).toFixed(1)}`).join(" ");
  out.push(`    Listening /${questionCount(L)}: ${conv("LISTENING", questionCount(L))}`);
  out.push(`    Reading /${questionCount(R)}: ${conv("READING", questionCount(R))}`);
  show(`${form.id} scoring`, r, `G&V ${table.join(", ")}`);
  lines.push(...out);
}
