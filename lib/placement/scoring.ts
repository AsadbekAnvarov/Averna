/**
 * Placement test scoring — pure and deterministic (server + offline check).
 *
 *   Grammar & Vocabulary  raw /30 → CEFR by the thresholds in config.ts, plus a
 *                         continuous index inside the level (B1 with 18/30 = 3.4).
 *   Listening / Reading   raw → IELTS band with the official tables (scaled to
 *                         40; Listening −1 band for a Part 1-style recording,
 *                         Reading on the General Training table), capped for
 *                         short sections → index.
 *   Writing               examiner / heuristic band, capped → index.
 *   Overall               weighted mean of the indexes (G&V 40 %, R 25 %, L 25 %,
 *                         W 10 % when taken; renormalised) → CEFR + an IELTS
 *                         estimate kept inside that level's band range. When
 *                         Listening has no answer at all it doesn't count, and
 *                         the overall is then at most the lower of the G&V and
 *                         Reading levels (a blank never lifts it; Writing never
 *                         sets that ceiling) and at least what every Listening
 *                         answer wrong would give (a blank never sinks it).
 *
 * Every rule and number lives in config.ts.
 */

import { listeningBand, readingBand, roundBand } from "../ielts/bands";
import { gradeGroups } from "../ielts/grading";
import type { ExamAnswers, ExamGroup, GradeResult } from "../ielts/types";
import {
  BAND_CAP,
  BAND_INDEX_ANCHORS,
  BLANK_LISTENING_CEILING,
  CEFR_BAND_RANGE,
  GV_SCALE,
  GV_THRESHOLDS,
  HEURISTIC_WRITING_CAP,
  LISTENING_BAND_OFFSET,
  OVERALL_BAND_RANGE,
  READING_TABLE,
  SECTION_LIBRARY,
  SECTION_TITLE,
  SECTION_WEIGHTS,
  STANDOUT_GAP,
  TOPIC_LABEL,
  VOCABULARY_TOPICS,
  WRITING_LENGTH_CAPS,
  recommendationLabel,
  recommendationRule,
  studentLevelLabel,
} from "./config";
import {
  CEFR_LEVELS,
  GV_TOPICS,
  PLACEMENT_SECTIONS,
  type Cefr,
  type CorrectTotal,
  type GvItem,
  type GvTopic,
  type PlacementSection,
  type PlacementSectionResult,
  type PlacementSummary,
  type ReviewPoint,
  type StudyLink,
  type WritingCriteria,
} from "./types";

export type SectionResults = Partial<Record<PlacementSection, PlacementSectionResult>>;

export const CEFR_INDEX: Record<Cefr, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 };

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round2 = (x: number) => Math.round(x * 100) / 100;

/** The CEFR level of a continuous index (never above C1: the test has no C2 items). */
export function indexToCefr(index: number): Cefr {
  const v = Number.isFinite(index) ? index : 1;
  let out: Cefr = "A1";
  for (const c of CEFR_LEVELS) if (v >= CEFR_INDEX[c]) out = c;
  return out;
}

function piecewise(x: number, points: [number, number][]): number {
  if (!Number.isFinite(x) || x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return points[points.length - 1][1];
}

export function bandToIndex(band: number): number {
  return round2(piecewise(clamp(band, 0, 9), BAND_INDEX_ANCHORS));
}

export function indexToBand(index: number): number {
  return piecewise(index, BAND_INDEX_ANCHORS.map(([band, idx]): [number, number] => [idx, band]));
}

/** Round DOWN to the half band — an estimate from a short test should never overstate. */
export function floorHalf(x: number): number {
  return Math.floor(x * 2 + 1e-9) / 2;
}

/** An IELTS estimate for an index, kept inside its CEFR level's band range. */
export function estimateBand(index: number): number {
  const [lo, hi] = CEFR_BAND_RANGE[indexToCefr(index)];
  const band = clamp(floorHalf(indexToBand(index)), lo, hi);
  return clamp(band, OVERALL_BAND_RANGE.min, OVERALL_BAND_RANGE.max);
}

export function countWords(text: string): number {
  const t = String(text ?? "").trim();
  return t ? t.split(/\s+/).length : 0;
}

// ---------------------------------------------------------------------------
// Grammar & Vocabulary
// ---------------------------------------------------------------------------

/** Items per page of the Grammar & Vocabulary runner (and per mcq group). */
export const GV_PART_SIZE = 10;

/** The items as exam-v2 mcq groups of 10 (graded with lib/ielts/grading; sanitised for the browser). */
export function grammarGroups(items: GvItem[]): ExamGroup[] {
  const groups: ExamGroup[] = [];
  for (let i = 0; i < items.length; i += GV_PART_SIZE) {
    groups.push({
      kind: "mcq",
      instructions: "Choose the word or phrase that best completes each sentence.",
      questions: items.slice(i, i + GV_PART_SIZE).map((it) => ({
        n: it.n,
        text: it.text,
        options: it.options.map((o) => ({ key: o.key, text: o.text })),
        answer: [it.answer],
        explanation: it.explanation,
      })),
    });
  }
  return groups;
}

/** Raw score → CEFR + a continuous index inside that level (e.g. 18/30 → B1, 3.4). */
export function grammarLevel(correct: number, total: number): { cefr: Cefr; index: number } {
  const raw = total > 0 ? (clamp(correct, 0, total) / total) * GV_SCALE : 0;
  const rows = [...GV_THRESHOLDS].sort((a, b) => b.min - a.min);
  for (let i = 0; i < rows.length; i++) {
    if (raw < rows[i].min) continue;
    const upper = i === 0 ? GV_SCALE + 1 : rows[i - 1].min;
    const within = clamp((raw - rows[i].min) / Math.max(1, upper - rows[i].min), 0, 0.99);
    return { cefr: rows[i].cefr, index: round2(CEFR_INDEX[rows[i].cefr] + within) };
  }
  return { cefr: "A1", index: 1 };
}

interface Meta {
  auto: boolean;
  submittedAt: string;
}

export function scoreGrammar(items: GvItem[], answers: ExamAnswers, meta: Meta): PlacementSectionResult {
  const grade = gradeGroups(grammarGroups(items), answers);
  const right = new Set(grade.items.filter((i) => i.correct).map((i) => i.n));
  const byLevel: Partial<Record<Cefr, CorrectTotal>> = {};
  const byTopic: Partial<Record<GvTopic, CorrectTotal>> = {};
  const missed: number[] = [];
  const bump = <K extends string>(map: Partial<Record<K, CorrectTotal>>, k: K, ok: boolean) => {
    const row = map[k] ?? { correct: 0, total: 0 };
    row.total += 1;
    if (ok) row.correct += 1;
    map[k] = row;
  };
  for (const it of items) {
    const ok = right.has(it.n);
    bump(byLevel, it.level, ok);
    bump(byTopic, it.topic, ok);
    if (!ok) missed.push(it.n);
  }
  const { cefr, index } = grammarLevel(grade.correct, grade.total);
  return {
    section: "GRAMMAR",
    cefr,
    index,
    band: estimateBand(index),
    correct: grade.correct,
    total: grade.total,
    answered: grade.answered,
    scored: true,
    ...(grade.answered === 0 ? { blank: true } : {}),
    ...(meta.auto ? { auto: true } : {}),
    byLevel,
    byTopic,
    missed,
    submittedAt: meta.submittedAt,
  };
}

// ---------------------------------------------------------------------------
// Listening / Reading
// ---------------------------------------------------------------------------

/** Raw score → IELTS band: scaled to 40 with the official tables, calibrated for a short section, capped. */
export function objectiveBand(section: "LISTENING" | "READING", correct: number, total: number): number {
  const raw =
    section === "LISTENING"
      ? listeningBand(correct, total) + LISTENING_BAND_OFFSET
      : readingBand(correct, total, READING_TABLE);
  return clamp(raw, 0, BAND_CAP[section]);
}

export function scoreObjective(section: "LISTENING" | "READING", grade: GradeResult, meta: Meta): PlacementSectionResult {
  const band = objectiveBand(section, grade.correct, grade.total);
  const index = bandToIndex(band);
  const blank = grade.answered === 0;
  return {
    section,
    cefr: indexToCefr(index),
    index,
    band,
    correct: grade.correct,
    total: grade.total,
    answered: grade.answered,
    // Not a single Listening answer almost always means the audio didn't play on
    // this device — it is flagged for the teacher instead of lowering the level.
    scored: !(section === "LISTENING" && blank),
    ...(blank ? { blank: true } : {}),
    ...(meta.auto ? { auto: true } : {}),
    submittedAt: meta.submittedAt,
  };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** IELTS-rounded, then capped for the sample's length and for automatic estimates. */
export function capWritingBand(raw: number, words: number, assessedBy: "ai" | "heuristic"): number {
  let cap = BAND_CAP.WRITING;
  if (assessedBy === "heuristic") cap = Math.min(cap, HEURISTIC_WRITING_CAP);
  const byLength = [...WRITING_LENGTH_CAPS].sort((a, b) => a.under - b.under).find((l) => words < l.under);
  if (byLength) cap = Math.min(cap, byLength.cap);
  return clamp(roundBand(Number.isFinite(raw) ? raw : 0), 0, cap);
}

export function scoreWriting(
  input: { band: number; words: number; assessedBy: "ai" | "heuristic"; criteria?: WritingCriteria; feedback: string[]; essay: string },
  meta: Meta
): PlacementSectionResult {
  const index = bandToIndex(input.band);
  return {
    section: "WRITING",
    cefr: indexToCefr(index),
    index,
    band: input.band,
    words: input.words,
    assessedBy: input.assessedBy,
    ...(input.criteria ? { criteria: input.criteria } : {}),
    feedback: input.feedback,
    essay: input.essay,
    scored: true,
    ...(meta.auto ? { auto: true } : {}),
    submittedAt: meta.submittedAt,
  };
}

/** Writing is optional: a skipped (or empty) section doesn't count toward the level. */
export function skippedWriting(meta: Meta & { blank: boolean }): PlacementSectionResult {
  return {
    section: "WRITING",
    cefr: "A1",
    index: 1,
    band: 0,
    scored: false,
    skipped: true,
    ...(meta.blank ? { blank: true } : {}),
    ...(meta.auto ? { auto: true } : {}),
    submittedAt: meta.submittedAt,
  };
}

// ---------------------------------------------------------------------------
// Overall level + recommendation + what to study
// ---------------------------------------------------------------------------

/** Listening was taken but has no answer at all, so it doesn't count (see scoreObjective). */
export function listeningNotAssessed(sections: SectionResults): boolean {
  return !!sections.LISTENING && !sections.LISTENING.scored;
}

export function overallLevel(sections: SectionResults): {
  index: number;
  cefr: Cefr;
  band: number;
  weights: Partial<Record<PlacementSection, number>>;
  /** The blank-Listening ceiling lowered the level. */
  capped: boolean;
} {
  const counted = PLACEMENT_SECTIONS.filter((s) => {
    const r = sections[s];
    return !!r && r.scored && Number.isFinite(r.index);
  });
  const total = counted.reduce((sum, s) => sum + SECTION_WEIGHTS[s], 0);
  const weights: Partial<Record<PlacementSection, number>> = {};
  let acc = 0;
  for (const s of counted) {
    weights[s] = round2(SECTION_WEIGHTS[s] / total);
    acc += SECTION_WEIGHTS[s] * (sections[s] as PlacementSectionResult).index;
  }
  let index = total > 0 ? round2(acc / total) : 1;
  // Without Listening the other sections are renormalised — but leaving it blank must neither lift
  // the level nor sink it (config BLANK_LISTENING_CEILING): at most the lower of the Grammar &
  // Vocabulary and Reading levels (never Writing — optional, and capped by length), and at least the
  // weighted mean with every Listening answer wrong, so a blank never places lower than guessing.
  let capped = false;
  const listening = sections.LISTENING;
  const core = BLANK_LISTENING_CEILING.map((s) => sections[s]).filter(
    (r): r is PlacementSectionResult => !!r && r.scored && Number.isFinite(r.index)
  );
  if (listening && listeningNotAssessed(sections) && core.length) {
    const ceiling = round2(Math.min(...core.map((r) => CEFR_INDEX[r.cefr])) + 0.99);
    const allWrong = bandToIndex(objectiveBand("LISTENING", 0, listening.total ?? 0));
    const floor = round2((acc + SECTION_WEIGHTS.LISTENING * allWrong) / (total + SECTION_WEIGHTS.LISTENING));
    const bounded = Math.max(Math.min(index, ceiling), floor);
    if (bounded < index) {
      index = bounded;
      capped = true;
    }
  }
  return { index, cefr: indexToCefr(index), band: estimateBand(index), weights, capped };
}

export function sectionScoreText(r: PlacementSectionResult): string {
  if (r.section === "GRAMMAR") return `${r.correct ?? 0} of ${r.total ?? 0} correct`;
  if (r.section === "WRITING") return `band ${r.band.toFixed(1)}`;
  return `${r.correct ?? 0} of ${r.total ?? 0} correct, band ${r.band.toFixed(1)}`;
}

const GRAMMAR_GUIDE = "/grammar";
const FLASHCARDS = "/flashcards";

export function summarize(items: GvItem[], sections: SectionResults): PlacementSummary {
  const overall = overallLevel(sections);
  const rule = recommendationRule(overall.cefr);
  const counted = PLACEMENT_SECTIONS.map((s) => sections[s]).filter((r): r is PlacementSectionResult => !!r && r.scored);

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // 1. Sections that stand out from the overall level.
  const behind: PlacementSectionResult[] = [];
  for (const r of counted) {
    const gap = r.index - overall.index;
    if (gap >= STANDOUT_GAP) strengths.push(`${SECTION_TITLE[r.section]} is ahead of your other skills (${sectionScoreText(r)}, ${r.cefr}).`);
    else if (gap <= -STANDOUT_GAP) {
      weaknesses.push(`${SECTION_TITLE[r.section]} is behind your other skills (${sectionScoreText(r)}, ${r.cefr}).`);
      behind.push(r);
    }
  }
  if (counted.length > 1 && counted.every((r) => !r.blank) && !strengths.length && !behind.length) {
    strengths.push("Your skills are at a similar level — none is far behind the others.");
  }

  // 2. Grammar & Vocabulary topics. A gap is a missed item AT OR BELOW the student's
  //    level (missing a C1 item is no weakness for a B1 learner — it's the next step).
  const level = CEFR_INDEX[overall.cefr];
  const byN = new Map(items.map((it) => [it.n, it]));
  const gv = sections.GRAMMAR;
  const missedSet = new Set(gv?.missed ?? []);
  const topicRows = gv
    ? GV_TOPICS.map((topic) => {
        const pool = items.filter((it) => it.topic === topic && CEFR_INDEX[it.level] <= level);
        const missed = pool.filter((it) => missedSet.has(it.n));
        return { topic, total: pool.length, missed: missed.length, lowest: Math.min(9, ...missed.map((it) => CEFR_INDEX[it.level])) };
      }).filter((t) => t.total > 0)
    : [];
  const gapTopics = topicRows
    .filter((t) => t.missed > 0)
    .sort((a, b) => b.missed / b.total - a.missed / a.total || a.lowest - b.lowest)
    .slice(0, 3);
  const strongTopics = topicRows.filter((t) => t.missed === 0 && t.total >= 2).slice(0, 2);
  for (const t of strongTopics) strengths.push(`${TOPIC_LABEL[t.topic]} — every question at your level was right.`);
  for (const t of gapTopics) {
    weaknesses.push(`${TOPIC_LABEL[t.topic]} — you missed ${t.missed} of ${t.total} question${t.total === 1 ? "" : "s"} at your level.`);
  }
  const missedItems = [...missedSet]
    .map((n) => byN.get(n))
    .filter((it): it is GvItem => !!it)
    .sort((a, b) => CEFR_INDEX[a.level] - CEFR_INDEX[b.level] || a.n - b.n);
  const nextTopics = missedItems.filter((it) => CEFR_INDEX[it.level] === level + 1).map((it) => it.topic);

  // 3. What to study first: the skill that is behind, then the weak topics, then level defaults.
  const links: StudyLink[] = [];
  const add = (l: StudyLink) => {
    if (links.length < 3 && !links.some((x) => x.href === l.href)) links.push(l);
  };
  const weakest = [...behind].sort((a, b) => a.index - b.index)[0];
  if (weakest) {
    add({
      label: weakest.section === "GRAMMAR" ? "Grammar guide" : `${SECTION_TITLE[weakest.section]} practice`,
      href: SECTION_LIBRARY[weakest.section],
      reason: `${SECTION_TITLE[weakest.section]} (${sectionScoreText(weakest)}) is your lowest section.`,
    });
  }
  const gapGrammar = gapTopics.find((t) => !VOCABULARY_TOPICS.includes(t.topic))?.topic;
  const gapVocab = gapTopics.find((t) => VOCABULARY_TOPICS.includes(t.topic))?.topic;
  const nextGrammar = nextTopics.find((t) => !VOCABULARY_TOPICS.includes(t));
  const nextVocab = nextTopics.find((t) => VOCABULARY_TOPICS.includes(t));
  if (gapGrammar) add({ label: "Grammar guide", href: GRAMMAR_GUIDE, reason: `Start with ${TOPIC_LABEL[gapGrammar].toLowerCase()}.` });
  if (gapVocab) add({ label: "Vocabulary flashcards", href: FLASHCARDS, reason: `Build your ${TOPIC_LABEL[gapVocab].toLowerCase()}.` });
  if (!gapGrammar && nextGrammar) {
    add({ label: "Grammar guide", href: GRAMMAR_GUIDE, reason: `Your next step: ${TOPIC_LABEL[nextGrammar].toLowerCase()}.` });
  }
  if (!gapVocab && nextVocab) {
    add({ label: "Vocabulary flashcards", href: FLASHCARDS, reason: `Your next step: ${TOPIC_LABEL[nextVocab].toLowerCase()}.` });
  }
  if (sections.LISTENING && !sections.LISTENING.scored) {
    add({
      label: "Listening practice",
      href: SECTION_LIBRARY.LISTENING,
      reason: "No Listening answers were recorded — try a practice part to check that audio plays on your device.",
    });
  }
  if (sections.WRITING?.skipped) {
    add({ label: "Writing practice", href: SECTION_LIBRARY.WRITING, reason: "You skipped Writing — a short practice task shows how you write." });
  }
  if (CEFR_INDEX[overall.cefr] <= 2) {
    add({ label: "Grammar guide", href: GRAMMAR_GUIDE, reason: "The essentials of English grammar, with examples." });
    add({ label: "Vocabulary flashcards", href: FLASHCARDS, reason: "Everyday words, a few minutes a day." });
  } else {
    add({ label: "Reading practice", href: SECTION_LIBRARY.READING, reason: "One IELTS passage at a time, with answers explained." });
    add({ label: "Listening practice", href: SECTION_LIBRARY.LISTENING, reason: "Short IELTS parts with the recording played once." });
  }

  // 4. The rules behind missed items: gaps (at or below the level) first, then the
  //    next level up — one per topic, easiest first. Never the items or their keys.
  const review: ReviewPoint[] = [];
  const seen = new Set<GvTopic>();
  for (const it of missedItems) {
    const idx = CEFR_INDEX[it.level];
    if (review.length >= 5 || seen.has(it.topic) || idx > level + 1) continue;
    seen.add(it.topic);
    review.push({ topic: it.topic, level: it.level, text: it.explanation, kind: idx <= level ? "gap" : "next" });
  }

  return {
    cefr: overall.cefr,
    index: overall.index,
    band: overall.band,
    level: studentLevelLabel(overall.cefr),
    ...(listeningNotAssessed(sections) ? { listeningNotAssessed: true } : {}),
    ...(overall.capped ? { capped: true } : {}),
    recommendation: { key: rule.key, course: rule.course, ...(rule.target ? { target: rule.target } : {}), label: recommendationLabel(rule) },
    weights: overall.weights,
    strengths,
    weaknesses,
    studyFirst: links,
    review,
  };
}
