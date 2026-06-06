import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { db } from "@/lib/db";
import { Brain, ArrowRight, Headphones, BookOpen, PenTool, Mic } from "lucide-react";

type ModuleKey = "LISTENING" | "READING" | "WRITING" | "SPEAKING";

const PLAN: Record<
  ModuleKey,
  { label: string; href: string; icon: typeof Headphones; color: string; steps: string[] }
> = {
  LISTENING: {
    label: "Listening",
    href: "/learning/listening",
    icon: Headphones,
    color: "text-emerald-400",
    steps: ["Do a Listening test", "Note the words you missed", "Re-listen and shadow the audio"],
  },
  READING: {
    label: "Reading",
    href: "/learning/reading",
    icon: BookOpen,
    color: "text-blue-400",
    steps: ["Read one passage", "Practise skimming & scanning", "Learn 5 new academic words"],
  },
  WRITING: {
    label: "Writing",
    href: "/learning/writing",
    icon: PenTool,
    color: "text-purple-400",
    steps: ["Write a Task 2 essay", "Refine it in the Writing Lab", "Add 3 linking phrases"],
  },
  SPEAKING: {
    label: "Speaking",
    href: "/learning/speaking",
    icon: Mic,
    color: "text-orange-400",
    steps: ["Try a Roleplay scenario", "Record with the AI Examiner", "Practise fluency for 5 minutes"],
  },
};

const ORDER: ModuleKey[] = ["LISTENING", "READING", "WRITING", "SPEAKING"];

function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

export async function SmartFocus({ studentId }: { studentId: string }) {
  const tests = await db.iELTSTest.findMany({
    where: { studentId },
    select: { module: true, score: true },
  });

  // Average band per skill
  const stats = ORDER.map((key) => {
    const ms = tests.filter((t) => t.module === key);
    const avg = ms.length ? roundHalf(ms.reduce((a, b) => a + b.score, 0) / ms.length) : null;
    return { key, avg, count: ms.length };
  });

  const withData = stats.filter((s) => s.avg !== null) as { key: ModuleKey; avg: number; count: number }[];

  // Not enough signal yet — gently nudge to gather data
  if (withData.length < 2) {
    return (
      <Card className="glass border-averna-purple/30 animate-fade-in">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-averna-purple/15 border border-averna-purple/30">
              <Brain className="h-4 w-4 text-averna-purple" />
            </span>
            Smart Focus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-300">
            Complete exercises in at least two skills and I&apos;ll build a personalised focus plan that
            targets your weakest area first. 🎯
          </p>
          <Link
            href="/learning/listening"
            className="inline-flex items-center gap-1 mt-3 text-sm text-averna-cyan hover:underline"
          >
            Start with Listening <ArrowRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    );
  }

  const weakest = [...withData].sort((a, b) => a.avg - b.avg)[0];
  const strongest = [...withData].sort((a, b) => b.avg - a.avg)[0];
  const plan = PLAN[weakest.key];
  const Icon = plan.icon;
  const maxBand = 9;

  return (
    <Card className="glass border-averna-purple/30 animate-fade-in">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-averna-purple/15 border border-averna-purple/30">
              <Brain className="h-4 w-4 text-averna-purple" />
            </span>
            Smart Focus
          </span>
          <span className="text-xs font-normal text-gray-400">personalised for you</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recommendation */}
        <Link
          href={plan.href}
          className={`group block p-4 rounded-xl border-2 border-white/10 bg-white/[0.03] hover:border-averna-purple/40 transition-all`}
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10">
              <Icon className={`h-6 w-6 ${plan.color}`} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-400">Focus on your weakest skill</p>
              <p className={`text-lg font-bold ${plan.color}`}>
                {plan.label}{" "}
                <span className="text-sm font-normal text-gray-400">· band {weakest.avg.toFixed(1)}</span>
              </p>
            </div>
            <ArrowRight className={`h-5 w-5 ${plan.color} group-hover:translate-x-1 transition-transform`} />
          </div>
        </Link>

        {/* Micro-plan */}
        <div>
          <p className="text-xs font-semibold text-gray-400 mb-2">Today&apos;s 3-step plan</p>
          <ol className="space-y-1.5">
            {plan.steps.map((step, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                <span className="h-5 w-5 shrink-0 rounded-full bg-averna-purple/20 text-averna-purple text-[11px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Skill comparison bars */}
        <div className="space-y-1.5 pt-1">
          {stats.map((s) => {
            const meta = PLAN[s.key];
            const pct = s.avg !== null ? (s.avg / maxBand) * 100 : 0;
            const isWeak = s.key === weakest.key;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <span className="w-16 text-[11px] text-gray-400 shrink-0">{meta.label}</span>
                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      isWeak ? "bg-gradient-to-r from-orange-400 to-averna-pink" : "bg-averna-cyan/60"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`w-8 text-right text-[11px] font-semibold ${isWeak ? "text-orange-300" : "text-gray-400"}`}>
                  {s.avg !== null ? s.avg.toFixed(1) : "—"}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-gray-500">
          💪 Your strongest skill is {PLAN[strongest.key].label} (band {strongest.avg.toFixed(1)}). Lifting your
          weakest area raises your overall band the fastest.
        </p>
      </CardContent>
    </Card>
  );
}
