import { Trophy } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { HubNav } from "@/components/ui/hub-nav";

/** Rankings hub: Leaderboard · Leagues · Teams (each its own route). */
export default function RankingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-6xl px-4 py-6 pb-10 sm:py-8">
        <PageHeader
          className="mb-4 sm:mb-5"
          back={{ href: "/dashboard", label: "Back to Dashboard" }}
          icon={Trophy}
          iconClassName="text-amber-400"
          title="Rankings"
          subtitle="The all-time leaderboard, this week's league and the group race."
        />
        <HubNav hub="rankings" label="Rankings sections" />
        {children}
      </div>
    </div>
  );
}
