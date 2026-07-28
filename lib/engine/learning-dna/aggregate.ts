import { db } from "@/lib/db";
import {
  AGGREGATE_K_THRESHOLD,
  ALL_STYLES,
  BAND_SKILLS,
  DAYPART_LABEL,
  DAY_MS,
  SKILL_LABEL,
  STYLE_LABEL,
} from "./config";
import { mean } from "./metrics";
import { tashkentParts } from "./signals";
import type { DnaAggregate, DnaDaypart, LearningStyle, SkillKey } from "./types";

/**
 * Learning DNA Engine — anonymous platform-wide aggregation.
 *
 * Powers the administrator's behavioural analytics. Two properties are
 * non-negotiable here, because this is the one surface where one person looks at
 * everybody's data:
 *
 *  1. ANONYMITY BY CONSTRUCTION. No identifier, name or group is selected — not
 *     filtered out later, simply never read. And nothing is published unless it
 *     describes at least `AGGREGATE_K_THRESHOLD` learners, so a figure can never
 *     be traced back to an individual in a small cohort.
 *
 *  2. NO JSON PARSING. Everything comes from the denormalised scalar columns on
 *     LearningProfile, so this is an indexed scan over one narrow table rather
 *     than deserialising thousands of profile payloads. That's what keeps the
 *     admin dashboard fast as the centre grows.
 */

interface ProfileRow {
  maturity: number;
  preferredStyle: string | null;
  focusMinutes: number | null;
  idealLessonMin: number | null;
  optimalDaypart: string | null;
  motivationTrend: string | null;
  retentionScore: number | null;
  consistencyScore: number | null;
  learningSpeed: number | null;
  weakestSkill: string | null;
  listeningAccuracy: number | null;
  dataPoints: number;
}

interface SnapshotRow {
  dayKey: string;
  maturity: number;
  motivationScore: number | null;
}

/** An aggregate with nothing in it — returned whenever the cohort is too small
 *  to publish, so the caller always gets the same shape. */
function emptyAggregate(profiles: number): DnaAggregate {
  return {
    profiles,
    kThreshold: AGGREGATE_K_THRESHOLD,
    suppressed: true,
    styles: [],
    avgFocusMinutes: null,
    avgIdealLessonMinutes: null,
    hardestSkills: [],
    motivation: { rising: 0, steady: 0, falling: 0 },
    retention: { avg: null, strong: 0, fading: 0 },
    avgLearningSpeed: null,
    avgConsistency: null,
    avgMaturity: null,
    dayparts: [],
    maturityTrend: [],
  };
}

function isStyle(value: string | null): value is LearningStyle {
  return value != null && (ALL_STYLES as string[]).includes(value);
}

function isSkill(value: string | null): value is SkillKey {
  return value != null && (BAND_SKILLS as string[]).includes(value);
}

/**
 * Platform-wide behavioural analytics.
 *
 * Every returned figure answers a question an administrator can act on: which
 * learning styles the centre actually serves, how long the average attention span
 * is (so lesson lengths can be set from evidence), which IELTS skill is hardest
 * across the whole student body, and whether motivation and retention are trending
 * the right way.
 */
export async function getDnaAggregate(): Promise<DnaAggregate> {
  let rows: ProfileRow[] = [];
  try {
    rows = await db.learningProfile.findMany({
      // Deliberately no studentId: this query cannot identify anyone.
      select: {
        maturity: true,
        preferredStyle: true,
        focusMinutes: true,
        idealLessonMin: true,
        optimalDaypart: true,
        motivationTrend: true,
        retentionScore: true,
        consistencyScore: true,
        learningSpeed: true,
        weakestSkill: true,
        listeningAccuracy: true,
        dataPoints: true,
      },
    });
  } catch {
    return emptyAggregate(0);
  }

  if (rows.length < AGGREGATE_K_THRESHOLD) {
    return emptyAggregate(rows.length);
  }

  // --- Learning styles: only styles held by at least K learners are named ---
  const styleCounts = new Map<LearningStyle, number>();
  for (const row of rows) {
    if (!isStyle(row.preferredStyle)) continue;
    styleCounts.set(row.preferredStyle, (styleCounts.get(row.preferredStyle) ?? 0) + 1);
  }
  const styledTotal = Array.from(styleCounts.values()).reduce((s, n) => s + n, 0);
  const styles = Array.from(styleCounts.entries())
    .filter(([, count]) => count >= AGGREGATE_K_THRESHOLD)
    .map(([style, count]) => ({
      style,
      label: STYLE_LABEL[style],
      count,
      share: styledTotal > 0 ? Math.round((count / styledTotal) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // --- Attention span: evidence for how long lessons should actually be ---
  const focusValues = rows.map((r) => r.focusMinutes).filter((v): v is number => v != null);
  const idealValues = rows.map((r) => r.idealLessonMin).filter((v): v is number => v != null);
  const avgFocusMinutes =
    focusValues.length >= AGGREGATE_K_THRESHOLD ? Math.round(mean(focusValues)!) : null;
  const avgIdealLessonMinutes =
    idealValues.length >= AGGREGATE_K_THRESHOLD ? Math.round(mean(idealValues)!) : null;

  // --- Hardest skills: how often each module is a learner's weakest ---
  const weakCounts = new Map<SkillKey, number>();
  for (const row of rows) {
    if (!isSkill(row.weakestSkill)) continue;
    weakCounts.set(row.weakestSkill, (weakCounts.get(row.weakestSkill) ?? 0) + 1);
  }
  const hardestSkills = BAND_SKILLS.map((skill) => {
    const learners = weakCounts.get(skill) ?? 0;
    return {
      skill,
      label: SKILL_LABEL[skill],
      // Only the platform-wide listening measurement is stored per profile; for
      // the others the honest answer is "we count how often it's the weakest".
      avgAccuracy:
        skill === "LISTENING"
          ? (() => {
              const values = rows.map((r) => r.listeningAccuracy).filter((v): v is number => v != null);
              return values.length >= AGGREGATE_K_THRESHOLD ? Math.round(mean(values)!) : null;
            })()
          : null,
      learners,
    };
  })
    .filter((s) => s.learners >= AGGREGATE_K_THRESHOLD || s.avgAccuracy != null)
    .sort((a, b) => b.learners - a.learners);

  // --- Motivation distribution ---
  const motivation = { rising: 0, steady: 0, falling: 0 };
  for (const row of rows) {
    if (row.motivationTrend === "rising") motivation.rising += 1;
    else if (row.motivationTrend === "falling") motivation.falling += 1;
    else if (row.motivationTrend === "steady") motivation.steady += 1;
  }

  // --- Retention ---
  const retentionValues = rows.map((r) => r.retentionScore).filter((v): v is number => v != null);
  const retention = {
    avg: retentionValues.length >= AGGREGATE_K_THRESHOLD ? Math.round(mean(retentionValues)!) : null,
    strong: retentionValues.filter((v) => v >= 70).length,
    fading: retentionValues.filter((v) => v < 50).length,
  };

  const speedValues = rows.map((r) => r.learningSpeed).filter((v): v is number => v != null);
  const consistencyValues = rows.map((r) => r.consistencyScore).filter((v): v is number => v != null);
  const maturityValues = rows.map((r) => r.maturity);

  // --- When the student body actually studies best ---
  const daypartCounts = new Map<DnaDaypart, number>();
  for (const row of rows) {
    const key = row.optimalDaypart as DnaDaypart | null;
    if (key == null || DAYPART_LABEL[key] == null) continue;
    daypartCounts.set(key, (daypartCounts.get(key) ?? 0) + 1);
  }
  const daypartTotal = Array.from(daypartCounts.values()).reduce((s, n) => s + n, 0);
  const dayparts = Array.from(daypartCounts.entries())
    .filter(([, count]) => count >= AGGREGATE_K_THRESHOLD)
    .map(([daypart, count]) => ({
      daypart,
      label: DAYPART_LABEL[daypart],
      count,
      share: daypartTotal > 0 ? Math.round((count / daypartTotal) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // --- Trend: is the student body maturing as learners? ---
  let maturityTrend: DnaAggregate["maturityTrend"] = [];
  try {
    // Filtered on the indexed `dayKey` (a "YYYY-MM-DD" string, so lexicographic
    // comparison is chronological) rather than `createdAt`, which only records
    // when the row was first inserted.
    const sinceKey = tashkentParts(Date.now() - 60 * DAY_MS).dayKey;
    const snapshots = await db.learningProfileSnapshot.findMany({
      where: { dayKey: { gte: sinceKey } },
      select: { dayKey: true, maturity: true, motivationScore: true },
      orderBy: { dayKey: "asc" },
      take: 5000,
    });

    const byDay = new Map<string, { maturity: number[]; motivation: number[] }>();
    for (const snap of snapshots as SnapshotRow[]) {
      const entry = byDay.get(snap.dayKey) ?? { maturity: [], motivation: [] };
      entry.maturity.push(snap.maturity);
      if (snap.motivationScore != null) entry.motivation.push(snap.motivationScore);
      byDay.set(snap.dayKey, entry);
    }

    maturityTrend = Array.from(byDay.entries())
      // Suppress any day whose cohort is too small to be anonymous.
      .filter(([, v]) => v.maturity.length >= AGGREGATE_K_THRESHOLD)
      .map(([dayKey, v]) => ({
        dayKey,
        maturity: Math.round(mean(v.maturity)!),
        motivation: v.motivation.length >= AGGREGATE_K_THRESHOLD ? Math.round(mean(v.motivation)!) : null,
      }))
      .sort((a, b) => a.dayKey.localeCompare(b.dayKey))
      .slice(-30);
  } catch {
    maturityTrend = [];
  }

  return {
    profiles: rows.length,
    kThreshold: AGGREGATE_K_THRESHOLD,
    suppressed: false,
    styles,
    avgFocusMinutes,
    avgIdealLessonMinutes,
    hardestSkills,
    motivation,
    retention,
    avgLearningSpeed:
      speedValues.length >= AGGREGATE_K_THRESHOLD ? Math.round(mean(speedValues)! * 100) / 100 : null,
    avgConsistency:
      consistencyValues.length >= AGGREGATE_K_THRESHOLD ? Math.round(mean(consistencyValues)!) : null,
    avgMaturity: maturityValues.length > 0 ? Math.round(mean(maturityValues)!) : null,
    dayparts,
    maturityTrend,
  };
}
