import {
  ALL_SKILLS,
  ALL_STYLES,
  BAND_SKILLS,
  CONSISTENCY_WINDOW_DAYS,
  DAY_MS,
  DAYPARTS,
  DURATION_BANDS,
  LADDERS,
  MIN_DAYPARTS_COMPARED,
  MIN_DAYPART_ADVANTAGE,
  MIN_EVENTS_PER_STYLE,
  MIN_FATIGUE_DROP,
  MIN_MISTAKE_OCCURRENCES,
  MIN_MOTIVATION_SHIFT,
  MIN_PRIMING_SESSIONS,
  MIN_SESSIONS_PER_BAND,
  MIN_SESSIONS_PER_DAYPART,
  MIN_STYLE_MARGIN,
  SKILL_LABEL,
  STYLE_CHANNELS,
  STYLE_LABEL,
  TREND_WINDOW_DAYS,
  mistakeFix,
  mistakeLabel,
} from "./config";
import type { DnaSignals } from "./signals";
import type {
  Confidence,
  DnaCoverage,
  DnaDaypart,
  DnaDaypartPerf,
  DnaDurationBand,
  DnaEvent,
  DnaFocusProfile,
  DnaGrowth,
  DnaLearningSpeed,
  DnaMistakeCategory,
  DnaMotivation,
  DnaScore,
  DnaSequencing,
  DnaSkillMetric,
  DnaStyleProfile,
  DnaStyleScore,
  DnaTimingProfile,
  SkillKey,
  SkillStatus,
  Trend,
} from "./types";

/**
 * Learning DNA Engine — the metric layer.
 *
 * Every function here is PURE: it takes collected signals and returns numbers.
 * No database, no clock reads beyond `signals.now`, no randomness. That purity is
 * deliberate — it means the same behaviour always produces the same profile, the
 * maths can be reviewed in isolation, and re-processing history with an improved
 * formula is a safe, offline operation.
 *
 * Two rules are enforced throughout:
 *
 *  1. A METRIC IS NEVER INVENTED. When evidence is below the metric's ladder
 *     (config.ts), the value is withheld as `null` with `confidence:
 *     "insufficient"` rather than shown as a plausible-looking default. On a
 *     premium dashboard a rendered number reads as a fact.
 *
 *  2. A DIFFERENCE MUST CLEAR AN EFFECT-SIZE GATE. "Your evenings are better"
 *     requires both enough sessions per bucket AND a gap large enough to matter.
 *     Without that, the engine would confidently report noise — which is how
 *     personalisation systems lose a user's trust permanently.
 */

// ---------------------------------------------------------------------------
// Small statistics toolkit
// ---------------------------------------------------------------------------

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function stdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values)!;
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Pearson correlation. Returns null when either series has no variation. */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = mean(xs.slice(0, n))!;
  const my = mean(ys.slice(0, n))!;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Grade a sample size against a named ladder. */
export function confidenceFor(n: number, ladderKey: string): Confidence {
  const ladder = LADDERS[ladderKey] ?? { low: 5, medium: 15, high: 40 };
  if (n >= ladder.high) return "high";
  if (n >= ladder.medium) return "medium";
  if (n >= ladder.low) return "low";
  return "insufficient";
}

/**
 * Build a DnaScore, withholding the value when the evidence doesn't support it.
 * This single function is why no under-evidenced number can reach a dashboard.
 */
export function makeScore(
  value: number | null,
  sampleSize: number,
  ladderKey: string,
  basis: string
): DnaScore {
  const confidence = confidenceFor(sampleSize, ladderKey);
  return {
    value: confidence === "insufficient" || value == null ? null : round(value),
    confidence,
    sampleSize,
    basis,
  };
}

/** One step down the confidence ladder — used when a secondary condition
 *  (e.g. too few duration bands to compare) weakens an otherwise ample sample. */
function demote(confidence: Confidence): Confidence {
  if (confidence === "high") return "medium";
  if (confidence === "medium") return "low";
  if (confidence === "low") return "insufficient";
  return "insufficient";
}

/** Weighted blend that ignores unavailable components and renormalises the
 *  weights, so a partially-observed learner still gets a fair composite. */
function blend(parts: { value: number | null; weight: number }[]): { value: number | null; weight: number } {
  let total = 0;
  let weightSum = 0;
  for (const p of parts) {
    if (p.value == null || !Number.isFinite(p.value)) continue;
    total += p.value * p.weight;
    weightSum += p.weight;
  }
  if (weightSum === 0) return { value: null, weight: 0 };
  return { value: total / weightSum, weight: weightSum };
}

function distinctDays(events: DnaEvent[]): number {
  return new Set(events.map((e) => e.dayKey)).size;
}

function daysAgo(now: number, at: Date): number {
  return Math.floor((now - at.getTime()) / DAY_MS);
}

function within(events: DnaEvent[], now: number, fromDaysAgo: number, toDaysAgo = 0): DnaEvent[] {
  const start = now - fromDaysAgo * DAY_MS;
  const end = now - toDaysAgo * DAY_MS;
  return events.filter((e) => {
    const t = e.at.getTime();
    return t >= start && t < end;
  });
}

function accuracies(events: DnaEvent[]): number[] {
  return events.filter((e) => e.accuracy != null).map((e) => e.accuracy!);
}

// ---------------------------------------------------------------------------
// Coverage — how much the engine actually knows
// ---------------------------------------------------------------------------

/**
 * Coverage is the engine's self-assessment. It is reported to the student ("what
 * I still need") and drives the maturity score, so growing understanding is
 * visible rather than implied.
 */
export function computeCoverage(signals: DnaSignals): DnaCoverage {
  const events = signals.events;
  const kinds = new Set(events.map((e) => e.kind));
  const skills = new Set(events.filter((e) => e.skill != null).map((e) => e.skill!));
  const activeDays = distinctDays(events);

  const first = events.length > 0 ? events[0].at.getTime() : null;
  const historySpanDays = first != null ? Math.max(0, Math.floor((signals.now - first) / DAY_MS)) : 0;

  const volume = clamp((events.length / 40) * 25, 0, 25);
  const variety = clamp((kinds.size / 5) * 20, 0, 20);
  const breadth = clamp((skills.size / 5) * 15, 0, 15);
  const rhythm = clamp((activeDays / 20) * 20, 0, 20);
  const span = clamp((historySpanDays / 45) * 20, 0, 20);

  return {
    events: events.length,
    sensorEvents: signals.sensorCount,
    tests: events.filter((e) => e.kind === "test").length,
    reviews: events.filter((e) => e.kind === "review").length,
    homework: events.filter((e) => e.kind === "homework").length,
    speaking: events.filter((e) => e.kind === "speaking").length,
    focusSessions: events.filter((e) => e.kind === "focus").length,
    checkins: events.filter((e) => e.kind === "checkin").length,
    activeDays,
    historySpanDays,
    skillsTouched: skills.size,
    completeness: round(volume + variety + breadth + rhythm + span),
  };
}

// ---------------------------------------------------------------------------
// Learning style
// ---------------------------------------------------------------------------

/**
 * Which delivery channel actually works best for this learner.
 *
 * Scored as 65% relative performance + 35% relative engagement. Performance
 * dominates on purpose: what a learner *chooses* is a preference, but what
 * produces better results is what a recommendation should be built on. The
 * engagement term stops a single lucky channel from winning outright.
 *
 * A preference is only NAMED when the leading style has real accuracy data, a
 * minimum number of events, and a clear margin over the runner-up. Otherwise the
 * scores are still returned (useful as a distribution) with no claim attached.
 */
export function computeStyle(events: DnaEvent[]): DnaStyleProfile {
  const total = events.length;
  const overall = mean(accuracies(events));

  const scores: DnaStyleScore[] = ALL_STYLES.map((style) => {
    const channels = STYLE_CHANNELS[style];
    const matching = events.filter((e) => channels.includes(e.channel));
    const acc = mean(accuracies(matching));
    const share = total > 0 ? (matching.length / total) * 100 : 0;

    // Relative performance: +/-0.20 accuracy around this learner's own mean maps
    // to the full 0-100 range, so the comparison is always against themselves.
    const perfComponent =
      acc != null && overall != null ? clamp(50 + (acc - overall) * 250, 0, 100) : 50;
    // Relative engagement: 1.0 = an even split across the five styles.
    const relShare = (share / 100) * ALL_STYLES.length;
    const engComponent = clamp(50 * relShare, 0, 100);

    return {
      style,
      label: STYLE_LABEL[style],
      score: round(0.65 * perfComponent + 0.35 * engComponent),
      accuracy: acc != null ? round(acc * 100) : null,
      share: round(share),
      events: matching.length,
      channels,
    };
  }).sort((a, b) => b.score - a.score);

  const comparable = accuracies(events).length;
  let confidence = confidenceFor(comparable, "style");
  const top = scores[0];
  const runnerUp = scores[1];
  const margin = top && runnerUp ? top.score - runnerUp.score : null;

  const qualifies =
    top != null &&
    top.accuracy != null &&
    top.events >= MIN_EVENTS_PER_STYLE &&
    margin != null &&
    margin >= MIN_STYLE_MARGIN &&
    confidence !== "insufficient";

  // A wafer-thin margin over the runner-up is not a preference, however much
  // data sits behind it — report the scores, withhold the claim.
  if (!qualifies && confidence !== "insufficient" && (margin == null || margin < MIN_STYLE_MARGIN)) {
    confidence = demote(confidence);
  }

  return {
    preferred: qualifies ? top.style : null,
    label: qualifies ? top.label : null,
    confidence: qualifies ? confidence : "insufficient",
    scores,
    margin: margin != null ? round(margin) : null,
    basis: qualifies
      ? `${top.events} sessions of ${top.label.toLowerCase()} activity averaging ${top.accuracy}% accuracy, ${margin} points clear of the next style`
      : `${comparable} scored sessions across ${scores.filter((s) => s.events > 0).length} channels — not yet a clear separation between styles`,
  };
}

// ---------------------------------------------------------------------------
// Focus & fatigue
// ---------------------------------------------------------------------------

/**
 * How long this learner stays effective in one sitting.
 *
 * Accuracy is bucketed by session length, then the engine looks for the peak band
 * and the first band after it where accuracy falls by a meaningful margin. That
 * breakpoint — not an average — is the actionable number: it's the moment a study
 * session stops paying for itself.
 */
export function computeFocus(events: DnaEvent[]): DnaFocusProfile {
  const sessions = events.filter(
    (e) => e.durationMin != null && e.durationMin > 0 && e.accuracy != null
  );

  const bands: DnaDurationBand[] = DURATION_BANDS.map((band) => {
    const inBand = sessions.filter((e) => {
      const d = e.durationMin!;
      return d >= band.fromMin && (band.toMin == null || d < band.toMin);
    });
    const acc = mean(accuracies(inBand));
    return {
      label: band.label,
      fromMin: band.fromMin,
      toMin: band.toMin,
      sessions: inBand.length,
      accuracy: acc != null ? round(acc * 100) : null,
    };
  });

  const medianSessionMin = median(sessions.map((e) => e.durationMin!));
  const corr = pearson(
    sessions.map((e) => e.durationMin!),
    sessions.map((e) => e.accuracy!)
  );

  const reliable = bands.filter((b) => b.sessions >= MIN_SESSIONS_PER_BAND && b.accuracy != null);
  let confidence = confidenceFor(sessions.length, "focus");
  // A fatigue curve drawn through a single length band is a point, not a curve.
  if (reliable.length < 2) confidence = demote(confidence);

  let focusMinutes: number | null = null;
  let fatiguePointMin: number | null = null;
  let idealLessonMin: number | null = null;
  let declinePoints: number | null = null;

  if (reliable.length >= 1 && confidence !== "insufficient") {
    const peak = reliable.reduce((best, b) => (b.accuracy! > best.accuracy! ? b : best));
    const peakIdx = bands.findIndex((b) => b.label === peak.label);
    // Midpoint of the winning band; open-ended top band is represented by a
    // point 15 minutes into it rather than pretending to know its centre.
    const peakMid = round(peak.toMin != null ? (peak.fromMin + peak.toMin) / 2 : peak.fromMin + 15);
    focusMinutes = peakMid;

    for (const b of reliable) {
      const idx = bands.findIndex((x) => x.label === b.label);
      if (idx <= peakIdx) continue;
      const drop = peak.accuracy! - b.accuracy!;
      if (drop >= MIN_FATIGUE_DROP) {
        fatiguePointMin = b.fromMin;
        declinePoints = round(drop);
        break;
      }
    }

    // Ideal sitting: stop before the measured decline, otherwise ride out the
    // peak band. Rounded to 5 minutes because nobody schedules 37 minutes.
    const raw = fatiguePointMin ?? peak.toMin ?? peakMid;
    idealLessonMin = Math.max(10, round(raw / 5) * 5);
  }

  return {
    focusMinutes,
    fatiguePointMin,
    idealLessonMin,
    durationAccuracyCorr: corr != null ? round1(corr * 100) / 100 : null,
    declinePoints,
    bands,
    medianSessionMin: medianSessionMin != null ? round(medianSessionMin) : null,
    confidence,
    sampleSize: sessions.length,
    basis:
      confidence === "insufficient"
        ? `${sessions.length} timed sessions — need more to map a focus curve`
        : `${sessions.length} timed sessions grouped into ${reliable.length} comparable length bands`,
  };
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

function daypartOf(hour: number): DnaDaypart {
  for (const def of DAYPARTS) {
    if (def.fromHour < def.toHour) {
      if (hour >= def.fromHour && hour < def.toHour) return def.key;
    } else if (hour >= def.fromHour || hour < def.toHour) {
      // The late-night band wraps past midnight.
      return def.key;
    }
  }
  return "afternoon";
}

/**
 * When this learner performs best.
 *
 * Compares mean accuracy across the five dayparts. The claim requires: enough
 * sessions in the winning bucket, at least two buckets to compare, and an
 * advantage over the others large enough to be worth acting on. Study-time advice
 * built on two sessions would be worse than no advice at all.
 */
export function computeTiming(events: DnaEvent[]): DnaTimingProfile {
  const total = events.length;

  const dayparts: DnaDaypartPerf[] = DAYPARTS.map((def) => {
    const all = events.filter((e) => daypartOf(e.hour) === def.key);
    const scored = all.filter((e) => e.accuracy != null);
    const acc = mean(accuracies(scored));
    return {
      daypart: def.key,
      label: def.label,
      fromHour: def.fromHour,
      toHour: def.toHour,
      sessions: scored.length,
      accuracy: acc != null ? round(acc * 100) : null,
      share: total > 0 ? round((all.length / total) * 100) : 0,
    };
  });

  const scoredTotal = accuracies(events).length;
  let confidence = confidenceFor(scoredTotal, "timing");

  const eligible = dayparts.filter(
    (d) => d.sessions >= MIN_SESSIONS_PER_DAYPART && d.accuracy != null
  );

  let optimalDaypart: DnaDaypart | null = null;
  let optimalLabel: string | null = null;
  let optimalHourStart: number | null = null;
  let optimalHourEnd: number | null = null;
  let advantagePoints: number | null = null;
  let worstDaypart: DnaDaypart | null = null;

  if (eligible.length >= MIN_DAYPARTS_COMPARED && confidence !== "insufficient") {
    const best = eligible.reduce((hi, d) => (d.accuracy! > hi.accuracy! ? d : hi));
    const worst = eligible.reduce((lo, d) => (d.accuracy! < lo.accuracy! ? d : lo));
    const others = eligible.filter((d) => d.daypart !== best.daypart);
    // Session-weighted rest average, so one sparse bucket can't manufacture a gap.
    const restSessions = others.reduce((s, d) => s + d.sessions, 0);
    const restAcc =
      restSessions > 0
        ? others.reduce((s, d) => s + d.accuracy! * d.sessions, 0) / restSessions
        : null;

    if (restAcc != null && best.accuracy! - restAcc >= MIN_DAYPART_ADVANTAGE) {
      optimalDaypart = best.daypart;
      optimalLabel = best.label;
      optimalHourStart = best.fromHour;
      optimalHourEnd = best.toHour;
      advantagePoints = round(best.accuracy! - restAcc);
      worstDaypart = worst.daypart === best.daypart ? null : worst.daypart;
    } else {
      confidence = demote(confidence);
    }
  } else if (eligible.length < MIN_DAYPARTS_COMPARED) {
    confidence = demote(confidence);
  }

  // Weekdays the learner reliably shows up on: at least three appearances and
  // above their own average — a scheduling signal, not a performance one.
  const byWeekday = new Map<number, number>();
  for (const e of events) byWeekday.set(e.weekday, (byWeekday.get(e.weekday) ?? 0) + 1);
  const counts = Array.from(byWeekday.values());
  const avgPerWeekday = mean(counts) ?? 0;
  const reliableWeekdays = Array.from(byWeekday.entries())
    .filter(([, n]) => n >= 3 && n >= avgPerWeekday)
    .map(([wd]) => wd)
    .sort((a, b) => a - b);

  return {
    optimalDaypart,
    optimalLabel,
    optimalHourStart,
    optimalHourEnd,
    advantagePoints,
    worstDaypart,
    dayparts,
    reliableWeekdays,
    confidence,
    sampleSize: scoredTotal,
    basis:
      optimalDaypart != null
        ? `${scoredTotal} scored sessions across ${eligible.length} times of day; ${optimalLabel?.toLowerCase()} leads by ${advantagePoints} accuracy points`
        : `${scoredTotal} scored sessions — no time of day is yet clearly ahead of the others`,
  };
}

// ---------------------------------------------------------------------------
// Retention & forgetting
// ---------------------------------------------------------------------------

export interface RetentionResult {
  score: DnaScore;
  memoryHalfLifeDays: number | null;
}

/**
 * How well knowledge sticks, and how fast it fades.
 *
 * Prefers the spaced-repetition ledger, which is the only place the platform
 * observes recall *after* a delay — the one honest measure of retention. Falls
 * back to the forgetting-curve estimate already used by the Memory Timeline, so
 * the two features never disagree.
 */
export function computeRetention(signals: DnaSignals): RetentionResult {
  const reviews = signals.reviews;
  const totalReps = reviews.reduce((s, r) => s + r.reps, 0);
  const totalLapses = reviews.reduce((s, r) => s + r.lapses, 0);
  const lapseRate = totalReps > 0 ? clamp(totalLapses / totalReps, 0, 1) : null;

  const intervalMaturity = mean(reviews.map((r) => clamp(r.interval / 21, 0, 1)));

  const touchedStages = signals.stages.filter((s) => s.sessions > 0);
  const stageRetention = mean(touchedStages.map((s) => s.retention));

  // Half-life from the shared forgetting-curve model: retention = e^(-t/S),
  // so recall halves after S * ln2 days without review.
  const strength = mean(signals.memory.map((m) => m.strengthDays));
  const memoryHalfLifeDays = strength != null ? round1(strength * Math.LN2) : null;

  let value: number | null = null;
  let sampleSize = 0;
  let basis = "";

  if (reviews.length >= 5 && lapseRate != null) {
    value =
      55 * (1 - lapseRate) + 25 * (intervalMaturity ?? 0) + 20 * ((stageRetention ?? 0) / 100);
    sampleSize = totalReps + signals.tests.length;
    basis = `${reviews.length} tracked items, ${totalReps} recall attempts, ${round((1 - lapseRate) * 100)}% recalled successfully`;
  } else if (stageRetention != null) {
    value = stageRetention;
    sampleSize = signals.tests.length;
    basis = `estimated from the forgetting curve across ${touchedStages.length} practised skills (no review history yet)`;
  } else {
    basis = "no recall history yet — review a few items to measure retention";
  }

  return { score: makeScore(value, sampleSize, "retention", basis), memoryHalfLifeDays };
}

// ---------------------------------------------------------------------------
// Learner confidence
// ---------------------------------------------------------------------------

/**
 * How confident this learner is — inferred from behaviour, never from vibes.
 *
 * Four behavioural proxies plus self-reports, blended over whatever is available:
 *  - decisiveness: answering correctly *quickly* signals secure knowledge;
 *  - resilience: a low spaced-repetition lapse rate;
 *  - exposure: choosing speaking, the activity learners avoid when unsure;
 *  - breadth: not avoiding whole skills.
 * A self-reported check-in, when present, outweighs all of them — the learner is
 * the authority on their own confidence.
 */
export function computeLearnerConfidence(signals: DnaSignals): DnaScore {
  const events = signals.events;
  let sampleSize = 0;

  // 1) Self-reported check-ins.
  const reported = events.filter((e) => e.kind === "checkin" && e.confidence != null);
  const selfReported = mean(reported.map((e) => e.confidence! * 100));
  sampleSize += reported.length;

  // 2) Decisiveness: fast *and* correct, relative to this learner's own pace.
  const timed = events.filter(
    (e) => e.accuracy != null && e.durationMin != null && e.durationMin > 0
  );
  let decisiveness: number | null = null;
  if (timed.length >= 4) {
    const med = median(timed.map((e) => e.durationMin!))!;
    const strong = timed.filter((e) => e.accuracy! >= 0.7);
    if (strong.length >= 2) {
      decisiveness = (strong.filter((e) => e.durationMin! <= med).length / strong.length) * 100;
      sampleSize += strong.length;
    }
  }

  // 3) Resilience under recall pressure.
  const totalReps = signals.reviews.reduce((s, r) => s + r.reps, 0);
  const totalLapses = signals.reviews.reduce((s, r) => s + r.lapses, 0);
  const resilience = totalReps >= 5 ? (1 - clamp(totalLapses / totalReps, 0, 1)) * 100 : null;
  if (resilience != null) sampleSize += signals.reviews.length;

  // 4) Voluntary exposure to speaking.
  const recentSpeaking = within(events, signals.now, CONSISTENCY_WINDOW_DAYS).filter(
    (e) => e.kind === "speaking" || e.channel === "speaking" || e.channel === "conversation"
  );
  const exposure = events.length >= 5 ? clamp(recentSpeaking.length / 6, 0, 1) * 100 : null;

  // 5) Breadth: an untouched skill is usually an avoided one.
  const touched = new Set(
    events.filter((e) => e.skill != null && BAND_SKILLS.includes(e.skill!)).map((e) => e.skill!)
  );
  const breadth = events.length >= 5 ? (touched.size / BAND_SKILLS.length) * 100 : null;

  const blended = blend([
    { value: selfReported, weight: 30 },
    { value: decisiveness, weight: 20 },
    { value: resilience, weight: 20 },
    { value: exposure, weight: 20 },
    { value: breadth, weight: 10 },
  ]);

  const components: string[] = [];
  if (selfReported != null) components.push(`${reported.length} self check-ins`);
  if (decisiveness != null) components.push("answer speed on correct answers");
  if (resilience != null) components.push("recall success rate");
  if (exposure != null) components.push(`${recentSpeaking.length} speaking sessions in ${CONSISTENCY_WINDOW_DAYS} days`);
  if (breadth != null) components.push(`${touched.size}/${BAND_SKILLS.length} skills attempted`);

  return makeScore(
    blended.value,
    sampleSize,
    "confidence",
    components.length > 0
      ? `blended from ${components.join(", ")}`
      : "not enough behaviour yet to read confidence"
  );
}

// ---------------------------------------------------------------------------
// Consistency
// ---------------------------------------------------------------------------

/**
 * Consistency = coverage (how many days) x regularity (how evenly spread).
 *
 * Both halves matter: sixteen study days bunched into one week is a burst, not a
 * habit, and bursts predict burnout rather than progress. Sixteen active days in
 * four weeks is treated as full marks for coverage — a realistic ceiling for a
 * student with a life.
 */
export function computeConsistency(signals: DnaSignals): DnaScore {
  const recent = within(signals.events, signals.now, CONSISTENCY_WINDOW_DAYS);
  const activeDays = distinctDays(recent);
  const coverage = clamp(activeDays / 16, 0, 1);

  // Weekly buckets across the window, for evenness.
  const weeks = Math.ceil(CONSISTENCY_WINDOW_DAYS / 7);
  const weekly: number[] = new Array(weeks).fill(0);
  for (const e of recent) {
    const idx = Math.min(weeks - 1, Math.floor((signals.now - e.at.getTime()) / (7 * DAY_MS)));
    weekly[idx] += 1;
  }
  const weeklyMean = mean(weekly);
  const weeklySd = stdev(weekly);
  const regularity =
    weeklyMean != null && weeklyMean > 0 && weeklySd != null
      ? clamp(1 - weeklySd / weeklyMean, 0, 1)
      : null;

  const blended = blend([
    { value: coverage * 100, weight: 70 },
    { value: regularity != null ? regularity * 100 : null, weight: 30 },
  ]);

  const streak = signals.student?.currentStreak ?? 0;
  return makeScore(
    blended.value,
    activeDays,
    "consistency",
    `${activeDays} active days in the last ${CONSISTENCY_WINDOW_DAYS}${
      regularity != null ? `, spread ${round(regularity * 100)}% evenly week to week` : ""
    }${streak > 0 ? `, current streak ${streak}` : ""}`
  );
}

// ---------------------------------------------------------------------------
// Motivation
// ---------------------------------------------------------------------------

/**
 * Motivation is measured as a *change in behaviour*, not a mood.
 *
 * Learning volume in the last fortnight is compared with the fortnight before.
 * The absolute level sets the score; the direction of change sets the trend. A
 * long silence caps the score regardless of past effort, because an inactive
 * learner is the one who needs intervention now.
 */
export function computeMotivation(signals: DnaSignals): DnaMotivation {
  const events = signals.events;
  const recent = within(events, signals.now, TREND_WINDOW_DAYS);
  const previous = within(events, signals.now, TREND_WINDOW_DAYS * 2, TREND_WINDOW_DAYS);

  const recentActiveDays = distinctDays(recent);
  const previousActiveDays = distinctDays(previous);

  const deltaPercent =
    previous.length > 0
      ? round(((recent.length - previous.length) / previous.length) * 100)
      : recent.length > 0
        ? 100
        : null;

  let trend: Trend = "steady";
  if (deltaPercent != null && deltaPercent >= MIN_MOTIVATION_SHIFT) trend = "rising";
  else if (deltaPercent != null && deltaPercent <= -MIN_MOTIVATION_SHIFT) trend = "falling";

  const last = events.length > 0 ? events[events.length - 1].at : null;
  const daysSinceLastActivity = last != null ? daysAgo(signals.now, last) : null;

  // Level: ten active days in a fortnight is a strongly engaged learner.
  const level = clamp(recentActiveDays / 10, 0, 1) * 100;
  const direction = deltaPercent != null ? clamp(50 + deltaPercent / 2, 0, 100) : 50;

  let value = 0.6 * level + 0.4 * direction;
  if (daysSinceLastActivity != null && daysSinceLastActivity >= 14) value = Math.min(value, 20);
  else if (daysSinceLastActivity != null && daysSinceLastActivity >= 7) value = Math.min(value, 35);

  const sampleSize = recent.length + previous.length;

  return {
    score: makeScore(
      value,
      sampleSize,
      "motivation",
      `${recent.length} activities on ${recentActiveDays} days in the last ${TREND_WINDOW_DAYS}, versus ${previous.length} in the ${TREND_WINDOW_DAYS} before`
    ),
    trend,
    deltaPercent,
    recentActiveDays,
    previousActiveDays,
    daysSinceLastActivity,
    basis:
      deltaPercent == null
        ? "no recent activity to compare"
        : `activity ${deltaPercent >= 0 ? "up" : "down"} ${Math.abs(deltaPercent)}% fortnight on fortnight`,
  };
}

// ---------------------------------------------------------------------------
// Learning speed
// ---------------------------------------------------------------------------

/**
 * Band gain per ten *active* days.
 *
 * Normalising by active days rather than calendar days is the point: it separates
 * "learns quickly" from "studies often", which are different traits needing
 * different responses. Endpoints are 3-attempt averages so one outstanding or
 * disastrous paper can't define the trajectory.
 */
export function computeLearningSpeed(signals: DnaSignals): DnaLearningSpeed {
  const tests = signals.tests.filter((t) => t.score > 0);
  const testEvents = signals.events.filter((e) => e.kind === "test");
  const activeDays = distinctDays(testEvents);

  if (tests.length < 2) {
    return {
      score: makeScore(null, tests.length, "speed", "needs at least a few graded attempts"),
      bandsPerTenActiveDays: null,
      label: null,
      totalBandGain: null,
      activeDays,
    };
  }

  const window = Math.min(3, Math.floor(tests.length / 2)) || 1;
  const firstAvg = mean(tests.slice(0, window).map((t) => t.score))!;
  const lastAvg = mean(tests.slice(-window).map((t) => t.score))!;
  const totalBandGain = round1(lastAvg - firstAvg);

  const bandsPerTenActiveDays =
    activeDays >= 2 ? round1((totalBandGain / activeDays) * 10) : null;

  let label: DnaLearningSpeed["label"] = null;
  if (bandsPerTenActiveDays != null) {
    if (bandsPerTenActiveDays >= 0.5) label = "rapid";
    else if (bandsPerTenActiveDays >= 0.2) label = "steady";
    else if (bandsPerTenActiveDays > 0.02) label = "gradual";
    else label = "plateaued";
  }

  const value =
    bandsPerTenActiveDays != null ? clamp(50 + bandsPerTenActiveDays * 80, 0, 100) : null;

  return {
    score: makeScore(
      value,
      tests.length,
      "speed",
      `${totalBandGain >= 0 ? "+" : ""}${totalBandGain} band across ${tests.length} attempts over ${activeDays} active days`
    ),
    bandsPerTenActiveDays,
    label,
    totalBandGain,
    activeDays,
  };
}

// ---------------------------------------------------------------------------
// Revision efficiency
// ---------------------------------------------------------------------------

/**
 * How much durable memory each review buys.
 *
 * Built from the SM-2 ledger: a low lapse rate means reviews are landing, a long
 * interval per repetition means each one buys more time, and graduated items
 * (21+ day intervals) are the ones genuinely moved to long-term memory.
 */
export function computeRevisionEfficiency(signals: DnaSignals): DnaScore {
  const reviews = signals.reviews.filter((r) => r.reps > 0);
  if (reviews.length === 0) {
    return makeScore(null, 0, "revision", "no review history yet");
  }

  const totalReps = reviews.reduce((s, r) => s + r.reps, 0);
  const totalLapses = reviews.reduce((s, r) => s + r.lapses, 0);
  const lapseRate = clamp(totalLapses / Math.max(1, totalReps), 0, 1);
  const intervalPerRep = mean(reviews.map((r) => r.interval / Math.max(1, r.reps))) ?? 0;
  const graduated = reviews.filter((r) => r.interval >= 21).length / reviews.length;

  const value =
    50 * (1 - lapseRate) + 30 * clamp(intervalPerRep / 4, 0, 1) + 20 * graduated;

  return makeScore(
    value,
    reviews.length,
    "revision",
    `${reviews.length} items, ${round((1 - lapseRate) * 100)}% recall success, ${round(graduated * 100)}% moved to long-term intervals`
  );
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

/**
 * Per-skill picture, reusing the Progress Engine's evidence ladder for the four
 * IELTS modules so mastery means exactly what it means everywhere else in
 * Averna. Grammar and Vocabulary have no band, so they are scored from accuracy
 * and volume instead — and labelled honestly as foundations.
 */
export function computeSkills(signals: DnaSignals): DnaSkillMetric[] {
  const now = signals.now;
  const stageBySkill = new Map(signals.stages.map((s) => [s.key as string, s] as const));

  // Retention for the foundations comes from the review ledger they feed.
  const vocabReviews = signals.reviews.filter((r) => r.source !== "mistake");
  const mistakeReviews = signals.reviews.filter((r) => r.source === "mistake");
  const ledgerRetention = (rows: typeof signals.reviews): number | null => {
    const reps = rows.reduce((s, r) => s + r.reps, 0);
    if (reps === 0) return null;
    const lapses = rows.reduce((s, r) => s + r.lapses, 0);
    return clamp(1 - lapses / reps, 0, 1) * 100;
  };

  return ALL_SKILLS.map((key): DnaSkillMetric => {
    const label = SKILL_LABEL[key];
    const skillEvents = signals.events.filter((e) => e.skill === key);
    const acc = mean(accuracies(skillEvents));
    const accuracy = acc != null ? round(acc * 100) : null;
    const stage = stageBySkill.get(key) ?? null;
    const isBandSkill = BAND_SKILLS.includes(key);

    const lastAt = skillEvents.length > 0 ? skillEvents[skillEvents.length - 1].at : null;
    const lastPracticedDaysAgo = lastAt != null ? daysAgo(now, lastAt) : null;

    // Improvement: band delta for the modules, accuracy delta for foundations.
    let improvement: number | null = null;
    if (isBandSkill) {
      const moduleTests = signals.tests.filter((t) => t.module === key && t.score > 0);
      if (moduleTests.length >= 2) {
        const w = Math.min(2, Math.floor(moduleTests.length / 2)) || 1;
        const firstAvg = mean(moduleTests.slice(0, w).map((t) => t.score))!;
        const lastAvg = mean(moduleTests.slice(-w).map((t) => t.score))!;
        improvement = round1(lastAvg - firstAvg);
      }
    } else {
      const scored = skillEvents.filter((e) => e.accuracy != null);
      if (scored.length >= 4) {
        const half = Math.floor(scored.length / 2);
        const firstAvg = mean(accuracies(scored.slice(0, half)))!;
        const lastAvg = mean(accuracies(scored.slice(half)))!;
        // Expressed on the band scale so every skill's velocity is comparable.
        improvement = round1((lastAvg - firstAvg) * 9);
      }
    }

    const skillActiveDays = distinctDays(skillEvents);
    const velocity =
      improvement != null && skillActiveDays >= 2
        ? round1((improvement / skillActiveDays) * 10)
        : null;

    const mastery = stage
      ? stage.mastery
      : accuracy != null
        ? round(0.6 * accuracy + 0.4 * clamp((skillEvents.length / 20) * 100, 0, 100))
        : 0;

    const retention = stage
      ? stage.retention
      : key === "VOCABULARY"
        ? round(ledgerRetention(vocabReviews) ?? 0)
        : key === "GRAMMAR"
          ? round(ledgerRetention(mistakeReviews) ?? 0)
          : 0;

    let status: SkillStatus;
    let reason: string;
    if (skillEvents.length === 0) {
      status = "untouched";
      reason = `No ${label.toLowerCase()} activity recorded yet`;
    } else if (mastery >= 65 || (accuracy != null && accuracy >= 78 && skillEvents.length >= 3)) {
      status = "strength";
      reason = stage
        ? `${stage.stageLabel} with ${stage.sessions} attempts, best band ${stage.bestBand}`
        : `${accuracy}% accuracy across ${skillEvents.length} sessions`;
    } else if (
      (accuracy != null && accuracy < 60 && skillEvents.length >= 2) ||
      (retention > 0 && retention < 50) ||
      (lastPracticedDaysAgo != null && lastPracticedDaysAgo > 21 && mastery >= 25)
    ) {
      status = "needs_reinforcement";
      if (retention > 0 && retention < 50) reason = `Retention has slipped to ${retention}%`;
      else if (lastPracticedDaysAgo != null && lastPracticedDaysAgo > 21)
        reason = `Not practised for ${lastPracticedDaysAgo} days`;
      else reason = `Accuracy sitting at ${accuracy}% over ${skillEvents.length} sessions`;
    } else {
      status = "growing";
      reason = stage
        ? `${stage.stageLabel}, recent average band ${stage.recentAvg}`
        : `${skillEvents.length} sessions recorded${accuracy != null ? ` at ${accuracy}% accuracy` : ""}`;
    }

    return {
      key,
      label,
      events: skillEvents.length,
      accuracy,
      band: stage && stage.recentAvg > 0 ? stage.recentAvg : null,
      bestBand: stage && stage.bestBand > 0 ? stage.bestBand : null,
      stage: stage ? stage.stage : null,
      stageLabel: stage ? stage.stageLabel : null,
      mastery,
      retention,
      improvement,
      velocity,
      lastPracticedDaysAgo,
      status,
      reason,
    };
  });
}

/**
 * How evenly developed the skills are. IELTS rewards balance — an overall band is
 * dragged down by its weakest component — so an untouched module is penalised
 * explicitly rather than just being absent from the spread.
 */
export function computeSkillBalance(skills: DnaSkillMetric[]): DnaScore {
  const bandSkills = skills.filter((s) => BAND_SKILLS.includes(s.key));
  const touched = bandSkills.filter((s) => s.events > 0);
  if (touched.length < 2) {
    return makeScore(null, touched.length, "skill", "practise at least two skills to compare balance");
  }

  const spread = stdev(touched.map((s) => s.mastery)) ?? 0;
  const untouched = bandSkills.length - touched.length;
  const value = clamp(100 - spread * 2 - untouched * 15, 0, 100);

  return makeScore(
    value,
    touched.length,
    "skill",
    `mastery spread of ${round(spread)} points across ${touched.length} practised skills${
      untouched > 0 ? `, ${untouched} not started` : ""
    }`
  );
}

// ---------------------------------------------------------------------------
// Growth dimensions
// ---------------------------------------------------------------------------

export function computeGrowth(signals: DnaSignals): DnaGrowth {
  const events = signals.events;
  const now = signals.now;

  // --- Vocabulary: new items learned recently + how many reached long-term ---
  const recentItems = signals.reviews.filter(
    (r) => now - r.createdAt.getTime() <= CONSISTENCY_WINDOW_DAYS * DAY_MS
  ).length;
  const graduated = signals.reviews.filter((r) => r.interval >= 21).length;
  const graduatedShare = signals.reviews.length > 0 ? graduated / signals.reviews.length : 0;
  const vocabulary = makeScore(
    signals.reviews.length > 0
      ? clamp((recentItems / 40) * 60, 0, 60) + graduatedShare * 40
      : null,
    signals.reviews.length,
    "growth",
    `${recentItems} new items in ${CONSISTENCY_WINDOW_DAYS} days, ${graduated} held in long-term memory`
  );

  // --- Grammar: accuracy on grammar-channel work, weighted by volume ---
  const grammarEvents = events.filter((e) => e.channel === "grammar" || e.skill === "GRAMMAR");
  const grammarAcc = mean(accuracies(grammarEvents));
  const grammar = makeScore(
    grammarAcc != null
      ? 0.7 * grammarAcc * 100 + 0.3 * clamp((grammarEvents.length / 15) * 100, 0, 100)
      : null,
    grammarEvents.filter((e) => e.accuracy != null).length,
    "growth",
    `${grammarEvents.length} grammar sessions${grammarAcc != null ? ` averaging ${round(grammarAcc * 100)}% accuracy` : ""}`
  );

  // --- Speaking confidence: volume, sustained duration and rated quality ---
  const speakingEvents = events.filter(
    (e) => e.skill === "SPEAKING" || e.channel === "speaking" || e.channel === "conversation"
  );
  const speakingMinutes = speakingEvents.reduce((s, e) => s + (e.durationMin ?? 0), 0);
  const speakingAcc = mean(accuracies(speakingEvents));
  const speakingConfidence = makeScore(
    speakingEvents.length > 0
      ? blend([
          { value: clamp((speakingEvents.length / 12) * 100, 0, 100), weight: 40 },
          { value: clamp((speakingMinutes / 90) * 100, 0, 100), weight: 25 },
          { value: speakingAcc != null ? speakingAcc * 100 : null, weight: 35 },
        ]).value
      : null,
    speakingEvents.length,
    "growth",
    `${speakingEvents.length} speaking sessions totalling ${round(speakingMinutes)} minutes`
  );

  // --- Writing complexity: length plus lexical range of produced text ---
  const writingEvents = events.filter(
    (e) => (e.skill === "WRITING" || e.channel === "writing") && e.words != null && e.words > 0
  );
  const avgWords = mean(writingEvents.map((e) => e.words!));
  const avgDiversity = mean(
    writingEvents.filter((e) => e.diversity != null).map((e) => e.diversity!)
  );
  const writingComplexity = makeScore(
    avgWords != null
      ? blend([
          // 280 words is a comfortable Task 2 response.
          { value: clamp((avgWords / 280) * 100, 0, 100), weight: 60 },
          { value: avgDiversity != null ? clamp(avgDiversity * 160, 0, 100) : null, weight: 40 },
        ]).value
      : null,
    writingEvents.length,
    "growth",
    avgWords != null
      ? `${round(avgWords)} words per piece across ${writingEvents.length} submissions${
          avgDiversity != null ? `, lexical diversity ${Math.round(avgDiversity * 100) / 100}` : ""
        }`
      : "no measured writing length yet"
  );

  // --- Reading speed: words consumed per minute of reading ---
  const readingEvents = events.filter(
    (e) =>
      (e.skill === "READING" || e.channel === "reading") &&
      e.words != null &&
      e.words > 0 &&
      e.durationMin != null &&
      e.durationMin > 0
  );
  const wpm = mean(readingEvents.map((e) => e.words! / e.durationMin!));
  const readingSpeedWpm = makeScore(
    wpm,
    readingEvents.length,
    "growth",
    wpm != null
      ? `${round(wpm)} words per minute across ${readingEvents.length} timed reading sessions`
      : "no timed reading with a measured word count yet"
  );

  // --- Listening accuracy ---
  const listeningEvents = events.filter((e) => e.skill === "LISTENING" || e.channel === "audio");
  const listeningAcc = mean(accuracies(listeningEvents));
  const listeningAccuracy = makeScore(
    listeningAcc != null ? listeningAcc * 100 : null,
    listeningEvents.filter((e) => e.accuracy != null).length,
    "growth",
    `${listeningEvents.length} listening sessions${listeningAcc != null ? ` at ${round(listeningAcc * 100)}% accuracy` : ""}`
  );

  return {
    vocabulary,
    grammar,
    speakingConfidence,
    writingComplexity,
    readingSpeedWpm,
    listeningAccuracy,
  };
}

// ---------------------------------------------------------------------------
// Repeated mistakes
// ---------------------------------------------------------------------------

/**
 * Mistake categories that actually repeat.
 *
 * Tallied from the `errorTags` the learning surfaces emit, plus two categories
 * the engine can reconstruct without them (incomplete papers, and vocabulary
 * lapses from the review ledger) so the feature is useful before every surface is
 * instrumented. A single slip is not a pattern, hence the occurrence floor.
 */
export function computeMistakes(signals: DnaSignals): DnaMistakeCategory[] {
  const events = signals.events;
  const tally = new Map<string, { count: number; skills: Set<SkillKey>; recent: number; previous: number }>();

  const bump = (tag: string, skill: SkillKey | null, at: Date | null) => {
    const entry = tally.get(tag) ?? { count: 0, skills: new Set<SkillKey>(), recent: 0, previous: 0 };
    entry.count += 1;
    if (skill) entry.skills.add(skill);
    if (at) {
      const age = signals.now - at.getTime();
      if (age <= TREND_WINDOW_DAYS * DAY_MS) entry.recent += 1;
      else if (age <= 2 * TREND_WINDOW_DAYS * DAY_MS) entry.previous += 1;
    }
    tally.set(tag, entry);
  };

  for (const e of events) {
    for (const tag of e.errorTags) bump(tag, e.skill, e.at);
  }

  // Vocabulary lapses are recorded as SM-2 state, not as tags — surface them so
  // the most common cause of lost marks isn't invisible.
  const lapses = signals.reviews.reduce((s, r) => s + r.lapses, 0);
  const reps = signals.reviews.reduce((s, r) => s + r.reps, 0);
  if (reps >= 10 && lapses / reps > 0.25) {
    // Capped so a long review history can't let one category swamp the shares
    // and hide the tag-based categories underneath it.
    const contribution = Math.min(lapses, 25);
    for (let i = 0; i < contribution; i++) bump("vocabulary_recall", "VOCABULARY", null);
  }

  const totalMistakes = Array.from(tally.values()).reduce((s, v) => s + v.count, 0);
  if (totalMistakes === 0) return [];

  return Array.from(tally.entries())
    .filter(([, v]) => v.count >= MIN_MISTAKE_OCCURRENCES)
    .map(([tag, v]): DnaMistakeCategory => {
      let trend: Trend | null = null;
      if (v.recent + v.previous >= 4) {
        if (v.recent > v.previous * 1.3) trend = "rising";
        else if (v.recent * 1.3 < v.previous) trend = "falling";
        else trend = "steady";
      }
      return {
        tag,
        label: mistakeLabel(tag),
        occurrences: v.count,
        share: round((v.count / totalMistakes) * 100),
        skills: Array.from(v.skills),
        trend,
        evidence:
          v.skills.size > 0
            ? `${v.count} occurrences in ${Array.from(v.skills).map((s) => SKILL_LABEL[s]).join(", ")}`
            : `${v.count} occurrences`,
        fix: mistakeFix(tag),
      };
    })
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 5);
}

// ---------------------------------------------------------------------------
// Sequencing (the priming effect)
// ---------------------------------------------------------------------------

/**
 * Does reviewing first make the rest of the session better?
 *
 * For each day, sessions that happened *after* a review on that day are compared
 * with sessions that had no review before them. If the primed group performs
 * measurably better, the engine has earned the right to say "review before you
 * practise" — and to order the study plan that way. Without this measurement that
 * advice would be folklore.
 */
export function computeSequencing(events: DnaEvent[]): DnaSequencing {
  const byDay = new Map<string, DnaEvent[]>();
  for (const e of events) {
    const arr = byDay.get(e.dayKey) ?? [];
    arr.push(e);
    byDay.set(e.dayKey, arr);
  }

  const primed: DnaEvent[] = [];
  const unprimed: DnaEvent[] = [];

  for (const dayEvents of byDay.values()) {
    const sorted = [...dayEvents].sort((a, b) => a.at.getTime() - b.at.getTime());
    const firstReviewAt = sorted.find((e) => e.kind === "review")?.at.getTime() ?? null;
    for (const e of sorted) {
      if (e.kind === "review" || e.accuracy == null) continue;
      if (firstReviewAt != null && e.at.getTime() > firstReviewAt) primed.push(e);
      else unprimed.push(e);
    }
  }

  const primedAcc = mean(accuracies(primed));
  const unprimedAcc = mean(accuracies(unprimed));
  const enough = primed.length >= MIN_PRIMING_SESSIONS && unprimed.length >= MIN_PRIMING_SESSIONS;

  let confidence = confidenceFor(primed.length + unprimed.length, "sequence");
  if (!enough) confidence = "insufficient";

  const liftPoints =
    enough && primedAcc != null && unprimedAcc != null
      ? round((primedAcc - unprimedAcc) * 100)
      : null;

  // Which skill benefits most from being primed.
  let bestPrimedSkill: SkillKey | null = null;
  if (enough) {
    let bestLift = -Infinity;
    for (const skill of ALL_SKILLS) {
      const p = accuracies(primed.filter((e) => e.skill === skill));
      const u = accuracies(unprimed.filter((e) => e.skill === skill));
      if (p.length < 2 || u.length < 2) continue;
      const lift = mean(p)! - mean(u)!;
      if (lift > bestLift) {
        bestLift = lift;
        bestPrimedSkill = skill;
      }
    }
    if (bestLift <= 0) bestPrimedSkill = null;
  }

  return {
    primedAccuracy: enough && primedAcc != null ? round(primedAcc * 100) : null,
    unprimedAccuracy: enough && unprimedAcc != null ? round(unprimedAcc * 100) : null,
    liftPoints,
    primedSessions: primed.length,
    unprimedSessions: unprimed.length,
    confidence,
    bestPrimedSkill,
    basis: enough
      ? `${primed.length} sessions preceded by review versus ${unprimed.length} without`
      : `needs at least ${MIN_PRIMING_SESSIONS} sessions on each side (have ${primed.length} primed, ${unprimed.length} unprimed)`,
  };
}

// ---------------------------------------------------------------------------
// Learning maturity
// ---------------------------------------------------------------------------

/**
 * "Learning maturity" — how developed this person is as a *learner*, independent
 * of their band. A Band 5 student who reviews on schedule, studies consistently
 * and covers every skill is a more mature learner than a Band 7 who crams one
 * module: the first will keep improving, and this score says so.
 */
export function computeMaturity(
  coverage: DnaCoverage,
  consistency: DnaScore,
  retention: DnaScore,
  revision: DnaScore,
  skillBalance: DnaScore
): DnaScore {
  const blended = blend([
    { value: coverage.completeness, weight: 25 },
    { value: consistency.value, weight: 25 },
    { value: retention.value, weight: 20 },
    { value: revision.value, weight: 15 },
    { value: skillBalance.value, weight: 15 },
  ]);

  return makeScore(
    blended.value,
    coverage.events,
    "maturity",
    `blended from evidence breadth (${coverage.completeness}), consistency, retention, revision efficiency and skill balance`
  );
}

/**
 * Overall trust in the profile. Deliberately conservative — the *lowest* common
 * denominator of the pillars, not an average — because a headline confidence of
 * "high" next to three unmeasured pillars would be a lie of composition.
 */
export function overallConfidence(coverage: DnaCoverage, pillars: Confidence[]): Confidence {
  const rank: Record<Confidence, number> = { insufficient: 0, low: 1, medium: 2, high: 3 };
  const graded = pillars.filter((c) => c !== "insufficient");
  if (graded.length < 2 || coverage.events < LADDERS.maturity.low) return "insufficient";
  const avg = graded.reduce((s, c) => s + rank[c], 0) / graded.length;
  // At least half the pillars must be measurable before we claim "high".
  const measurable = graded.length / pillars.length;
  if (avg >= 2.5 && measurable >= 0.6) return "high";
  if (avg >= 1.6 && measurable >= 0.4) return "medium";
  return "low";
}
