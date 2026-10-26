import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Bot, Sparkles, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { DashRow, DASH_CARD } from "@/components/ui/dash-row";
import { COACH_TOOLS, type CoachTool } from "@/components/coach/coach-tools";
import { navBadge } from "@/components/layout/portal-navigation";

export const metadata = { title: "AI Coach" };

function CoachCard({ tool, now }: { tool: CoachTool; now: Date }) {
  const Icon = tool.icon;
  const badge = navBadge(tool, now);
  const titleId = `coach-${tool.href.replace(/[^a-z0-9]+/gi, "-")}`;
  return (
    <article aria-labelledby={titleId} className={cn(DASH_CARD, "glass border-white/10 p-4 sm:p-5")}>
      <div className="flex items-start gap-3">
        <span aria-hidden className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", tool.tone)}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="flex flex-wrap items-center gap-2 text-base font-semibold text-white">
            {tool.name}
            {badge && (
              <span className="rounded-full bg-averna-primary/30 px-2 py-0.5 text-[11px] font-medium leading-4 text-white">{badge}</span>
            )}
          </h3>
          <p className="mt-1 text-sm leading-snug text-gray-300">{tool.useWhen}</p>
        </div>
      </div>
      <div className="mt-auto pt-4">
        <Link
          href={tool.href}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-averna-primary/25 px-4 text-sm font-semibold text-white transition-colors hover:bg-averna-primary/40 sm:w-auto"
        >
          {tool.cta}
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

/**
 * AI Coach hub: the single front door to every AI helper (examiner, mentor,
 * Averna AI, Essay X-Ray, roleplay, Learning DNA) and the people who coach
 * you (speaking partner, 1-on-1 tutoring). Each tool keeps its own page.
 */
export default async function CoachPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");

  const now = new Date();
  const ai = COACH_TOOLS.filter((t) => t.group === "ai");
  const people = COACH_TOOLS.filter((t) => t.group === "people");

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-5xl px-4 py-4 pb-10 sm:py-6">
        <PageHeader
          back={{ href: "/dashboard", label: "Back to Dashboard" }}
          icon={Bot}
          iconClassName="text-averna-neon"
          title={<>AI <span className="neon-text-cyan">Coach</span></>}
          subtitle="Every helper in one place. Pick the one that fits what you need right now."
        />

        <section aria-label="AI helpers" className="mb-8">
          <SectionHeader icon={Sparkles} title="AI helpers" subtitle="Instant feedback, any time of day" accent="text-averna-neon" />
          <DashRow cols={3} className="md:grid-cols-2">
            {ai.map((t) => (
              <CoachCard key={t.href} tool={t} now={now} />
            ))}
          </DashRow>
        </section>

        <section aria-label="People">
          <SectionHeader icon={Users} title="People" subtitle="Practise with a classmate or a teacher" accent="text-averna-cyan" />
          <DashRow cols={2} at="md">
            {people.map((t) => (
              <CoachCard key={t.href} tool={t} now={now} />
            ))}
          </DashRow>
        </section>
      </div>
    </div>
  );
}
