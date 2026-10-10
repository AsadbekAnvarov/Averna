/**
 * The five student dashboard tabs as server components. app/dashboard/page.tsx
 * renders only the one the `?tab=` param selects, so a request fetches just
 * that tab's data. Each panel reads what it needs in parallel; the student row
 * and the homework list come from React cache (shared with the layout).
 */
import { NextSessionCard } from "@/components/study/next-session-card";
import { Suspense } from "react";
import { Dumbbell, Gamepad2, Newspaper } from "lucide-react";
import { db } from "@/lib/db";
import { getGlobalRank } from "@/lib/db-helpers";
import { BUDGETED_ACTIONS } from "@/lib/engine/xp-engine";
import { tashkentDayStart, tashkentWeekStart } from "@/lib/utils";
import { getDashboardHomework, type DashboardStudent } from "@/lib/dashboard/data";
import { SectionHeader } from "@/components/ui/section-header";
import { WidgetSkeleton } from "@/components/ui/widget-skeleton";
// Today
import { AdventuresEntry } from "@/components/dashboard/adventures-entry";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { HabitNudge } from "@/components/dashboard/habit-nudge";
import { PlacementPrompt } from "@/components/placement/placement-prompt";
import { ProgressionHome, ProgressionLevel } from "@/components/progression/progression-home";
import { ProgressionSkeleton } from "@/components/progression/progression-skeleton";
import { UpcomingHomework } from "@/components/dashboard/upcoming-homework";
import { ExamCountdown } from "@/components/dashboard/exam-countdown";
// Learn
import { AvernaAiSection } from "@/components/dashboard/averna-ai-section";
import { LivingCampusSection } from "@/components/dashboard/living-campus-section";
import { StudioShelf } from "@/components/studio/studio-shelf";
import { DailyArticle } from "@/components/dashboard/daily-article";
import { WordOfTheDay } from "@/components/dashboard/word-of-the-day";
// Progress
import { BandProgress } from "@/components/dashboard/band-progress";
import { SkillRadar } from "@/components/dashboard/skill-radar";
import { WeeklyGoal } from "@/components/dashboard/weekly-goal";
import { LearningDnaCard } from "@/components/dashboard/learning-dna-card";
import { AchievementsProgress } from "@/components/dashboard/achievements-progress";
import { StreakHeatmap } from "@/components/dashboard/streak-heatmap";
import { ProgressLinks } from "@/components/progress/progress-links";
// Class
import { TeacherCard } from "@/components/dashboard/teacher-card";
import { MessagePreview } from "@/components/dashboard/message-preview";
import { StudySquad } from "@/components/dashboard/study-squad";
import { LeaderboardWidget } from "@/components/dashboard/leaderboard-widget";
import { GroupFeed } from "@/components/dashboard/group-feed";
import { CommunityChallenge } from "@/components/dashboard/community-challenge";
// Play
import { MoodCheckin } from "@/components/dashboard/mood-checkin";
import { DailySpin } from "@/components/dashboard/daily-spin";
import { DailyQuests } from "@/components/dashboard/daily-quests";
import { MysteryBox } from "@/components/dashboard/mystery-box";
import { StudyPet } from "@/components/dashboard/study-pet";
import { StudentOfTheWeek } from "@/components/student-of-the-week";

export interface TabPanelProps {
  student: DashboardStudent;
  userId: string;
}

/** Today: who I am, today's mission, what's due, skills, streak, challenges. */
export async function HomeTab({ student }: TabPanelProps) {
  // The streak is advanced by VERIFIED learning (see updateStudentPoints), not
  // by opening the dashboard. Rank is computed on read (cheap indexed count).
  const today = tashkentDayStart();
  const [globalRank, dailyQuote, hw] = await Promise.all([
    getGlobalRank(student.totalPoints),
    db.dailyQuote.findFirst({
      where: { date: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) } },
    }),
    getDashboardHomework(student.id, student.groupId),
  ]);

  return (
    <>
      <DashboardHero
        name={student.user.name}
        image={student.user.image}
        points={student.totalPoints}
        streak={student.currentStreak}
        globalRank={globalRank}
        goal={student.personalGoal}
        quote={dailyQuote}
        featuredCosmetic={student.featuredCosmetic}
      />
      <AdventuresEntry />
      <NextSessionCard />
      <Suspense fallback={null}>
        <HabitNudge studentId={student.id} streak={student.currentStreak} />
      </Suspense>
      {/* New students: find your level (hidden once a placement test is finished). */}
      <Suspense fallback={null}>
        <PlacementPrompt studentId={student.id} />
      </Suspense>
      <Suspense fallback={<ProgressionSkeleton rows={3} />}>
        <ProgressionHome
          studentId={student.id}
          homework={<UpcomingHomework homework={hw.shown} counts={hw.counts} />}
          aside={<ExamCountdown />}
        />
      </Suspense>
    </>
  );
}

/** Learn: AI tutor, the skill map, Practice Studio shelf, daily reading. */
export async function LearnTab({ student }: TabPanelProps) {
  const firstName = (student.user.name ?? "there").split(" ")[0];

  return (
    <>
      <Suspense fallback={<WidgetSkeleton rows={3} />}>
        <AvernaAiSection studentId={student.id} firstName={firstName} />
      </Suspense>
      <Suspense fallback={<WidgetSkeleton rows={4} />}>
        <LivingCampusSection studentId={student.id} />
      </Suspense>
      <section>
        <SectionHeader
          icon={Dumbbell}
          title="Practice Studio"
          subtitle="Quick tools — each opens on its own page"
          accent="text-averna-purple"
          action={{ label: "All tools", href: "/studio" }}
        />
        <StudioShelf group="practice" />
      </section>
      <section>
        <SectionHeader icon={Newspaper} title="Daily reading" subtitle="A little input every day goes a long way" accent="text-averna-cyan" />
        <div className="grid grid-cols-1 items-start gap-4 md:gap-6 md:grid-cols-2">
          <DailyArticle />
          <WordOfTheDay />
        </div>
      </section>
    </>
  );
}

/** Progress: bands & skills, level & weekly goal, DNA & achievements, heatmap. */
export async function ProgressTab({ student }: TabPanelProps) {
  const [globalRank, weeklyCompleted] = await Promise.all([
    getGlobalRank(student.totalPoints),
    // Real study sessions this week, Monday–Sunday in Tashkent (not reward spends or logins).
    db.activityLog.count({
      where: {
        studentId: student.id,
        createdAt: { gte: tashkentWeekStart() },
        action: { in: BUDGETED_ACTIONS },
        points: { gt: 0 },
      },
    }),
  ]);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <Suspense fallback={<WidgetSkeleton rows={3} />}>
          <BandProgress studentId={student.id} targetBand={student.targetBand} />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton rows={3} />}>
          <SkillRadar studentId={student.id} />
        </Suspense>
      </div>
      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-2">
        <Suspense fallback={<WidgetSkeleton rows={3} />}>
          <ProgressionLevel studentId={student.id} />
        </Suspense>
        <WeeklyGoal completed={weeklyCompleted} />
      </div>
      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-2">
        <Suspense fallback={<WidgetSkeleton rows={3} />}>
          <LearningDnaCard studentId={student.id} />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton rows={4} />}>
          <AchievementsProgress studentId={student.id} longestStreak={student.longestStreak} globalRank={globalRank} />
        </Suspense>
      </div>
      <Suspense fallback={<WidgetSkeleton rows={4} />}>
        <StreakHeatmap studentId={student.id} />
      </Suspense>
      <ProgressLinks />
    </>
  );
}

/** Class: teacher & messages, squad goal, rivals & class feed, community. */
export async function ClassTab({ student, userId }: TabPanelProps) {
  return (
    <>
      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-2">
        <Suspense fallback={<WidgetSkeleton rows={2} />}>
          <TeacherCard groupId={student.groupId} />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton rows={3} />}>
          <MessagePreview userId={userId} />
        </Suspense>
      </div>
      <Suspense fallback={<WidgetSkeleton rows={4} />}>
        <StudySquad groupId={student.groupId} studentId={student.id} />
      </Suspense>
      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-2">
        <Suspense fallback={<WidgetSkeleton rows={4} />}>
          <LeaderboardWidget studentId={student.id} groupId={student.groupId} />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton rows={4} />}>
          <GroupFeed studentId={student.id} groupId={student.groupId} />
        </Suspense>
      </div>
      <Suspense fallback={<WidgetSkeleton rows={4} />}>
        <CommunityChallenge studentId={student.id} />
      </Suspense>
    </>
  );
}

/** Play: mood, daily rewards, word games, study buddy. Hidden in focus mode. */
export async function PlayTab({ student }: TabPanelProps) {
  return (
    <>
      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 md:grid-cols-2">
        <MoodCheckin />
        <div data-gamified>
          <DailySpin />
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 md:grid-cols-2" data-gamified>
        <DailyQuests studentId={student.id} streakFreezes={student.streakFreezes} />
        <MysteryBox />
      </div>
      <section data-gamified>
        <SectionHeader
          icon={Gamepad2}
          title="Word games"
          subtitle="Beat your own best — every day"
          accent="text-averna-pink"
          action={{ label: "Practice Studio", href: "/studio#games" }}
        />
        <StudioShelf group="games" />
      </section>
      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 md:grid-cols-2" data-gamified>
        <StudyPet streak={student.currentStreak} points={student.totalPoints} />
        <Suspense fallback={<WidgetSkeleton rows={2} />}>
          <StudentOfTheWeek />
        </Suspense>
      </div>
    </>
  );
}
