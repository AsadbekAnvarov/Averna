import {
  BAND_SKILLS,
  MAX_RECOMMENDATIONS,
  MIN_PRIMING_LIFT,
  SKILL_HREF,
  STYLE_CHANNELS,
} from "./config";
import type { DnaBase } from "./insights";
import type {
  Channel,
  Confidence,
  DnaChange,
  DnaPlanBlock,
  DnaRecommendation,
  DnaSkillMetric,
  DnaStudyPlan,
} from "./types";

/**
 * Learning DNA Engine — adaptive recommendations, study plan and change tracking.
 *
 * This is where the profile turns into instructions the rest of the platform can
 * act on. Three outputs:
 *
 *  - `buildRecommendations` — a ranked, deduplicated action list. Every item
 *    names the DNA measurement it stands on in `basis`, so a student can always
 *    ask "why are you telling me this?" and get a number back.
 *  - `buildStudyPlan` — an ordered, time-boxed plan. The *order* comes from this
 *    learner's measured sequencing effect and the *length* from their measured
 *    fatigue point, which is what makes it a personal plan rather than a template.
 *  - `computeChanges` — what has genuinely moved since the last snapshot, split
 *    into wins and warnings.
 *
 * Same discipline as the insight layer: an item that cannot cite a measurement is
 * not produced. The one exception is the cold-start plan, which is explicitly
 * labelled as a baseline for *collecting* evidence rather than acting on it.
 */

const CONFIDENCE_RANK: Record<Confidence, number> = {
  insufficient: 0,
  low: 1,
  medium: 2,
  high: 3,
};

function hh(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** Round to a schedulable number of minutes. */
function toBlock(minutes: number): number {
  return Math.max(5, Math.round(minutes / 5) * 5);
}

/** The skill that most needs work: reinforcement cases first, then lowest
 *  mastery among skills with evidence. Untouched skills are handled separately
 *  because "start it" and "improve it" are different instructions. */
function priorityWeakSkill(base: DnaBase): DnaSkillMetric | null {
  const reinforce = base.skills
    .filter((s) => s.status === "needs_reinforcement" && s.events > 0)
    .sort((a, b) => a.mastery - b.mastery);
  if (reinforce.length > 0) return reinforce[0];
  return base.weakest && base.weakest.events > 0 ? base.weakest : null;
}

function untouchedBandSkills(base: DnaBase): DnaSkillMetric[] {
  return base.skills.filter((s) => BAND_SKILLS.includes(s.key) && s.events === 0);
}

/** The channel this learner performs best through, when that's been established. */
function preferredChannel(base: DnaBase): Channel | null {
  if (base.style.preferred == null) return null;
  const channels = STYLE_CHANNELS[base.style.preferred];
  return channels.length > 0 ? channels[0] : null;
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export function buildRecommendations(base: DnaBase): DnaRecommendation[] {
  const recs: DnaRecommendation[] = [];

  // --- Weak-skill recovery: the highest-leverage action in a banded exam ---
  const weak = priorityWeakSkill(base);
  if (weak) {
    recs.push({
      id: "weak-skill",
      kind: "weak_skill",
      title: `Put your next session into ${weak.label}`,
      detail: `${weak.reason}. In a banded exam your weakest skill sets the ceiling, so this is where an hour buys the most score.`,
      href: SKILL_HREF[weak.key],
      priority: 95,
      basis: `${weak.label} mastery ${weak.mastery}/100 from ${weak.events} sessions`,
      confidence: weak.events >= 3 ? "medium" : "low",
    });
  }

  // --- A never-attempted module is the most urgent gap of all ---
  const untouched = untouchedBandSkills(base);
  if (untouched.length > 0 && base.coverage.tests >= 1) {
    const first = untouched[0];
    recs.push({
      id: "start-skill",
      kind: "exam_prep",
      title: `Take your first ${first.label} test`,
      detail: `You've practised ${base.coverage.tests} times but never attempted ${first.label}. One attempt turns it from a blind spot into a measurable skill.`,
      href: SKILL_HREF[first.key],
      priority: 97,
      basis: `${first.label}: 0 sessions recorded`,
      confidence: "high",
    });
  }

  // --- Review timing, driven by the measured forgetting curve ---
  if (base.memoryHalfLifeDays != null && base.retention.value != null) {
    const every = Math.max(1, Math.round(base.memoryHalfLifeDays * 0.6));
    recs.push({
      id: "review-timing",
      kind: "review_timing",
      title: `Review every ${every} day${every === 1 ? "" : "s"}`,
      detail: `Your recall halves after about ${Math.round(base.memoryHalfLifeDays)} days. Reviewing just before that point is the cheapest way to keep what you've learned.`,
      href: "/flashcards",
      priority: base.retention.value < 60 ? 90 : 65,
      basis: `retention ${base.retention.value}%, recall half-life ${Math.round(base.memoryHalfLifeDays)} days`,
      confidence: base.retention.confidence,
    });
  }

  // --- Session length, from the fatigue breakpoint ---
  if (base.focus.idealLessonMin != null) {
    const ideal = base.focus.idealLessonMin;
    recs.push({
      id: "session-length",
      kind: "study_plan",
      title: `Study in ${ideal}-minute blocks`,
      detail:
        base.focus.fatiguePointMin != null
          ? `Your accuracy drops ${base.focus.declinePoints} points beyond about ${base.focus.fatiguePointMin} minutes, so stop and break before you get there.`
          : `${ideal} minutes is where your accuracy peaks. Two of these beat one long sitting.`,
      href: "/dashboard",
      priority: base.focus.fatiguePointMin != null ? 84 : 60,
      basis: base.focus.basis,
      confidence: base.focus.confidence,
    });
  }

  // --- Scheduling, from the timing profile ---
  if (base.timing.optimalHourStart != null && base.timing.optimalHourEnd != null && base.timing.advantagePoints != null) {
    recs.push({
      id: "study-window",
      kind: "study_plan",
      title: `Schedule your hardest work for ${hh(base.timing.optimalHourStart)}–${hh(base.timing.optimalHourEnd)}`,
      detail: `You score ${base.timing.advantagePoints} accuracy points higher in this window. Save easy revision for your weaker hours.`,
      href: "/schedule",
      priority: 86,
      basis: base.timing.basis,
      confidence: base.timing.confidence,
    });
  }

  // --- Lesson order, only when the priming effect has been measured ---
  if (base.sequencing.liftPoints != null && base.sequencing.confidence !== "insufficient") {
    if (base.sequencing.liftPoints >= MIN_PRIMING_LIFT) {
      recs.push({
        id: "order-review-first",
        kind: "lesson_order",
        title: "Open every session with 10 minutes of review",
        detail: `Sessions that start with review score ${base.sequencing.liftPoints} points higher for you. Warm up first, then take on new material.`,
        href: "/flashcards",
        priority: 88,
        basis: base.sequencing.basis,
        confidence: base.sequencing.confidence,
      });
    } else if (base.sequencing.liftPoints <= -MIN_PRIMING_LIFT) {
      recs.push({
        id: "order-practice-first",
        kind: "lesson_order",
        title: "Practise first, review at the end",
        detail: `You score ${Math.abs(base.sequencing.liftPoints)} points higher when new material comes before review. Spend your freshest minutes on the hard part.`,
        href: "/dashboard",
        priority: 80,
        basis: base.sequencing.basis,
        confidence: base.sequencing.confidence,
      });
    }
  }

  // --- Difficulty, from trajectory rather than from band alone ---
  if (base.learningSpeed.label != null && base.learningSpeed.score.confidence !== "insufficient") {
    if (base.learningSpeed.label === "plateaued") {
      recs.push({
        id: "difficulty-up",
        kind: "difficulty",
        title: "Step up the difficulty",
        detail: `Your band has moved ${base.learningSpeed.totalBandGain} across ${base.coverage.tests} attempts. A plateau usually means the material stopped stretching you — try harder passages and stricter timing.`,
        href: "/learning/mock-exam",
        priority: 82,
        basis: base.learningSpeed.score.basis,
        confidence: base.learningSpeed.score.confidence,
      });
    } else if (base.learningSpeed.label === "rapid") {
      recs.push({
        id: "difficulty-stretch",
        kind: "difficulty",
        title: "You're ready for exam-level material",
        detail: `You're gaining about ${base.learningSpeed.bandsPerTenActiveDays} band per 10 study days. Full mock exams under time pressure will keep that rate up.`,
        href: "/learning/mock-exam",
        priority: 70,
        basis: base.learningSpeed.score.basis,
        confidence: base.learningSpeed.score.confidence,
      });
    }
  }

  // --- Play to the measured strength when choosing HOW to practise ---
  const channel = preferredChannel(base);
  if (channel && weak && base.style.preferred != null) {
    recs.push({
      id: "style-channel",
      kind: "homework",
      title: `Attack ${weak.label} through ${base.style.label?.toLowerCase() ?? channel}`,
      detail: `Your strongest channel is where you learn fastest — using it on your weakest skill is the shortest route to a higher band.`,
      href: SKILL_HREF[weak.key],
      priority: 68,
      basis: base.style.basis,
      confidence: base.style.confidence,
    });
  }

  // --- Motivation: an intervention, sized by the measurement ---
  if (base.motivation.trend === "falling" && base.motivation.score.confidence !== "insufficient") {
    recs.push({
      id: "motivation-reset",
      kind: "motivation",
      title: "Shrink the target for one week",
      detail: `Your activity is down ${Math.abs(base.motivation.deltaPercent ?? 0)}%. A 10-minute daily commitment rebuilds a streak far more reliably than trying to make up lost ground at once.`,
      href: "/challenge",
      priority: 89,
      basis: base.motivation.score.basis,
      confidence: base.motivation.score.confidence,
    });
  }

  // --- Revision mechanics ---
  if (base.revisionEfficiency.value != null && base.revisionEfficiency.value < 45) {
    recs.push({
      id: "revision-smaller",
      kind: "revision",
      title: "Review fewer items, more often",
      detail: `Your revision efficiency is ${base.revisionEfficiency.value}/100 — items keep lapsing. Ten cards daily outperforms seventy cards weekly.`,
      href: "/flashcards",
      priority: 79,
      basis: base.revisionEfficiency.basis,
      confidence: base.revisionEfficiency.confidence,
    });
  }

  // --- Mistake-driven homework ---
  const topMistake = base.mistakes[0];
  if (topMistake) {
    recs.push({
      id: `mistake-${topMistake.tag}`,
      kind: "homework",
      title: `Target "${topMistake.label}"`,
      detail: `${topMistake.fix} It accounts for ${topMistake.share}% of your recorded mistakes.`,
      href: "/dashboard",
      priority: 76,
      basis: topMistake.evidence,
      confidence: topMistake.occurrences >= 8 ? "medium" : "low",
    });
  }

  // --- AI Mentor hand-off, so the mentor opens on the right subject ---
  if (weak || topMistake) {
    const subject = weak ? weak.label : topMistake!.label;
    recs.push({
      id: "mentor",
      kind: "mentor",
      title: `Ask your AI Mentor about ${subject}`,
      detail: `Your mentor already has your Learning DNA, so it can explain ${subject} the way you learn best instead of starting from scratch.`,
      href: "/mentor",
      priority: 55,
      basis: weak ? `weakest skill: ${weak.label}` : `most frequent mistake: ${topMistake!.label}`,
      confidence: "low",
    });
  }

  return recs
    .filter((r) => r.confidence !== "insufficient")
    .sort((a, b) => {
      const scoreA = a.priority * (1 + CONFIDENCE_RANK[a.confidence] * 0.15);
      const scoreB = b.priority * (1 + CONFIDENCE_RANK[b.confidence] * 0.15);
      return scoreB - scoreA;
    })
    .slice(0, MAX_RECOMMENDATIONS);
}

// ---------------------------------------------------------------------------
// Study plan
// ---------------------------------------------------------------------------

/**
 * A personal, ordered plan for today.
 *
 * Three DNA measurements shape it:
 *  - total length  ← the fatigue point (never plan past where accuracy collapses);
 *  - block order   ← the measured priming effect (review first only if it helps);
 *  - block content ← weakest skill, then the skill that responds fastest.
 *
 * With no evidence yet, the plan says so and its blocks are aimed at *producing*
 * evidence — which is the honest version of a first-day recommendation.
 */
export function buildStudyPlan(base: DnaBase): DnaStudyPlan {
  const window =
    base.timing.optimalHourStart != null && base.timing.optimalHourEnd != null && base.timing.optimalLabel != null
      ? {
          startHour: base.timing.optimalHourStart,
          endHour: base.timing.optimalHourEnd,
          label: base.timing.optimalLabel,
        }
      : null;

  // Cold start: collect evidence rather than pretend to personalise.
  if (base.coverage.events < 3) {
    const blocks: DnaPlanBlock[] = [
      {
        order: 1,
        label: "Take one practice test",
        skill: null,
        channel: null,
        minutes: 20,
        purpose: "Establish a baseline",
        href: "/learning/reading",
        why: "Your Learning DNA needs a first measurement before it can personalise anything.",
      },
      {
        order: 2,
        label: "Review 10 vocabulary cards",
        skill: "VOCABULARY",
        channel: "flashcard",
        minutes: 10,
        purpose: "Start the retention record",
        href: "/flashcards",
        why: "Recall after a delay is the only honest way to measure how well material sticks for you.",
      },
    ];
    return {
      window,
      totalMinutes: 30,
      blocks,
      basis: `only ${base.coverage.events} recorded activities so far — this plan is designed to gather evidence, not to act on it`,
      confidence: "insufficient",
    };
  }

  const total = base.focus.idealLessonMin ?? base.focus.medianSessionMin ?? 30;
  const blocks: DnaPlanBlock[] = [];
  let order = 1;

  const reviewHelps = base.sequencing.liftPoints != null && base.sequencing.liftPoints >= MIN_PRIMING_LIFT;
  const reviewLast = base.sequencing.liftPoints != null && base.sequencing.liftPoints <= -MIN_PRIMING_LIFT;
  const retentionWeak = base.retention.value != null && base.retention.value < 60;
  const wantsReview = (reviewHelps || retentionWeak) && base.coverage.reviews > 0;

  const reviewMinutes = toBlock(total * 0.2);
  const reviewBlock = (): DnaPlanBlock => ({
    order: order++,
    label: "Warm-up review",
    skill: "VOCABULARY",
    channel: "flashcard",
    minutes: reviewMinutes,
    purpose: "Reactivate what's fading",
    href: "/flashcards",
    why: reviewHelps
      ? `Measured: your sessions score ${base.sequencing.liftPoints} points higher when review comes first.`
      : `Your retention is ${base.retention.value}% — reactivating old material first stops it decaying further.`,
  });

  if (wantsReview && !reviewLast) blocks.push(reviewBlock());

  // Main block: the weakest skill with evidence, or the first untouched module.
  const weak = priorityWeakSkill(base);
  const untouched = untouchedBandSkills(base);
  const mainMinutes = toBlock(total * (wantsReview ? 0.5 : 0.65));

  if (untouched.length > 0) {
    const target = untouched[0];
    blocks.push({
      order: order++,
      label: `First ${target.label} attempt`,
      skill: target.key,
      channel: null,
      minutes: mainMinutes,
      purpose: "Close a blind spot",
      href: SKILL_HREF[target.key],
      why: `You have ${base.coverage.tests} attempts recorded but none in ${target.label} — on exam day an unpractised module scores like your weakest.`,
    });
  } else if (weak) {
    blocks.push({
      order: order++,
      label: `${weak.label} focus block`,
      skill: weak.key,
      channel: preferredChannel(base),
      minutes: mainMinutes,
      purpose: "Raise your ceiling",
      href: SKILL_HREF[weak.key],
      why: `${weak.reason} — and in a banded exam your weakest skill caps the overall score.`,
    });
  }

  // Secondary block: the skill that converts effort into score fastest, so the
  // session ends on something that visibly works.
  const fast = base.fastestGrowing;
  const secondaryMinutes = toBlock(total * 0.25);
  if (fast && fast.velocity != null && fast.velocity > 0 && (!weak || fast.key !== weak.key)) {
    blocks.push({
      order: order++,
      label: `${fast.label} momentum block`,
      skill: fast.key,
      channel: null,
      minutes: secondaryMinutes,
      purpose: "Bank a quick win",
      href: SKILL_HREF[fast.key],
      why: `${fast.label} is improving at about ${fast.velocity} band per 10 study days — your fastest-responding skill.`,
    });
  }

  if (wantsReview && reviewLast) blocks.push(reviewBlock());

  // Never return an empty plan: if nothing above qualified, the honest action is
  // to practise the strongest evidenced skill and keep the record growing.
  if (blocks.length === 0) {
    const anchor = base.strongest ?? base.skills.find((s) => s.events > 0) ?? null;
    blocks.push({
      order: order++,
      label: anchor ? `${anchor.label} practice` : "Practice session",
      skill: anchor ? anchor.key : null,
      channel: null,
      minutes: toBlock(total),
      purpose: "Keep the record growing",
      href: anchor ? SKILL_HREF[anchor.key] : "/learning",
      why: anchor
        ? `${anchor.label} is your most-evidenced skill (${anchor.events} sessions) — steady practice here keeps your profile current.`
        : "More activity lets the engine find the patterns specific to you.",
    });
  }

  return {
    window,
    totalMinutes: blocks.reduce((s, b) => s + b.minutes, 0),
    blocks,
    basis: [
      base.focus.idealLessonMin != null ? `length from your ${base.focus.idealLessonMin}-minute focus limit` : null,
      reviewHelps ? "order from your measured review-first advantage" : null,
      reviewLast ? "order from your measured practice-first advantage" : null,
      window ? `scheduled for your strongest window (${window.label.toLowerCase()})` : null,
    ]
      .filter((x): x is string => x !== null)
      .join("; ") || "built from your current skill evidence",
    confidence: base.focus.confidence === "insufficient" ? "low" : base.focus.confidence,
  };
}

// ---------------------------------------------------------------------------
// Change tracking
// ---------------------------------------------------------------------------

/** The previous snapshot the current profile is compared against. */
export interface DnaPrevious {
  dayKey: string;
  maturity: number | null;
  retentionScore: number | null;
  consistencyScore: number | null;
  motivationScore: number | null;
  confidenceScore: number | null;
  daysAgo: number;
}

export interface DnaChangeSets {
  improvements: DnaChange[];
  attention: DnaChange[];
}

/**
 * What has actually moved.
 *
 * Skill-level movement comes from the profile itself; whole-learner movement
 * (maturity, retention, consistency, motivation) needs the snapshot history,
 * which is exactly why those snapshots are stored. A change smaller than the
 * noise floor for its metric is not reported at all.
 */
export function computeChanges(base: DnaBase, previous: DnaPrevious | null): DnaChangeSets {
  const improvements: DnaChange[] = [];
  const attention: DnaChange[] = [];

  // --- Skill trajectories ---
  for (const skill of base.skills) {
    if (skill.improvement == null || skill.events < 2) continue;
    if (skill.improvement >= 0.3) {
      improvements.push({
        id: `skill-up-${skill.key}`,
        label: `${skill.label} up ${skill.improvement > 0 ? "+" : ""}${skill.improvement} band`,
        detail: skill.reason,
        delta: skill.improvement,
        unit: "band",
        direction: "up",
        href: SKILL_HREF[skill.key],
      });
    } else if (skill.improvement <= -0.3) {
      attention.push({
        id: `skill-down-${skill.key}`,
        label: `${skill.label} down ${skill.improvement} band`,
        detail: skill.reason,
        delta: skill.improvement,
        unit: "band",
        direction: "down",
        href: SKILL_HREF[skill.key],
      });
    }
  }

  // --- Fading skills: strong once, unpractised now ---
  for (const skill of base.skills) {
    if (skill.status !== "needs_reinforcement") continue;
    if (skill.lastPracticedDaysAgo == null || skill.lastPracticedDaysAgo <= 14) continue;
    attention.push({
      id: `skill-fading-${skill.key}`,
      label: `${skill.label} not practised for ${skill.lastPracticedDaysAgo} days`,
      detail: `Retention is at ${skill.retention}% — a short session now costs far less than relearning later.`,
      delta: skill.lastPracticedDaysAgo,
      unit: "days",
      direction: "down",
      href: SKILL_HREF[skill.key],
    });
  }

  // --- Repeated mistakes that are getting better or worse ---
  for (const mistake of base.mistakes) {
    if (mistake.trend === "falling") {
      improvements.push({
        id: `mistake-down-${mistake.tag}`,
        label: `"${mistake.label}" happening less often`,
        detail: mistake.evidence,
        delta: null,
        unit: "",
        direction: "up",
        href: "/dashboard",
      });
    } else if (mistake.trend === "rising") {
      attention.push({
        id: `mistake-up-${mistake.tag}`,
        label: `"${mistake.label}" happening more often`,
        detail: `${mistake.evidence}. ${mistake.fix}`,
        delta: mistake.occurrences,
        unit: "occurrences",
        direction: "down",
        href: "/dashboard",
      });
    }
  }

  // --- Motivation, already a measured fortnight-on-fortnight comparison ---
  if (base.motivation.deltaPercent != null && base.motivation.score.confidence !== "insufficient") {
    if (base.motivation.trend === "rising") {
      improvements.push({
        id: "motivation-up",
        label: `Activity up ${base.motivation.deltaPercent}% this fortnight`,
        detail: base.motivation.score.basis,
        delta: base.motivation.deltaPercent,
        unit: "%",
        direction: "up",
        href: "/learning-dna",
      });
    } else if (base.motivation.trend === "falling") {
      attention.push({
        id: "motivation-down",
        label: `Activity down ${Math.abs(base.motivation.deltaPercent)}% this fortnight`,
        detail: base.motivation.score.basis,
        delta: base.motivation.deltaPercent,
        unit: "%",
        direction: "down",
        href: "/challenge",
      });
    }
  }

  // --- Whole-learner movement, from the snapshot history ---
  if (previous) {
    const compare = (
      id: string,
      label: string,
      current: number | null,
      before: number | null,
      noiseFloor: number,
      href: string
    ) => {
      if (current == null || before == null) return;
      const delta = current - before;
      if (Math.abs(delta) < noiseFloor) return;
      const entry: DnaChange = {
        id,
        label: `${label} ${delta > 0 ? "up" : "down"} ${Math.abs(Math.round(delta))} points`,
        detail: `${before} → ${current} over the last ${previous.daysAgo} days`,
        delta: Math.round(delta),
        unit: "points",
        direction: delta > 0 ? "up" : "down",
        href,
      };
      if (delta > 0) improvements.push(entry);
      else attention.push(entry);
    };

    compare("maturity-change", "Learning maturity", base.maturity.value, previous.maturity, 4, "/learning-dna");
    compare("retention-change", "Retention", base.retention.value, previous.retentionScore, 5, "/flashcards");
    compare("consistency-change", "Consistency", base.consistency.value, previous.consistencyScore, 6, "/learning-dna");
    compare("confidence-change", "Confidence", base.learnerConfidence.value, previous.confidenceScore, 6, "/learning-dna");
  }

  return {
    improvements: improvements.slice(0, 6),
    attention: attention.slice(0, 6),
  };
}
