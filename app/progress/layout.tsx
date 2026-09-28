import { TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { HubNav } from "@/components/ui/hub-nav";

/** My Progress hub: Overview · Skills · Streaks · Achievements (each its own route). */
export default function ProgressLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-6xl px-4 py-6 pb-10 sm:py-8">
        <PageHeader
          className="mb-4 sm:mb-5"
          back={{ href: "/dashboard", label: "Back to Dashboard" }}
          icon={TrendingUp}
          title={<>My <span className="neon-text-cyan">Progress</span></>}
          subtitle="Your bands, skills, streaks and achievements — all in one place."
        />
        <HubNav hub="progress" label="Progress sections" />
        {children}
      </div>
    </div>
  );
}
