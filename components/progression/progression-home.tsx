import { getProgression } from "@/lib/engine/progression/service";
import { TodayMission } from "./today-mission";
import { SkillProgress } from "./skill-progress";
import { NextActivity } from "./next-activity";
import { StreakWeek } from "./streak-week";
import { ChallengesCard } from "./challenges-card";
import { RecentBadges } from "./recent-badges";
import { LevelCard } from "./level-card";
import { ErrorPanel } from "./error-panel";
import { Reveal } from "@/components/motion/reveal";

async function load(studentId: string) {
  return getProgression(studentId).catch((e) => {
    console.error("getProgression failed:", e);
    return null;
  });
}

/**
 * The Today tab's learning loop, in priority order:
 *   Today's Mission → What's due (+ the single best next step) → Four skills
 *   + Streak → Challenges + Achievements.
 *
 * `homework` / `aside` are slots for the page's own widgets so the whole tab
 * reads as one calm column. getProgression is cached per request, so the
 * Progress tab's <ProgressionLevel/> reuses the same computation for free.
 * It settles earned rewards first (idempotent), so a reward the evidence
 * supports is always shown as earned.
 */
export async function ProgressionHome({
  studentId,
  homework,
  aside,
}: {
  studentId: string;
  homework?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  const p = await load(studentId);
  if (!p) {
    return (
      <div className="space-y-4 md:space-y-6">
        <ErrorPanel
          title="We couldn't load your mission."
          detail="Your progress is safe — this is only a display problem."
          retryHref="/dashboard"
        />
        {homework}
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <Reveal>
        <TodayMission mission={p.mission} firstName={p.firstName} isNew={p.isNew} />
      </Reveal>

      <Reveal className="grid items-start gap-4 md:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">{homework}</div>
        <div className="space-y-4 md:space-y-6">
          <NextActivity rec={p.recommendation} />
          {aside}
        </div>
      </Reveal>

      <Reveal className="grid gap-4 md:gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SkillProgress profile={p.profile} targetBand={p.targetBand} insight={p.insight} weakestSkill={p.weakest?.skill ?? null} />
        </div>
        <div className="lg:col-span-2">
          <StreakWeek streak={p.streak} />
        </div>
      </Reveal>

      <Reveal className="grid gap-4 md:gap-6 md:grid-cols-2">
        <ChallengesCard daily={p.daily} weekly={p.weekly} />
        <RecentBadges badges={p.badges} recent={p.recentBadges} />
      </Reveal>
    </div>
  );
}

/** Level tier card on its own (Progress tab). Renders nothing if progression can't load. */
export async function ProgressionLevel({ studentId }: { studentId: string }) {
  const p = await load(studentId);
  if (!p) return null;
  return <LevelCard level={p.level} todayXp={p.todayXp} />;
}
