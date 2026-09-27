import { Suspense } from "react";
import { getProgression } from "@/lib/engine/progression/service";
import { TodayMission } from "./today-mission";
import { SkillProgress } from "./skill-progress";
import { NextActivity } from "./next-activity";
import { StreakWeek } from "./streak-week";
import { ChallengesCard } from "./challenges-card";
import { RecentBadges } from "./recent-badges";
import { LevelCard } from "./level-card";
import { ActivityHistory } from "./activity-history";
import { ProgressionSkeleton } from "./progression-skeleton";
import { ErrorPanel } from "./error-panel";
import { Reveal } from "@/components/motion/reveal";

/**
 * The Home tab's learning loop, in priority order:
 *   Today's Mission → Four skills + Recommendation → Level + Streak
 *   → Challenges + Achievements → Recent activity
 *
 * One cached progression computation feeds every card, so the whole block costs
 * a single set of queries. getProgression settles earned rewards first
 * (idempotent), so a reward the evidence supports is always shown as earned.
 */
export async function ProgressionHome({ studentId }: { studentId: string }) {
  const p = await getProgression(studentId).catch((e) => {
    console.error("getProgression failed:", e);
    return null;
  });
  if (!p) {
    return (
      <ErrorPanel
        title="We couldn't load your mission."
        detail="Your progress is safe — this is only a display problem."
        retryHref="/dashboard"
      />
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <Reveal>
        <TodayMission mission={p.mission} firstName={p.firstName} isNew={p.isNew} />
      </Reveal>

      <Reveal className="grid gap-4 md:gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SkillProgress profile={p.profile} targetBand={p.targetBand} insight={p.insight} weakestSkill={p.weakest?.skill ?? null} />
        </div>
        <div className="lg:col-span-2">
          <NextActivity rec={p.recommendation} />
        </div>
      </Reveal>

      <Reveal className="grid gap-4 md:gap-6 md:grid-cols-2">
        <LevelCard level={p.level} todayXp={p.todayXp} />
        <StreakWeek streak={p.streak} />
      </Reveal>

      <Reveal className="grid gap-4 md:gap-6 md:grid-cols-2">
        <ChallengesCard daily={p.daily} weekly={p.weekly} />
        <RecentBadges badges={p.badges} recent={p.recentBadges} />
      </Reveal>

      <Reveal>
        <Suspense fallback={<ProgressionSkeleton rows={1} />}>
          <ActivityHistory studentId={studentId} />
        </Suspense>
      </Reveal>
    </div>
  );
}
