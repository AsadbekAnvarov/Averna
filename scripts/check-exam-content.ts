/**
 * Validate the hand-written exam content (lib/ielts/content).
 *
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/check-exam-content.ts
 *
 * Runs the same validators the AI generator uses (full exam shape, numbering,
 * answer keys, word limits, answers present in the passage/script), then grades
 * every test with its own answer key (must score 100%) and with blank answers
 * (must score 0). Exits 1 on any error.
 */
import { LISTENING_SEED, READING_SEED, SPEAKING_SEED, WRITING_SEED } from "../lib/ielts/content";
import { validateListeningTest, validateReadingTest, validateSpeakingSet } from "../lib/ielts/validate";
import { gradeTest } from "../lib/ielts/grading";
import { partWordCount, scriptWordCount, questionCount } from "../lib/ielts/format";
import type { ExamAnswers, ExamTest } from "../lib/ielts/types";

declare const process: { exit(code: number): never };

let failed = false;

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

function selfGrade(test: ExamTest) {
  const perfect = gradeTest(test, keyAnswers(test));
  const blank = gradeTest(test, {});
  const ok = perfect.correct === perfect.total && blank.correct === 0;
  if (!ok) failed = true;
  return `${ok ? "grading ok" : "GRADING MISMATCH"} (${perfect.correct}/${perfect.total})`;
}

function report(label: string, r: { errors: string[]; warnings: string[] }, extra: string) {
  if (r.errors.length) failed = true;
  console.log(`${r.errors.length ? "✗" : "✓"} ${label} — ${extra}`);
  r.errors.forEach((e) => console.log(`    ERROR   ${e}`));
  r.warnings.forEach((w) => console.log(`    warning ${w}`));
}

const ids = new Set<string>();
const checkId = (id: string) => {
  if (ids.has(id)) {
    failed = true;
    console.log(`✗ duplicate id ${id}`);
  }
  ids.add(id);
};

for (const t of READING_SEED) {
  checkId(t.id);
  const words = t.parts.map(partWordCount).join("/");
  report(`Reading ${t.id} "${t.title}"`, validateReadingTest(t, { requireFull: true }), `${questionCount(t)} q · words ${words} · ${selfGrade(t)}`);
}
for (const t of LISTENING_SEED) {
  checkId(t.id);
  const words = t.parts.map((p) => scriptWordCount(p.script)).join("/");
  report(`Listening ${t.id} "${t.title}"`, validateListeningTest(t, { requireFull: true }), `${questionCount(t)} q · words ${words} · ${selfGrade(t)}`);
}
for (const s of SPEAKING_SEED) {
  checkId(s.id);
  report(`Speaking ${s.id} "${s.title}"`, validateSpeakingSet(s), `${s.part1.length} P1 topics · P3 ${s.part3.questions.length} q`);
}
for (const task of ["task1", "task2"] as const) {
  for (const w of WRITING_SEED[task]) {
    checkId(w.id);
    const errors: string[] = [];
    if (!w.prompt || w.prompt.length < 40) errors.push("prompt too short");
    if (task === "task1" && !w.chart?.length && !w.imageUrl) errors.push("Task 1 needs chart data or an image");
    if (!w.sampleAnswer || w.sampleAnswer.split(/\s+/).length < (task === "task1" ? 150 : 250)) errors.push("sample answer below the IELTS word target");
    if (!w.usefulPhrases?.length || !w.strategyEn || !w.strategyUz) errors.push("missing phrases or strategy");
    report(`Writing ${task} ${w.id}`, { errors, warnings: [] }, w.title);
  }
}

console.log(
  `\n${READING_SEED.length} reading · ${LISTENING_SEED.length} listening · ${SPEAKING_SEED.length} speaking · ${WRITING_SEED.task1.length + WRITING_SEED.task2.length} writing`
);
if (failed) {
  console.log("\nContent check FAILED");
  process.exit(1);
}
console.log("\nContent check passed");
