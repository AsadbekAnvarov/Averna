import {
  BAND_SKILLS,
  CONSISTENCY_WINDOW_DAYS,
  MAX_INSIGHTS,
  MIN_INSIGHT_WEIGHT,
  MIN_PRIMING_LIFT,
  SKILL_LABEL,
  STYLE_HINT,
} from "./config";
import type { Confidence, DnaInsight, LearningDnaProfile } from "./types";

/**
 * Learning DNA Engine — insight generation.
 *
 * The hard requirement for this layer is: **never generate generic advice**. That
 * is enforced structurally rather than by careful writing:
 *
 *  - Each rule is a pure function that returns `null` unless the specific
 *    measurement it describes exists and clears its effect-size gate. A rule
 *    cannot "fall back" to something vague, because there is nowhere to fall back
 *    to — `null` is the only alternative to a supported statement.
 *  - Every insight carries a non-empty `evidence` array containing the actual
 *    numbers. If a sentence can't cite figures, the rule that would have written
 *    it doesn't fire.
 *  - When nothing qualifies, the engine does not pad the list with platitudes. It
 *    reports, factually, which behaviour it still needs to observe — which is
 *    honest, and is itself actionable.
 *
 * Ordering is by `weight` scaled by confidence, so the most actionable
 * well-evidenced observation leads.
 */

/** Everything the profile knows, before language is layered on top. */
export type DnaBase = Omit<
  LearningDnaProfile,
  "insights" | "recommendations" | "plan" | "improvements" | "attention" | "nextDataNeeded"
>;

const CONFIDENCE_RANK: Record<Confidence, number> = {
  insufficient: 0,
  low: 1,
  medium: 2,
  high: 3,
};

function hh(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function hourRange(start: number, end: number): string {
  return `${hh(start)}–${hh(end)}`;
}

type Rule = (base: DnaBase) => DnaInsight | null;

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/** Time of day. Fires only when one daypart is measurably ahead of the rest. */
const timeOfDay: Rule = (base) => {
  const t = base.timing;
  if (t.optimalDaypart == null || t.advantagePoints == null || t.optimalLabel == null) return null;
  if (t.optimalHourStart == null || t.optimalHourEnd == null) return null;

  const best = t.dayparts.find((d) => d.daypart === t.optimalDaypart);
  const worst = t.worstDaypart ? t.dayparts.find((d) => d.daypart === t.worstDaypart) : null;
  if (!best || best.accuracy == null) return null;

  const evidence = [
    `${best.label}: ${best.accuracy}% accuracy across ${best.sessions} sessions`,
    ...t.dayparts
      .filter((d) => d.daypart !== t.optimalDaypart && d.accuracy != null && d.sessions > 0)
      .map((d) => `${d.label}: ${d.accuracy}% across ${d.sessions} sessions`),
  ];

  return {
    id: "timing-best-window",
    kind: "timing",
    title: `You perform best in the ${t.optimalLabel.toLowerCase()}`,
    text:
      `Your accuracy is ${t.advantagePoints} points higher when you study between ${hourRange(t.optimalHourStart, t.optimalHourEnd)} ` +
      `than at other times${worst && worst.accuracy != null ? `, and lowest in the ${worst.label.toLowerCase()} (${worst.accuracy}%)` : ""}.`,
    evidence,
    confidence: t.confidence,
    weight: 88,
    tone: "positive",
  };
};

/** Fatigue point. The single most useful thing the engine can tell a learner
 *  who over-studies: exactly when their session stopped working. */
const fatigue: Rule = (base) => {
  const f = base.focus;
  if (f.fatiguePointMin == null || f.declinePoints == null) return null;

  return {
    id: "focus-fatigue-point",
    kind: "focus",
    title: `Your accuracy falls after about ${f.fatiguePointMin} minutes`,
    text:
      `Sessions longer than roughly ${f.fatiguePointMin} minutes score ${f.declinePoints} accuracy points lower than your best length. ` +
      `Splitting a long session into ${f.idealLessonMin ?? f.fatiguePointMin}-minute blocks with a break protects your accuracy.`,
    evidence: [
      // The whole curve, so the learner can see the shape of the claim rather
      // than being asked to trust the breakpoint.
      ...f.bands
        .filter((b) => b.sessions > 0 && b.accuracy != null)
        .map((b) => `${b.label}: ${b.accuracy}% across ${b.sessions} sessions`),
      ...(f.durationAccuracyCorr != null
        ? [`correlation between session length and accuracy: ${f.durationAccuracyCorr}`]
        : []),
    ],
    confidence: f.confidence,
    weight: 92,
    tone: "warning",
  };
};

/** Optimal sitting length, when no decline has been observed yet. */
const focusSweetSpot: Rule = (base) => {
  const f = base.focus;
  if (f.fatiguePointMin != null) return null; // covered by the fatigue rule
  if (f.focusMinutes == null || f.confidence === "insufficient") return null;

  const peak = f.bands.find(
    (b) => b.fromMin <= f.focusMinutes! && (b.toMin == null || b.toMin > f.focusMinutes!)
  );
  if (!peak || peak.accuracy == null) return null;

  return {
    id: "focus-sweet-spot",
    kind: "focus",
    title: `Your sharpest work happens in ${peak.label} sessions`,
    text:
      `Sessions of ${peak.label} average ${peak.accuracy}% accuracy — your best band so far, with no drop-off detected yet. ` +
      `Around ${f.idealLessonMin ?? f.focusMinutes} minutes is a reliable sitting for you.`,
    evidence: f.bands
      .filter((b) => b.sessions > 0 && b.accuracy != null)
      .map((b) => `${b.label}: ${b.accuracy}% across ${b.sessions} sessions`),
    confidence: f.confidence,
    weight: 70,
    tone: "positive",
  };
};

/** Learning style — expressed as a measured channel advantage, not a label. */
const style: Rule = (base) => {
  const s = base.style;
  if (s.preferred == null || s.label == null) return null;
  const top = s.scores[0];
  const others = s.scores.filter((x) => x.style !== s.preferred && x.accuracy != null);
  if (!top || top.accuracy == null) return null;

  return {
    id: "style-preferred",
    kind: "style",
    title: `You learn fastest as a ${s.label.toLowerCase()}`,
    text: `${STYLE_HINT[s.preferred]} Your accuracy through this channel is ${top.accuracy}%, ahead of your other channels.`,
    evidence: [
      `${top.label}: ${top.accuracy}% accuracy across ${top.events} sessions (${top.share}% of your activity)`,
      ...others.map((o) => `${o.label}: ${o.accuracy}% across ${o.events} sessions`),
    ],
    confidence: s.confidence,
    weight: 84,
    tone: "positive",
  };
};

/**
 * Sequencing. This is the rule that turns "review your vocabulary first" from
 * received wisdom into a personal, measured claim — or refuses to make it.
 */
const priming: Rule = (base) => {
  const q = base.sequencing;
  if (q.liftPoints == null || q.confidence === "insufficient") return null;
  if (q.liftPoints < MIN_PRIMING_LIFT) return null;

  const skillNote = q.bestPrimedSkill ? ` The effect is strongest in ${SKILL_LABEL[q.bestPrimedSkill]}.` : "";

  return {
    id: "sequence-review-first",
    kind: "sequence",
    title: "A short review first makes the whole session better",
    text:
      `When you review before practising, you score ${q.liftPoints} accuracy points higher than when you start cold.${skillNote} ` +
      `Ten minutes of review is buying you more than ten minutes of extra practice would.`,
    evidence: [
      `after review: ${q.primedAccuracy}% across ${q.primedSessions} sessions`,
      `without review first: ${q.unprimedAccuracy}% across ${q.unprimedSessions} sessions`,
    ],
    confidence: q.confidence,
    weight: 90,
    tone: "positive",
  };
};

/** The reverse finding, reported with the same rigour — an engine that only
 *  ever confirms the pedagogy it was built with isn't measuring anything. */
const primingReverse: Rule = (base) => {
  const q = base.sequencing;
  if (q.liftPoints == null || q.confidence === "insufficient") return null;
  if (q.liftPoints > -MIN_PRIMING_LIFT) return null;

  return {
    id: "sequence-practice-first",
    kind: "sequence",
    title: "You do your best work before you review, not after",
    text:
      `Your accuracy is ${Math.abs(q.liftPoints)} points higher when you practise first and review afterwards. ` +
      `Save review for the end of your session and spend your freshest minutes on new material.`,
    evidence: [
      `practice first: ${q.unprimedAccuracy}% across ${q.unprimedSessions} sessions`,
      `after review: ${q.primedAccuracy}% across ${q.primedSessions} sessions`,
    ],
    confidence: q.confidence,
    weight: 86,
    tone: "neutral",
  };
};

/** Forgetting speed, stated in days rather than as an abstract score. */
const forgetting: Rule = (base) => {
  const r = base.retention;
  const half = base.memoryHalfLifeDays;
  if (r.value == null || half == null || r.confidence === "insufficient") return null;
  if (r.value >= 60) return null;

  return {
    id: "retention-fading",
    kind: "retention",
    title: `Your recall halves after about ${Math.round(half)} days without review`,
    text:
      `Your retention is sitting at ${r.value}%. Material you don't revisit within roughly ${Math.round(half)} days ` +
      `is half-forgotten by the time you next need it — which is why re-learning keeps eating your study time.`,
    evidence: [
      r.basis,
      ...(base.revisionEfficiency.value != null
        ? [`revision efficiency: ${base.revisionEfficiency.value}/100 (${base.revisionEfficiency.basis})`]
        : []),
    ],
    confidence: r.confidence,
    weight: 89,
    tone: "warning",
  };
};

/** Strong retention deserves saying out loud — it's the hardest thing to build. */
const retentionStrong: Rule = (base) => {
  const r = base.retention;
  if (r.value == null || r.value < 75 || r.confidence === "insufficient") return null;
  return {
    id: "retention-strong",
    kind: "retention",
    title: "What you learn is actually sticking",
    text:
      `Your retention is ${r.value}%${base.memoryHalfLifeDays != null ? `, with recall holding for around ${Math.round(base.memoryHalfLifeDays)} days between reviews` : ""}. ` +
      `You can safely spend more of your time on new material instead of re-learning old ground.`,
    evidence: [r.basis],
    confidence: r.confidence,
    weight: 66,
    tone: "positive",
  };
};

/** Consistency, framed by the measurement rather than by exhortation. */
const consistency: Rule = (base) => {
  const c = base.consistency;
  if (c.value == null || c.confidence === "insufficient") return null;

  if (c.value < 45) {
    return {
      id: "consistency-low",
      kind: "consistency",
      title: "Your study days are clustered, not spread",
      text:
        `You studied on ${base.coverage.activeDays} of the last ${CONSISTENCY_WINDOW_DAYS} days, and unevenly. ` +
        `Given how fast your recall fades, three short sessions across a week will out-perform one long one.`,
      evidence: [
        c.basis,
        ...(base.memoryHalfLifeDays != null
          ? [`recall half-life: about ${Math.round(base.memoryHalfLifeDays)} days`]
          : []),
      ],
      confidence: c.confidence,
      weight: 80,
      tone: "warning",
    };
  }
  if (c.value >= 75) {
    return {
      id: "consistency-high",
      kind: "consistency",
      title: "Your routine is genuinely consistent",
      text: `You've studied on ${base.coverage.activeDays} of the last ${CONSISTENCY_WINDOW_DAYS} days, evenly spread. This is the single strongest predictor you control.`,
      evidence: [c.basis],
      confidence: c.confidence,
      weight: 62,
      tone: "positive",
    };
  }
  return null;
};

/** Motivation, as an observed change in behaviour. */
const motivation: Rule = (base) => {
  const m = base.motivation;
  if (m.deltaPercent == null || m.score.confidence === "insufficient") return null;

  if (m.trend === "falling") {
    return {
      id: "motivation-falling",
      kind: "motivation",
      title: "Your activity has dropped this fortnight",
      text:
        `You've been active on ${m.recentActiveDays} days recently, down from ${m.previousActiveDays} in the fortnight before — ` +
        `${Math.abs(m.deltaPercent)}% less learning volume. Shrinking the target for a week is usually what restarts momentum.`,
      evidence: [m.score.basis, m.basis],
      confidence: m.score.confidence,
      weight: 87,
      tone: "warning",
    };
  }
  if (m.trend === "rising") {
    return {
      id: "motivation-rising",
      kind: "motivation",
      title: "You're building real momentum",
      text: `Your learning volume is up ${m.deltaPercent}% on the previous fortnight, across ${m.recentActiveDays} active days. This is the moment to attempt something harder.`,
      evidence: [m.score.basis, m.basis],
      confidence: m.score.confidence,
      weight: 72,
      tone: "positive",
    };
  }
  return null;
};

/** Skill divergence — the number that actually decides an IELTS overall band. */
const divergence: Rule = (base) => {
  const strongest = base.strongest;
  const weakest = base.weakest;
  if (!strongest || !weakest || strongest.key === weakest.key) return null;
  const gap = strongest.mastery - weakest.mastery;
  if (gap < 25) return null;

  return {
    id: "skill-divergence",
    kind: "skill",
    title: `${weakest.label} is holding your overall band back`,
    text:
      `Your ${strongest.label} is ${gap} mastery points ahead of your ${weakest.label}. ` +
      `Because an overall band is the average of all four, an hour spent on ${weakest.label} raises your score more than an hour on ${strongest.label}.`,
    evidence: [
      `${strongest.label}: ${strongest.mastery}/100 mastery — ${strongest.reason}`,
      `${weakest.label}: ${weakest.mastery}/100 mastery — ${weakest.reason}`,
    ],
    confidence: base.skillBalance.confidence === "insufficient" ? "low" : base.skillBalance.confidence,
    weight: 91,
    tone: "warning",
  };
};

/** Which skill responds fastest to this learner's effort. */
const fastestSkill: Rule = (base) => {
  const f = base.fastestGrowing;
  if (!f || f.velocity == null || f.velocity <= 0.1 || f.improvement == null) return null;
  return {
    id: "skill-fastest",
    kind: "skill",
    title: `${f.label} responds fastest to your practice`,
    text:
      `You've gained ${f.improvement > 0 ? "+" : ""}${f.improvement} band in ${f.label}, about ${f.velocity} band per 10 study days — ` +
      `faster than your other skills. Practice here converts into score most efficiently.`,
    evidence: [`${f.label}: ${f.events} sessions, ${f.reason}`],
    confidence: "low",
    weight: 74,
    tone: "positive",
  };
};

/** Repeated mistake categories. */
const mistakes: Rule = (base) => {
  const top = base.mistakes[0];
  if (!top) return null;
  return {
    id: `mistake-${top.tag}`,
    kind: "mistake",
    title: `"${top.label}" keeps costing you marks`,
    text:
      `This is ${top.share}% of the mistakes we've recorded for you (${top.occurrences} times)${
        top.trend === "rising" ? " and it's becoming more frequent" : top.trend === "falling" ? ", though it's improving" : ""
      }. ${top.fix}`,
    evidence: [
      top.evidence,
      ...base.mistakes.slice(1, 3).map((m) => `${m.label}: ${m.occurrences} occurrences (${m.share}%)`),
    ],
    confidence: top.occurrences >= 8 ? "medium" : "low",
    weight: 82,
    tone: "warning",
  };
};

/** Whether reviews are actually buying durable memory. */
const revision: Rule = (base) => {
  const r = base.revisionEfficiency;
  if (r.value == null || r.confidence === "insufficient") return null;
  if (r.value >= 70) {
    return {
      id: "revision-efficient",
      kind: "retention",
      title: "Your review sessions are paying off",
      text: `Your revision efficiency is ${r.value}/100 — each review is buying you a genuinely longer memory, so your deck is getting cheaper to maintain.`,
      evidence: [r.basis],
      confidence: r.confidence,
      weight: 58,
      tone: "positive",
    };
  }
  if (r.value < 45) {
    return {
      id: "revision-inefficient",
      kind: "retention",
      title: "Your reviews aren't sticking yet",
      text: `Your revision efficiency is ${r.value}/100: items keep lapsing back to short intervals. Reviewing fewer items more often beats clearing a big backlog in one sitting.`,
      evidence: [r.basis],
      confidence: r.confidence,
      weight: 78,
      tone: "warning",
    };
  }
  return null;
};

/** A plateau is a real, reportable finding — and needs a different response
 *  from slow progress. */
const plateau: Rule = (base) => {
  const s = base.learningSpeed;
  if (s.label !== "plateaued" || s.score.confidence === "insufficient") return null;
  if (s.totalBandGain == null) return null;
  return {
    id: "speed-plateau",
    kind: "skill",
    title: "Your scores have levelled off",
    text:
      `Across ${base.coverage.tests} attempts over ${s.activeDays} active days your band has moved ${s.totalBandGain >= 0 ? "+" : ""}${s.totalBandGain}. ` +
      `A plateau usually means the difficulty stopped stretching you, not that you stopped being able to improve.`,
    evidence: [s.score.basis],
    confidence: s.score.confidence,
    weight: 83,
    tone: "warning",
  };
};

/** Reading speed, when actually measured. */
const readingSpeed: Rule = (base) => {
  const wpm = base.growth.readingSpeedWpm;
  if (wpm.value == null || wpm.confidence === "insufficient") return null;
  // ~250 wpm is the pace an IELTS Academic reading paper demands.
  if (wpm.value >= 200) return null;
  return {
    id: "growth-reading-speed",
    kind: "skill",
    title: `You read at about ${wpm.value} words per minute`,
    text: `IELTS Academic Reading gives you roughly 250 words per minute of reading time to finish comfortably. At ${wpm.value} wpm, timing will cost you marks before comprehension does.`,
    evidence: [wpm.basis],
    confidence: wpm.confidence,
    weight: 76,
    tone: "warning",
  };
};

/** Avoidance of a whole skill is a behavioural finding, not a gap in coverage. */
const avoidance: Rule = (base) => {
  const untouched = base.skills.filter((s) => BAND_SKILLS.includes(s.key) && s.status === "untouched");
  if (untouched.length === 0) return null;
  if (base.coverage.tests < 4) return null; // too early to call it avoidance

  return {
    id: "skill-avoidance",
    kind: "skill",
    title: `You've never attempted ${untouched.map((s) => s.label).join(" or ")}`,
    text:
      `After ${base.coverage.tests} attempts across your other skills, ${untouched.map((s) => s.label).join(" and ")} ${untouched.length === 1 ? "is" : "are"} still untouched. ` +
      `An unattempted module is scored as your weakest one on exam day.`,
    evidence: base.skills
      .filter((s) => BAND_SKILLS.includes(s.key) && s.events > 0)
      .map((s) => `${s.label}: ${s.events} sessions`),
    confidence: "high",
    weight: 93,
    tone: "warning",
  };
};

const RULES: Rule[] = [
  timeOfDay,
  fatigue,
  focusSweetSpot,
  style,
  priming,
  primingReverse,
  forgetting,
  retentionStrong,
  consistency,
  motivation,
  divergence,
  fastestSkill,
  mistakes,
  revision,
  plateau,
  readingSpeed,
  avoidance,
];

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * Run every rule and return the strongest, best-evidenced observations.
 *
 * Insights whose confidence is "insufficient" are discarded even if the rule
 * produced text, and anything without evidence is discarded as a final backstop
 * — so the "no generic advice" guarantee holds even if a future rule is written
 * carelessly.
 */
export function generateInsights(base: DnaBase): DnaInsight[] {
  const produced: DnaInsight[] = [];

  for (const rule of RULES) {
    let insight: DnaInsight | null = null;
    try {
      insight = rule(base);
    } catch {
      // A single malformed rule must never take down the profile.
      insight = null;
    }
    if (!insight) continue;
    if (insight.confidence === "insufficient") continue;
    if (insight.evidence.filter((e) => e && e.trim().length > 0).length === 0) continue;
    if (insight.weight < MIN_INSIGHT_WEIGHT) continue;
    produced.push({ ...insight, evidence: insight.evidence.filter((e) => e && e.trim().length > 0) });
  }

  return produced
    .sort((a, b) => {
      const scoreA = a.weight * (1 + CONFIDENCE_RANK[a.confidence] * 0.25);
      const scoreB = b.weight * (1 + CONFIDENCE_RANK[b.confidence] * 0.25);
      return scoreB - scoreA;
    })
    .slice(0, MAX_INSIGHTS);
}

/**
 * What the engine still needs in order to say more.
 *
 * Shown to the learner in place of filler insights. Each entry names a concrete
 * behaviour, so the list doubles as an explanation of why the profile will be
 * sharper next month than it is today.
 */
export function describeDataGaps(base: DnaBase): string[] {
  const gaps: string[] = [];
  const c = base.coverage;

  if (c.tests < 4) {
    gaps.push(`Take ${4 - c.tests} more practice test${4 - c.tests === 1 ? "" : "s"} so your skill profile has real evidence behind it.`);
  }
  if (base.timing.confidence === "insufficient" || base.timing.optimalDaypart == null) {
    gaps.push("Study at a few different times of day — that's how we find the hours when you perform best.");
  }
  if (base.focus.confidence === "insufficient") {
    gaps.push("Use the focus timer during practice so we can measure how long your concentration actually lasts.");
  }
  if (base.style.preferred == null) {
    gaps.push("Practise through more than one channel (reading, audio, speaking, flashcards) so we can see which one works best for you.");
  }
  if (c.reviews < 5) {
    gaps.push("Review some vocabulary or mistakes — recall after a delay is the only honest measure of retention.");
  }
  if (c.checkins === 0) {
    gaps.push("Log a confidence check-in after a session; your own read on your confidence outweighs anything we can infer.");
  }
  const untouched = base.skills.filter((s) => BAND_SKILLS.includes(s.key) && s.events === 0);
  if (untouched.length > 0 && c.tests < 4) {
    gaps.push(`Try ${untouched.map((s) => s.label).join(", ")} at least once so no skill is a blind spot.`);
  }
  if (c.historySpanDays < 14) {
    gaps.push(`Keep going for another ${Math.max(1, 14 - c.historySpanDays)} days — trends need time before they mean anything.`);
  }

  return gaps.slice(0, 5);
}
