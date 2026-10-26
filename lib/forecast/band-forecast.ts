/**
 * Band forecast — pure, deterministic, runs on the server and in the browser.
 *
 * "Where am I now, and when could I reach my target?" per IELTS skill and
 * overall, from the student's own dated band results. Honest by design: every
 * number comes with a range and a sample size, and no forecast is shown without
 * enough evidence.
 *
 * Model (per skill, results of the last 120 days):
 * - Recency-weighted linear trend of band vs time; weight halves every 30 days.
 * - Slope clamped to [−0.25, +0.5] band per 30 days. Learning rarely moves
 *   faster than half a band a month — a steeper fit is usually one lucky (or
 *   unlucky) paper. The what-if never pushes past the same +0.5 cap.
 * - "Now" = the fitted line at today. Uncertainty = weighted residual SD
 *   (at least 0.25 band) × (1 + 1/√n), so a handful of results gives a wide
 *   range that narrows as evidence builds up. Ranges are floored / ceiled to
 *   half bands, so they never look tighter than the data supports.
 * - Rules: < 2 results → "need-data"; results less than 7 days apart →
 *   "too-early"; slope ≤ 0 → "flat" (no date promised, advice instead).
 * - Path: the day the fitted line reaches the target (target − 0.25, the point
 *   that IELTS rounds to the target), within 365 days, with an earliest–latest
 *   window from the uncertainty.
 * - What-if: extra sessions per skill a week speed the slope up with
 *   diminishing returns: × (1 + 0.15 × extra), at most × 1.6 — an estimate.
 * - Overall: the IELTS rule (mean of the four half-band skill scores, .25 up
 *   to .5 and .75 up to the next whole band), only when all four skills have
 *   a forecast.
 */

import { SKILLS, SKILL_LABEL, XP_CONFIG, type SkillKey } from "@/lib/engine/progression/config";
import { overallBand, roundBand } from "@/lib/ielts/bands";

export const FORECAST = {
  windowDays: 120,
  halfLifeDays: 30,
  minResults: 2,
  minSpreadDays: 7,
  /** Band per 30 days. */
  slopeCap: { min: -0.25, max: 0.5 },
  minSd: 0.25,
  horizonDays: 365,
  /** Pace = sessions per week over this many days. */
  paceDays: 28,
  whatIf: { perSession: 0.15, maxMultiplier: 1.6, options: [0, 1, 2, 3] as const },
  /** Reading / Listening attempts shorter than one part are drills, not band evidence. */
  minQuestions: 10,
} as const;

const DAY = 86_400_000;
/** Tashkent is UTC+5 all year (no DST). */
const TZ_OFFSET = 5 * 3_600_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One dated band result the forecast may use. */
export interface ForecastResult {
  skill: SkillKey;
  band: number;
  at: number;
}

/** Everything the server knows (serialisable — passed to client cards). */
export interface ForecastInput {
  results: ForecastResult[];
  targetBand: number;
  now: number;
  /** Tashkent calendar day of `now`, "YYYY-MM-DD". */
  todayKey: string;
  /** Sessions per week over the last 4 weeks, per skill (all practice, not only full results). */
  pace: Record<SkillKey, number>;
}

export interface ForecastOptions {
  /** "YYYY-MM-DD" exam date (device preference), or null. */
  examDate?: string | null;
  /** Extra practice sessions per skill a week (what-if). */
  extraPerWeek?: number;
}

export type SkillStatus = "need-data" | "too-early" | "flat" | "rising";

export interface ForecastPath {
  days: number;
  /** "YYYY-MM-DD" */
  date: string;
  earliest: string;
  /** null = later than a year. */
  latest: string | null;
  /** null when no exam date is set. */
  beforeExam: boolean | null;
}

export interface SkillForecast {
  skill: SkillKey;
  label: string;
  status: SkillStatus;
  /** Results used (last 120 days). */
  n: number;
  points: { at: number; band: number }[];
  /** Fitted level today, 0–9 (null for need-data). */
  now: number | null;
  /** IELTS-rounded `now`. */
  nowBand: number | null;
  range: [number, number] | null;
  uncertainty: number | null;
  /** Fitted slope, band per 30 days (clamped); null without a trend. */
  slope30: number | null;
  /** Slope after the what-if multiplier (still capped). */
  effectiveSlope30: number | null;
  trend: "up" | "flat" | "down" | null;
  reached: boolean;
  path: ForecastPath | null;
  /** More results needed (need-data). */
  needed: number;
  /** too-early: the first day a new result makes a trend possible. */
  readyOn: string | null;
  /** One honest line for this skill. */
  message: string;
  href: string;
  pace: number;
}

export interface OverallForecast {
  now: number;
  range: [number, number];
  reached: boolean;
  path: ForecastPath | null;
}

export interface BandForecast {
  targetBand: number;
  todayKey: string;
  skills: SkillForecast[];
  /** Only when all four skills have a forecast (flat or rising). */
  overall: OverallForecast | null;
  /** Skills still missing a forecast. */
  missing: SkillForecast[];
  totalResults: number;
  extraPerWeek: number;
  multiplier: number;
  examDate: string | null;
  examDays: number | null;
  /** Sessions per week across all skills. */
  pace: number;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const band9 = (x: number) => clamp(x, 0, 9);
/** Down / up to a half band (a tiny epsilon keeps 6.4999999 from dropping to 6.0). */
export const floorHalf = (x: number) => Math.floor(x * 2 + 1e-9) / 2;
export const ceilHalf = (x: number) => Math.ceil(x * 2 - 1e-9) / 2;

export const dayKeyOf = (ms: number) => new Date(ms + TZ_OFFSET).toISOString().slice(0, 10);
export const addDays = (key: string, n: number) =>
  new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
const isDayKey = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`));

/** "15 December" (with the year when it isn't this year's). */
export function formatDay(key: string, todayKey?: string): string {
  const d = new Date(`${key}T12:00:00Z`);
  const sameYear = !todayKey || todayKey.slice(0, 4) === key.slice(0, 4);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" });
}

/** "5 days" · "3 weeks" · "4 months". */
export function durationText(days: number): string {
  const d = Math.max(0, Math.round(days));
  if (d < 14) return `${d} day${d === 1 ? "" : "s"}`;
  if (d < 60) {
    const w = Math.round(d / 7);
    return `${w} week${w === 1 ? "" : "s"}`;
  }
  const m = Math.round(d / 30);
  return `${m} month${m === 1 ? "" : "s"}`;
}

export const formatBand = (b: number) => b.toFixed(1);

/** The pace multiplier for N extra sessions a week (diminishing returns, capped). */
export function paceMultiplier(extraPerWeek: number): number {
  const extra = Math.max(0, Number.isFinite(extraPerWeek) ? extraPerWeek : 0);
  return Math.min(FORECAST.whatIf.maxMultiplier, 1 + FORECAST.whatIf.perSession * extra);
}

/** IELTS overall band from four skill bands (each rounded to a half band first). */
export function overallFromSkills(bands: number[]): number {
  return overallBand(bands.map((b) => roundBand(b)));
}

// ---------------------------------------------------------------------------
// Evidence (which results count)
// ---------------------------------------------------------------------------

export interface EvidenceItem {
  skill: SkillKey;
  band: number;
  at: number;
  contentKey?: string | null;
  /** Questions on the paper (Reading / Listening). */
  questions?: number | null;
  words?: number | null;
  seconds?: number | null;
  task?: "task1" | "task2" | null;
}

/**
 * A full-ish attempt: the same minimums the XP rules treat as real work. A
 * 3-question drill or a 40-word essay is practice, not band evidence. Unknown
 * sizes (older rows) are kept.
 */
export function isFullAttempt(e: EvidenceItem): boolean {
  if (!SKILLS.includes(e.skill) || !(e.band > 0 && e.band <= 9) || !Number.isFinite(e.at)) return false;
  if (e.skill === "READING" || e.skill === "LISTENING") return e.questions == null || e.questions >= FORECAST.minQuestions;
  if (e.skill === "WRITING") {
    const min = XP_CONFIG.writing[e.task === "task1" ? "task1" : "task2"].minWords;
    return e.words == null || e.words >= min;
  }
  return (e.seconds == null || e.seconds >= XP_CONFIG.speaking.minSeconds) && (e.words == null || e.words >= XP_CONFIG.speaking.minWords);
}

/**
 * Results the forecast reasons over: full-ish attempts, and only the FIRST
 * attempt of any paper / prompt — a retake of the same content is inflated by
 * memory and would draw a fake upward trend.
 */
export function selectForecastResults(items: EvidenceItem[]): ForecastResult[] {
  const seen = new Set<string>();
  return [...items]
    .sort((a, b) => a.at - b.at)
    .filter((e) => {
      if (!isFullAttempt(e)) return false;
      if (e.contentKey) {
        const key = `${e.skill}:${e.contentKey}`;
        if (seen.has(key)) return false;
        seen.add(key);
      }
      return true;
    })
    .map(({ skill, band, at }) => ({ skill, band, at }));
}

/** Sessions per week per skill over the last 4 weeks (one decimal). */
export function paceFromSessions(sessions: { skill: SkillKey; at: number }[], now: number): Record<SkillKey, number> {
  const since = now - FORECAST.paceDays * DAY;
  const counts: Record<SkillKey, number> = { READING: 0, LISTENING: 0, WRITING: 0, SPEAKING: 0 };
  for (const s of sessions) if (SKILLS.includes(s.skill) && s.at > since && s.at <= now) counts[s.skill]++;
  const weeks = FORECAST.paceDays / 7;
  for (const k of SKILLS) counts[k] = Math.round((counts[k] / weeks) * 10) / 10;
  return counts;
}

// ---------------------------------------------------------------------------
// Copy (English student UI)
// ---------------------------------------------------------------------------

const PRACTICE_HREF: Record<SkillKey, string> = {
  READING: "/learning/reading",
  LISTENING: "/learning/listening",
  WRITING: "/learning/writing",
  SPEAKING: "/learning/speaking",
};

function moreText(skill: SkillKey, n: number, more: boolean): string {
  const m = more ? " more" : "";
  if (skill === "READING") return `Take ${n}${m} Reading test${n === 1 ? "" : "s"}`;
  if (skill === "LISTENING") return `Take ${n}${m} Listening test${n === 1 ? "" : "s"}`;
  if (skill === "WRITING") return `Write ${n}${m} essay${n === 1 ? "" : "s"}`;
  return `Do ${n}${m} Speaking practice${n === 1 ? "" : "s"}`;
}

const FLAT_ADVICE: Record<SkillKey, string> = {
  READING: "Review every wrong answer by question type before the next paper.",
  LISTENING: "Replay the parts you missed with the transcript.",
  WRITING: "Rewrite one essay using its feedback.",
  SPEAKING: "Record a full Part 2 answer and listen back.",
};

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

interface Fit {
  now: number;
  slope30: number;
  sd: number;
}

/** Recency-weighted fit; `trend = false` fits a level only (slope 0). */
function weightedFit(points: { t: number; b: number }[], trend: boolean): Fit {
  let W = 0;
  let tw = 0;
  let bw = 0;
  const ws = points.map((p) => Math.pow(2, p.t / FORECAST.halfLifeDays));
  points.forEach((p, i) => {
    W += ws[i];
    tw += ws[i] * p.t;
    bw += ws[i] * p.b;
  });
  const tm = tw / W;
  const bm = bw / W;
  let slopeDay = 0;
  if (trend) {
    let sxx = 0;
    let sxy = 0;
    points.forEach((p, i) => {
      sxx += ws[i] * (p.t - tm) ** 2;
      sxy += ws[i] * (p.t - tm) * (p.b - bm);
    });
    const raw30 = sxx > 1e-9 ? (sxy / sxx) * 30 : 0;
    // Float dust from identical results is "no trend", not a rise.
    slopeDay = Math.abs(raw30) < 1e-9 ? 0 : clamp(raw30, FORECAST.slopeCap.min, FORECAST.slopeCap.max) / 30;
  }
  let rss = 0;
  points.forEach((p, i) => {
    rss += ws[i] * (p.b - (bm + slopeDay * (p.t - tm))) ** 2;
  });
  return { now: band9(bm - slopeDay * tm), slope30: slopeDay * 30, sd: Math.sqrt(rss / W) };
}

function pathFor(
  now: number,
  u: number,
  slope30: number,
  threshold: number,
  todayKey: string,
  examDate: string | null
): ForecastPath | null {
  if (slope30 <= 0) return null;
  const perDay = slope30 / 30;
  const days = Math.max(1, Math.ceil((threshold - now) / perDay - 1e-9));
  if (days > FORECAST.horizonDays) return null;
  const earliest = Math.max(0, Math.ceil((threshold - (now + u)) / perDay - 1e-9));
  const latestDays = Math.ceil((threshold - (now - u)) / perDay - 1e-9);
  const date = addDays(todayKey, days);
  return {
    days,
    date,
    earliest: addDays(todayKey, earliest),
    latest: latestDays <= FORECAST.horizonDays ? addDays(todayKey, latestDays) : null,
    beforeExam: examDate ? daysBetween(date, examDate) >= 0 : null,
  };
}

function skillForecast(
  skill: SkillKey,
  input: ForecastInput,
  multiplier: number,
  examDate: string | null
): SkillForecast {
  const label = SKILL_LABEL[skill];
  const since = input.now - FORECAST.windowDays * DAY;
  const rows = input.results
    .filter((r) => r.skill === skill && r.band > 0 && r.band <= 9 && r.at >= since && r.at <= input.now)
    .sort((a, b) => a.at - b.at || a.band - b.band);
  const n = rows.length;
  const base = {
    skill,
    label,
    n,
    points: rows.map((r) => ({ at: r.at, band: r.band })),
    href: PRACTICE_HREF[skill],
    pace: input.pace?.[skill] ?? 0,
  };
  const empty = {
    now: null,
    nowBand: null,
    range: null,
    uncertainty: null,
    slope30: null,
    effectiveSlope30: null,
    trend: null,
    reached: false,
    path: null,
    needed: 0,
    readyOn: null,
  };

  if (n < FORECAST.minResults) {
    const needed = FORECAST.minResults - n;
    return { ...base, ...empty, status: "need-data", needed, message: `${moreText(skill, needed, n > 0)} to see your forecast.` };
  }

  const pts = rows.map((r) => ({ t: (r.at - input.now) / DAY, b: r.band }));
  const firstDay = dayKeyOf(rows[0].at);
  const spread = daysBetween(firstDay, dayKeyOf(rows[n - 1].at));
  const threshold = input.targetBand - 0.25;
  const level = (fit: Fit) => {
    const u = Math.max(FORECAST.minSd, fit.sd) * (1 + 1 / Math.sqrt(n));
    const range: [number, number] = [floorHalf(band9(fit.now - u)), ceilHalf(band9(fit.now + u))];
    return { now: fit.now, nowBand: roundBand(fit.now), range, uncertainty: u, reached: fit.now >= threshold };
  };

  if (spread < FORECAST.minSpreadDays) {
    const readyOn = addDays(firstDay, FORECAST.minSpreadDays);
    return {
      ...base,
      ...empty,
      ...level(weightedFit(pts, false)),
      status: "too-early",
      readyOn,
      message: `Your ${label} results are all from the same week. Practise again from ${formatDay(readyOn, input.todayKey)} to see a trend.`,
    };
  }

  const fit = weightedFit(pts, true);
  const lv = level(fit);
  const trend = fit.slope30 > 0.05 ? "up" : fit.slope30 < -0.05 ? "down" : "flat";
  if (fit.slope30 <= 0) {
    return {
      ...base,
      ...empty,
      ...lv,
      slope30: fit.slope30,
      effectiveSlope30: fit.slope30,
      trend,
      status: "flat",
      message: lv.reached
        ? `Around your target — keep ${label} steady.`
        : `No upward trend in ${label} yet. ${FLAT_ADVICE[skill]}`,
    };
  }

  const eff = Math.min(FORECAST.slopeCap.max, fit.slope30 * multiplier);
  const path = lv.reached ? null : pathFor(fit.now, lv.uncertainty, eff, threshold, input.todayKey, examDate);
  const perMonth = eff < 0.05 ? "under +0.05 a month" : `+${eff.toFixed(2).replace(/0$/, "")} a month`;
  let message: string;
  if (lv.reached) message = `Around your target — keep ${label} steady.`;
  else if (path) message = `Rising about ${perMonth}: ${formatBand(input.targetBand)} by ${formatDay(path.date, input.todayKey)}.`;
  else message = `Rising slowly (${perMonth}) — more than a year to ${formatBand(input.targetBand)} at this pace.`;
  return { ...base, ...empty, ...lv, slope30: fit.slope30, effectiveSlope30: eff, trend, status: "rising", path, message };
}

/** Overall path: first day the IELTS overall of the projected skills reaches the target. */
function overallPath(skills: SkillForecast[], target: number, todayKey: string, examDate: string | null): ForecastPath | null {
  const at = (d: number, k: -1 | 0 | 1) =>
    overallFromSkills(
      skills.map((s) => band9((s.now ?? 0) + k * (s.uncertainty ?? 0) + (s.status === "rising" ? ((s.effectiveSlope30 ?? 0) / 30) * d : 0)))
    );
  const first = (k: -1 | 0 | 1, from: number) => {
    for (let d = from; d <= FORECAST.horizonDays; d++) if (at(d, k) >= target) return d;
    return null;
  };
  const days = first(0, 1);
  if (days == null) return null;
  const earliest = first(1, 0) ?? days;
  const latest = first(-1, days);
  const date = addDays(todayKey, days);
  return {
    days,
    date,
    earliest: addDays(todayKey, Math.min(earliest, days)),
    latest: latest == null ? null : addDays(todayKey, latest),
    beforeExam: examDate ? daysBetween(date, examDate) >= 0 : null,
  };
}

/** The whole forecast for one student (deterministic for the same input and options). */
export function bandForecast(input: ForecastInput, options: ForecastOptions = {}): BandForecast {
  const extra = Math.max(0, Math.round(Number(options.extraPerWeek) || 0));
  const multiplier = paceMultiplier(extra);
  const examDays = isDayKey(options.examDate) ? daysBetween(input.todayKey, options.examDate) : null;
  const examDate = examDays != null && examDays >= 0 ? (options.examDate as string) : null;
  const skills = SKILLS.map((s) => skillForecast(s, input, multiplier, examDate));
  const missing = skills.filter((s) => s.status === "need-data" || s.status === "too-early");

  let overall: OverallForecast | null = null;
  if (!missing.length) {
    const now = overallFromSkills(skills.map((s) => s.nowBand ?? 0));
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const range: [number, number] = [
      floorHalf(mean(skills.map((s) => s.range![0]))),
      ceilHalf(mean(skills.map((s) => s.range![1]))),
    ];
    const reached = now >= input.targetBand;
    overall = { now, range, reached, path: reached ? null : overallPath(skills, input.targetBand, input.todayKey, examDate) };
  }

  return {
    targetBand: input.targetBand,
    todayKey: input.todayKey,
    skills,
    overall,
    missing,
    totalResults: skills.reduce((a, s) => a + s.n, 0),
    extraPerWeek: extra,
    multiplier,
    examDate,
    examDays: examDate ? examDays : null,
    pace: Math.round(SKILLS.reduce((a, s) => a + (input.pace?.[s] ?? 0), 0) * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Sentences the cards share
// ---------------------------------------------------------------------------

/** "at this pace 7.0 by 15 December" · "around your target" · an honest status. */
export function overallLine(f: BandForecast): string {
  const target = formatBand(f.targetBand);
  if (!f.overall) {
    const first = f.missing[0];
    return first ? first.message : "Your forecast needs more results.";
  }
  if (f.overall.reached) return "Around your target — keep it steady.";
  if (f.overall.path) return `At this pace ${target} by ${formatDay(f.overall.path.date, f.todayKey)}.`;
  return `No date for ${target} at this pace yet — the weakest skill is where the next gains are.`;
}

/** The exam half of the story: "Exam in 42 days — on track." */
export function examLine(f: BandForecast): string | null {
  if (f.examDays == null || !f.examDate) return null;
  const when = f.examDays === 0 ? "Exam today" : `Exam in ${f.examDays} day${f.examDays === 1 ? "" : "s"}`;
  const path = f.overall?.path;
  if (f.overall?.reached) return `${when} — around your target already.`;
  if (!path) return `${when}.`;
  if (path.beforeExam) return `${when} — on track to reach it first.`;
  return `${when} — at this pace about ${durationText(daysBetween(f.examDate, path.date))} after it.`;
}

/** What the what-if control changed, for the visible line and the live region. */
export function describeWhatIf(current: BandForecast, base: BandForecast): string {
  if (current.extraPerWeek === 0) return "At your current pace. Add sessions to see how much sooner.";
  const label = `With ${current.extraPerWeek} extra session${current.extraPerWeek === 1 ? "" : "s"} per skill a week`;
  const target = formatBand(current.targetBand);
  const sooner = (b: ForecastPath | null, c: ForecastPath | null) =>
    !c ? "" : !b ? " — within a year instead of later" : b.days > c.days ? ` — ${durationText(b.days - c.days)} sooner` : " — no change yet";
  if (current.overall?.reached) return `${label}: you are around your target already.`;
  if (current.overall?.path) {
    return `${label}: ${target} by ${formatDay(current.overall.path.date, current.todayKey)}${sooner(base.overall?.path ?? null, current.overall.path)} (estimate).`;
  }
  const moved = current.skills
    .filter((s) => s.path)
    .map((s) => {
      const b = base.skills.find((x) => x.skill === s.skill)?.path ?? null;
      return `${s.label} by ${formatDay(s.path!.date, current.todayKey)}${sooner(b, s.path)}`;
    });
  if (moved.length) return `${label}: ${moved.join("; ")} (estimate).`;
  return `${label}: no date yet — there is no upward trend to speed up.`;
}
