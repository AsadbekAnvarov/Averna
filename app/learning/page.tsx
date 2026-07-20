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
import {
  GraduationCap, Mic, Bot, Trophy,
  Zap, Layers, Library, ArrowRight, ClipboardList, SpellCheck, Sparkles,
} from "lucide-react";

const ALSO = [
  { href: "/learning/pronunciation", label: "Pronunciation", desc: "Speak & get scored", icon: Mic, color: "bg-averna-pink/15 text-averna-pink", hover: "hover:border-averna-pink/40" },
  { href: "/grammar", label: "Grammar", desc: "Essentials & tips", icon: SpellCheck, color: "bg-averna-purple/15 text-averna-purple", hover: "hover:border-averna-purple/40" },
  { href: "/flashcards", label: "Vocabulary", desc: "Flashcards & word lists", icon: Layers, color: "bg-averna-cyan/15 text-averna-cyan", hover: "hover:border-averna-cyan/40" },
];

const TESTS = [
  { href: "/learning/mock-exam", label: "Mock Exam", desc: "Full timed test", icon: Trophy, color: "bg-yellow-500/15 text-yellow-400", hover: "hover:border-yellow-400/40" },
  { href: "/learning/examiner", label: "AI Examiner", desc: "Speak, get a band", icon: Bot, color: "bg-averna-cyan/15 text-averna-cyan", hover: "hover:border-averna-cyan/40" },
  { href: "/challenge", label: "Daily Challenge", desc: "Quick daily quiz", icon: Zap, color: "bg-averna-cyan/15 text-averna-cyan", hover: "hover:border-averna-cyan/40" },
  { href: "/materials", label: "Materials", desc: "Guides & word lists", icon: Library, color: "bg-averna-cyan/15 text-averna-cyan", hover: "hover:border-averna-cyan/40" },
  { href: "/mentor", label: "AI Mentor", desc: "Ask for help", icon: Bot, color: "bg-averna-neon/15 text-averna-neon", hover: "hover:border-averna-neon/40" },
];

function Tile({ item }: { item: { href: string; label: string; desc: string; icon: any; color: string; hover: string } }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className="group">
      <div className={`flex items-center gap-4 p-4 rounded-xl bg-averna-dark/30 border border-white/5 transition-all duration-300 hover:bg-averna-dark/50 hover:-translate-y-0.5 ${item.hover}`}>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${item.color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white text-sm truncate">{item.label}</p>
          <p className="text-xs text-gray-400 truncate">{item.desc}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-gray-500 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white" />
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

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-5xl pb-24 lg:pb-8">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">← Back to Dashboard</Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <GraduationCap className="h-8 w-8 text-averna-cyan" />
          Learning <span className="neon-text-cyan">Center</span>
        </h1>
        <p className="text-gray-400 mb-8">Everything to practise IELTS — your progress and all modules in one place. 📚</p>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Suspense fallback={<WidgetSkeleton rows={3} />}>
            <BandProgress studentId={student.id} targetBand={student.targetBand} />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton rows={3} />}>
            <SkillRadar studentId={student.id} />
          </Suspense>
        </div>

        <SectionHeader icon={ClipboardList} title="Your Skill Journey" subtitle="Your level and next step in each IELTS skill" accent="text-averna-cyan" />
        <div className="mb-8">
          <Suspense fallback={<WidgetSkeleton rows={2} />}>
            <SkillJourney studentId={student.id} targetBand={student.targetBand} />
          </Suspense>
        </div>

        <SectionHeader icon={Sparkles} title="Also Practise" subtitle="Round out your English beyond the four skills" accent="text-averna-purple" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {ALSO.map((s) => <Tile key={s.href} item={s} />)}
        </div>

        <SectionHeader icon={Trophy} title="Tests & Tools" subtitle="Exams, guides and AI help" accent="text-averna-neon" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TESTS.map((t) => <Tile key={t.href} item={t} />)}
        </div>
      </div>
    </div>
  );
}
