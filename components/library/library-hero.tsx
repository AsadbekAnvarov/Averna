import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Aurora } from "@/components/motion/aurora";
import { SkillIcon, type SkillLike } from "@/components/progression/ui";

/** Calm page hero shared by the exam-library pages. */
export function LibraryHero({
  skill,
  eyebrow,
  title,
  subtitle,
  facts = [],
  children,
}: {
  skill: SkillLike;
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Short format facts shown as pills ("3 passages", "60 minutes" …). */
  facts?: string[];
  children?: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby="library-hero-title"
      className="av-panel av-panel-hero relative isolate mb-6 overflow-hidden rounded-3xl px-5 pb-6 pt-3 sm:px-8 sm:pb-8 sm:pt-5"
    >
      <Aurora intensity="soft" />
      <Link
        href="/learning"
        className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm text-gray-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Learning Center
      </Link>
      <div className="mt-2 flex items-start gap-4">
        <SkillIcon skill={skill} className="h-12 w-12 rounded-2xl" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">{eyebrow}</p>
          <h1 id="library-hero-title" className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base">{subtitle}</p>
        </div>
      </div>
      {facts.length > 0 && (
        <ul role="list" aria-label="Test format" className="mt-5 flex flex-wrap gap-2">
          {facts.map((f) => (
            <li key={f} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
              {f}
            </li>
          ))}
        </ul>
      )}
      {children}
    </section>
  );
}
