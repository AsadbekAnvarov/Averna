export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDashboardStudent } from "@/lib/dashboard/data";
import { parseDashboardTab, type DashboardTabKey } from "@/lib/dashboard/tabs";
import { ClassTab, HomeTab, LearnTab, PlayTab, ProgressTab, type TabPanelProps } from "@/components/dashboard/tab-panels";

/**
 * Student dashboard — five calm tabs, each with a handful of blocks and no
 * repeats. The active tab is the `?tab=` param and only that tab is rendered
 * (the shell lives in ./layout.tsx):
 *   Today    (/dashboard)               who I am, today's mission, what's due, skills, streak, challenges
 *   Learn    (/dashboard?tab=learn)     AI tutor, the skill map, Practice Studio shelf, daily reading
 *   Progress (/dashboard?tab=progress)  bands & skills, level & weekly goal, DNA & achievements, heatmap
 *   Class    (/dashboard?tab=class)     teacher & messages, squad goal, rivals & class feed, community
 *   Play     (/dashboard?tab=fun)       mood, daily rewards, word games, study buddy
 * Deep-dives live on their own pages: /progress/*, /rankings/*, /studio/*.
 */
const PANELS: Record<DashboardTabKey, (props: TabPanelProps) => Promise<JSX.Element>> = {
  home: HomeTab,
  learn: LearnTab,
  progress: ProgressTab,
  class: ClassTab,
  fun: PlayTab,
};

export default async function DashboardPage(props: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const searchParams = (await props.searchParams) ?? {};
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  // The layout redirects teachers / admins and shows the notice for a missing profile.
  if (session.user.role === "ADMIN" || session.user.role === "TEACHER") return null;

  const student = await getDashboardStudent(session.user.id);
  if (!student) return null;

  const Panel = PANELS[parseDashboardTab(searchParams.tab)];
  return <Panel student={student} userId={session.user.id} />;
}
