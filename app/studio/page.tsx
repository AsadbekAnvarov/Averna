export const dynamic = "force-dynamic";

import { Dumbbell, Sparkles, Gamepad2 } from "lucide-react";
import { getPageStudent } from "@/lib/student-page";
import { AccountNotice } from "@/components/account-notice";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { StudioShelf } from "@/components/studio/studio-shelf";
import { RecordsWall } from "@/components/dashboard/records-wall";

export const metadata = { title: "Practice Studio" };

/** Practice Studio: every quick practice tool and word game, one tap away. */
export default async function StudioPage() {
  const { student } = await getPageStudent();
  if (!student) {
    return <AccountNotice title="No student profile found" message="Sign in with a student account to use the Practice Studio." />;
  }

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-5xl px-4 py-6 pb-10 sm:py-8">
        <PageHeader
          back={{ href: "/dashboard", label: "Back to Dashboard" }}
          icon={Dumbbell}
          iconClassName="text-averna-purple"
          title={<>Practice <span className="neon-text-purple">Studio</span></>}
          subtitle="Quick tools and games to sharpen your English — pick one and go."
        />

        <section className="mb-10">
          <SectionHeader icon={Sparkles} title="Practice tools" subtitle="Five focused minutes at a time" accent="text-averna-neon" />
          <StudioShelf group="practice" />
        </section>

        <section id="games" className="mb-10 scroll-mt-24" data-gamified>
          <SectionHeader icon={Gamepad2} title="Word games" subtitle="Beat your own best — every day" accent="text-averna-pink" />
          <StudioShelf group="games" />
        </section>

        <div data-gamified>
          <RecordsWall mysteryCount={student.cosmetics.length} />
        </div>
      </div>
    </div>
  );
}
