export const dynamic = "force-dynamic";

import Link from "next/link";
import { Dumbbell, Sparkles, Gamepad2, ListChecks, Trophy, Zap, Clapperboard, Gift, ArrowRight } from "lucide-react";
import { getPageStudent } from "@/lib/student-page";
import { AccountNotice } from "@/components/account-notice";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { StudioShelf } from "@/components/studio/studio-shelf";
import { RecordsWall } from "@/components/dashboard/records-wall";

export const metadata = { title: "Practice Studio" };

/** Practice pages that live outside /studio but belong to this hub (they left the sidebar). */
const MORE = [
  { href: "/learning/mock-exam", label: "Mock exams", desc: "A full timed test with a band", icon: Trophy, tone: "bg-yellow-500/15 text-yellow-400" },
  { href: "/challenge", label: "Daily Challenge", desc: "Five quick questions, new every day", icon: Zap, tone: "bg-averna-purple/15 text-averna-purple" },
  { href: "/movies", label: "Movie Time", desc: "Learn English through films", icon: Clapperboard, tone: "bg-averna-pink/15 text-averna-pink" },
  { href: "/rewards", label: "Rewards", desc: "Spend the points you earn", icon: Gift, tone: "bg-averna-neon/15 text-averna-neon" },
];

/** Practice Studio: every quick practice tool and word game, one tap away. */
export default async function StudioPage() {
  const { student } = await getPageStudent();
  if (!student) {
    return <AccountNotice title="No student profile found" message="Sign in with a student account to use the Practice Studio." />;
  }

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-5xl px-4 py-4 pb-10 sm:py-6">
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

        <section aria-label="More ways to practise" className="mb-10">
          <SectionHeader icon={ListChecks} title="More ways to practise" subtitle="Full exams, the daily quiz, movies and your rewards" accent="text-averna-cyan" />
          <ul role="list" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {MORE.map(({ href, label, desc, icon: Icon, tone }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="glass group flex h-full min-h-[44px] items-center gap-3 rounded-2xl border border-white/10 p-4 transition-colors hover:border-white/20"
                >
                  <span aria-hidden className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">{label}</span>
                    <span className="block truncate text-xs text-gray-400">{desc}</span>
                  </span>
                  <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <div data-gamified>
          <RecordsWall mysteryCount={student.cosmetics.length} />
        </div>
      </div>
    </div>
  );
}
