import { getProgression } from "@/lib/engine/progression/service";
import { SkillProgress } from "./skill-progress";
import { StreakWeek } from "./streak-week";
import { ChallengesCard } from "./challenges-card";
import { RecentBadges } from "./recent-badges";
import { LevelCard } from "./level-card";
import { ErrorPanel } from "./error-panel";
import { Reveal } from "@/components/motion/reveal";
import { DashRow } from "@/components/ui/dash-row";

async function load(studentId: string) {
  return getProgression(studentId).catch((e) => {
    console.error("getProgression failed:", e);
    return null;
  });
}

/**
 * The Today tab below the Daily Session hero, in priority order:
 *   What's due → Four skills → Challenges + Achievements.
 *
 * The old Today's Mission card and the "Averna recommends" card are gone: the
 * Daily Session hero (components/session) covers both with one plan and one
 * Continue button. The Daily Mission rules still run here for the XP bonus and
 * badges. `homework` is a slot for the page's own widget so the tab reads as
 * one calm column. getProgression is cached per request, so <ProgressionStreak/>
 * next to the hero and the Progress tab's <ProgressionLevel/> reuse the same
 * computation for free. It settles earned rewards first (idempotent), so a
 * reward the evidence supports is always shown as earned.
 */
export async function ProgressionHome({ studentId, homework }: { studentId: string; homework?: React.ReactNode }) {
  const p = await load(studentId);
  if (!p) {
    return (
      <div className="space-y-3 md:space-y-6">
        <ErrorPanel
          title="We couldn't load your progress."
          detail="Your progress is safe — this is only a display problem."
          retryHref="/dashboard"
        />
        {homework}
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-6">
      <Reveal>{homework}</Reveal>

      <Reveal>
        <SkillProgress profile={p.profile} targetBand={p.targetBand} insight={p.insight} weakestSkill={p.weakest?.skill ?? null} />
      </Reveal>

      <Reveal>
        <DashRow at="md">
          <ChallengesCard daily={p.daily} weekly={p.weekly} />
          <RecentBadges badges={p.badges} recent={p.recentBadges} />
        </DashRow>
      </Reveal>
    </div>
  );
}

/** This week's streak strip (beside the Daily Session hero). Renders nothing if progression can't load. */
export async function ProgressionStreak({ studentId }: { studentId: string }) {
  const p = await load(studentId);
  if (!p) return null;
  return <StreakWeek streak={p.streak} />;
}

/** Level tier card on its own (Progress tab). Renders nothing if progression can't load. */
export async function ProgressionLevel({ studentId }: { studentId: string }) {
  const p = await load(studentId);
  if (!p) return null;
  return <LevelCard level={p.level} todayXp={p.todayXp} />;
}
