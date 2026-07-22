export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AccountNotice } from "@/components/account-notice";
import { SectionHeader } from "@/components/ui/section-header";
import { WidgetSkeleton } from "@/components/ui/widget-skeleton";
import { BandProgress } from "@/components/dashboard/band-progress";
import { SkillRadar } from "@/components/dashboard/skill-radar";
import { SkillJourney } from "@/components/learning/skill-journey";
import { FirstRunGuide } from "@/components/learning/first-run-guide";
import { PageHeader } from "@/components/ui/page-header";
import {
  GraduationCap, Mic, Bot, Trophy,
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

function Tile({ item }: { item: { href: string; label: string; desc: string; icon: any; color: string } }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="group flex flex-col items-center text-center gap-2.5 p-4 rounded-2xl bg-averna-dark/30 border border-white/5 transition-all duration-300 hover:bg-averna-dark/60 hover:-translate-y-1 hover:border-averna-neon/40 hover:shadow-[0_14px_40px_-16px_rgba(0,229,255,0.35)]"
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.color} transition-transform duration-300 group-hover:scale-110`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0 w-full">
        <p className="font-semibold text-white text-sm truncate">{item.label}</p>
        <p className="text-[11px] text-gray-400 truncate">{item.desc}</p>
      </div>
    </Link>
  );
}

export default async function LearningCenterPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true, targetBand: true },
  });
  if (!student) {
    return <AccountNotice title="No student profile found" message="Sign in with a student account to access the Learning Center." />;
  }

  const testsCount = await db.iELTSTest.count({ where: { studentId: student.id } });
  const isNewStudent = testsCount === 0;

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-5xl pb-24 lg:pb-8">
        <PageHeader
          back={{ href: "/dashboard", label: "Back to Dashboard" }}
          icon={GraduationCap}
          title={<>Learning <span className="neon-text-cyan">Center</span></>}
          subtitle="Everything to practise IELTS — your progress and all modules in one place. 📚"
        />

        {isNewStudent ? (
          <FirstRunGuide name={session.user.name} />
        ) : (
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <Suspense fallback={<WidgetSkeleton rows={3} />}>
              <BandProgress studentId={student.id} targetBand={student.targetBand} />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton rows={3} />}>
              <SkillRadar studentId={student.id} />
            </Suspense>
          </div>
        )}

        <SectionHeader icon={ClipboardList} title="Your Skill Journey" subtitle="Your level and next step in each IELTS skill" accent="text-averna-cyan" />
        <div className="mb-8">
          <Suspense fallback={<WidgetSkeleton rows={2} />}>
            <SkillJourney studentId={student.id} targetBand={student.targetBand} />
          </Suspense>
        </div>

        <SectionHeader icon={Sparkles} title="Also Practise" subtitle="Round out your English beyond the four skills" accent="text-averna-purple" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {ALSO.map((s) => <Tile key={s.href} item={s} />)}
        </div>

        <SectionHeader icon={Trophy} title="Tests & Tools" subtitle="Exams, guides and AI help" accent="text-averna-neon" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {TESTS.map((t) => <Tile key={t.href} item={t} />)}
        </div>
      </div>
    </div>
  );
}
