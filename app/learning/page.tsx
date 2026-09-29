export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getLibraryStats,
  listListeningExams,
  listReadingExams,
  listWritingTasks,
  type LibraryStats,
} from "@/lib/ielts/catalog";
import type { ExamTestSummary, GroupKind } from "@/lib/ielts/types";
import { AccountNotice } from "@/components/account-notice";
import { SectionHeader } from "@/components/ui/section-header";
import { WidgetSkeleton } from "@/components/ui/widget-skeleton";
import { BandProgress } from "@/components/dashboard/band-progress";
import { SkillRadar } from "@/components/dashboard/skill-radar";
import { SkillJourney } from "@/components/learning/skill-journey";
import { FirstRunGuide } from "@/components/learning/first-run-guide";
import { Aurora } from "@/components/motion/aurora";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { kindLabels } from "@/components/library/badges";
import { MockExamCard, SkillLibraryCard, type SkillCardData } from "@/components/library/hub-cards";
import {
  ArrowLeft, GraduationCap, Target, Mic, Bot, Trophy,
  Zap, Layers, Library, Newspaper, ClipboardList, SpellCheck, Sparkles,
} from "lucide-react";

// Counts kept as multiples of 4 so the 2/4-column grids are always gap-free.
const ALSO = [
  { href: "/learning/pronunciation", label: "Pronunciation", desc: "Speak & get scored", icon: Mic, color: "bg-averna-pink/15 text-averna-pink" },
  { href: "/grammar", label: "Grammar", desc: "Essentials & tips", icon: SpellCheck, color: "bg-averna-purple/15 text-averna-purple" },
  { href: "/flashcards", label: "Vocabulary", desc: "Flashcards & word lists", icon: Layers, color: "bg-averna-cyan/15 text-averna-cyan" },
  { href: "/article", label: "Daily Article", desc: "Read & learn words", icon: Newspaper, color: "bg-averna-neon/15 text-averna-neon" },
];

const TESTS = [
  { href: "/learning/mock-exam", label: "Mock Exam", desc: "Full timed test", icon: Trophy, color: "bg-yellow-500/15 text-yellow-400" },
  { href: "/learning/examiner", label: "AI Examiner", desc: "Speak, get a band", icon: Bot, color: "bg-averna-cyan/15 text-averna-cyan" },
  { href: "/challenge", label: "Daily Challenge", desc: "Quick daily quiz", icon: Zap, color: "bg-averna-purple/15 text-averna-purple" },
  { href: "/materials", label: "Materials", desc: "Guides & word lists", icon: Library, color: "bg-averna-pink/15 text-averna-pink" },
];

type TileItem = (typeof ALSO)[number];

function Tile({ item }: { item: TileItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="av-panel glow-hover group flex h-full min-h-[44px] flex-col items-center gap-2.5 rounded-2xl p-4 text-center"
    >
      <span
        aria-hidden
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.color} transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100`}
      >
        <Icon className="h-6 w-6" />
      </span>
      <span className="block w-full min-w-0">
        <span className="block truncate text-sm font-semibold text-white">{item.label}</span>
        <span className="block truncate text-[11px] text-gray-400">{item.desc}</span>
      </span>
    </Link>
  );
}

const HERO_FACTS = ["Real exam format", "Timed like test day", "Band score after every test"];

/** "12 full Reading tests · 3 short practice" */
function examCount(s: LibraryStats["reading"] | undefined, noun: string): string {
  if (!s) return "Full exam papers and short practice";
  const practice = Math.max(0, s.total - s.full);
  const out: string[] = [];
  if (s.full > 0) out.push(`${s.full} full ${noun} ${s.full === 1 ? "test" : "tests"}`);
  if (practice > 0) out.push(`${practice} short practice`);
  return out.join(" · ") || "New tests are on the way";
}

/** Question types across the library, most common first. */
function commonKinds(exams: ExamTestSummary[], fallback: string[]): string[] {
  const freq = new Map<GroupKind, number>();
  for (const e of exams) for (const k of e.kinds) freq.set(k, (freq.get(k) ?? 0) + 1);
  const labels = kindLabels(Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).map(([k]) => k));
  return labels.length ? labels : fallback;
}

function topTypes(prompts: { type: string }[], n: number): string[] {
  const freq = new Map<string, number>();
  for (const p of prompts) {
    const t = p.type?.trim();
    if (t) freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, n).map(([t]) => t);
}

export default async function LearningCenterPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");

  // Library data is independent of the student — start it right away (cached, never throws).
  const libraryP = Promise.all([
    getLibraryStats().catch(() => null),
    listReadingExams().catch((): ExamTestSummary[] => []),
    listListeningExams().catch((): ExamTestSummary[] => []),
    listWritingTasks("task1").catch(() => []),
    listWritingTasks("task2").catch(() => []),
  ]);

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true, targetBand: true },
  });
  if (!student) {
    return <AccountNotice title="No student profile found" message="Sign in with a student account to access the Learning Center." />;
  }

  const [testsCount, [stats, reading, listening, task1, task2]] = await Promise.all([
    db.iELTSTest.count({ where: { studentId: student.id } }),
    libraryP,
  ]);
  const isNewStudent = testsCount === 0;

  const writingTypes = [...topTypes(task1, 2), ...topTypes(task2, 2)];
  const writingCount = stats
    ? [stats.writing.task1 > 0 && `${stats.writing.task1} Task 1`, stats.writing.task2 > 0 && `${stats.writing.task2} Task 2`]
        .filter(Boolean)
        .join(" · ") || "New prompts are on the way"
    : "Task 1 and Task 2 prompts";
  const speakingSets = stats?.speaking.sets ?? 0;

  const skills: SkillCardData[] = [
    {
      skill: "READING",
      title: "Reading",
      count: examCount(stats?.reading, "Reading"),
      format: "3 passages · 40 questions · 60 min",
      inside: commonKinds(reading, ["True / False / Not Given", "Matching", "Multiple choice", "Completion"]),
      href: "/learning/reading",
    },
    {
      skill: "LISTENING",
      title: "Listening",
      count: examCount(stats?.listening, "Listening"),
      format: "4 parts · 40 questions · ~30 min",
      inside: commonKinds(listening, ["Completion", "Multiple choice", "Matching", "Choose two/three"]),
      href: "/learning/listening",
    },
    {
      skill: "WRITING",
      title: "Writing",
      count: writingCount,
      format: "Task 1 · 20 min  ·  Task 2 · 40 min",
      inside: writingTypes.length ? writingTypes : ["Charts & graphs", "Processes & maps", "Opinion essays", "Discussion essays"],
      href: "/learning/writing",
    },
    {
      skill: "SPEAKING",
      title: "Speaking",
      count: !stats ? "Full speaking tests" : speakingSets > 0 ? `${speakingSets} full ${speakingSets === 1 ? "test" : "tests"}` : "New tests are on the way",
      format: "3 parts · 11–14 min",
      inside: ["Part 1 interview", "Part 2 cue card", "Part 3 discussion"],
      href: "/learning/speaking-test",
    },
  ];

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-5xl px-4 py-6 pb-10 sm:py-8 lg:pb-8">
        {/* Hero */}
        <section
          aria-labelledby="learning-hero-title"
          className="av-panel av-panel-hero relative isolate mb-8 overflow-hidden rounded-3xl px-5 pb-8 pt-3 sm:px-10 sm:pb-12 sm:pt-6"
        >
          <Aurora />
          <Link
            href="/dashboard"
            className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm text-gray-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Dashboard
          </Link>
          <p className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">
            <GraduationCap className="h-4 w-4" aria-hidden />
            Learning Center
          </p>
          <h1
            id="learning-hero-title"
            className="mt-3 max-w-2xl text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl"
          >
            Real IELTS practice, every day
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-300 sm:text-lg">
            Full papers in the real computer-delivered format — timed like test day and scored on the IELTS band scale.
          </p>
          <ul role="list" aria-label="What you get" className="mt-6 flex flex-wrap gap-2">
            {HERO_FACTS.map((f) => (
              <li
                key={f}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-200"
              >
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-averna-neon" />
                {f}
              </li>
            ))}
          </ul>
        </section>

        {/* The four skills */}
        <Reveal>
          <SectionHeader icon={Target} title="Choose a skill" subtitle="Full exam papers or short, focused practice" accent="text-averna-neon" />
        </Reveal>
        <RevealGroup as="ul" role="list" className="mb-6 grid gap-4 sm:grid-cols-2">
          {skills.map((s) => (
            <SkillLibraryCard key={s.skill} data={s} />
          ))}
        </RevealGroup>

        {/* Full mock */}
        <Reveal className="mb-10">
          <MockExamCard />
        </Reveal>

        {isNewStudent ? (
          <Reveal>
            <FirstRunGuide name={session.user.name} />
          </Reveal>
        ) : (
          <Reveal className="mb-8 grid gap-6 lg:grid-cols-2">
            <Suspense fallback={<WidgetSkeleton rows={3} />}>
              <BandProgress studentId={student.id} targetBand={student.targetBand} />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton rows={3} />}>
              <SkillRadar studentId={student.id} />
            </Suspense>
          </Reveal>
        )}

        <Reveal>
          <SectionHeader icon={ClipboardList} title="Your Skill Journey" subtitle="Your level and next step in each IELTS skill" accent="text-averna-cyan" />
          <div className="mb-8">
            <Suspense fallback={<WidgetSkeleton rows={2} />}>
              <SkillJourney studentId={student.id} targetBand={student.targetBand} />
            </Suspense>
          </div>
        </Reveal>

        <Reveal>
          <SectionHeader icon={Sparkles} title="Also Practise" subtitle="Round out your English beyond the four skills" accent="text-averna-purple" />
        </Reveal>
        <RevealGroup as="ul" role="list" className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {ALSO.map((s) => (
            <li key={s.href}>
              <Tile item={s} />
            </li>
          ))}
        </RevealGroup>

        <Reveal>
          <SectionHeader icon={Trophy} title="Tests & Tools" subtitle="Exams, guides and AI help" accent="text-averna-neon" />
        </Reveal>
        <RevealGroup as="ul" role="list" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {TESTS.map((t) => (
            <li key={t.href}>
              <Tile item={t} />
            </li>
          ))}
        </RevealGroup>
      </div>
    </div>
  );
}
