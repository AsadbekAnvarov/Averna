import Link from "next/link";
import { Clock, Flame, ArrowRight } from "lucide-react";
import { getHabitInsight } from "@/lib/habits";

const TONE = {
  cyan: { ring: "border-averna-cyan/30", glow: "bg-averna-cyan/10", icon: "text-averna-cyan" },
  amber: { ring: "border-amber-500/30", glow: "bg-amber-500/10", icon: "text-amber-400" },
  neon: { ring: "border-averna-neon/30", glow: "bg-averna-neon/10", icon: "text-averna-neon" },
} as const;

/**
 * F4 — Personal Habit Intelligence. A slim, single-line strip that gently nudges
 * the student toward their usual study time (or warmly affirms it once they've
 * shown up). Renders nothing until the AI has a real, repeated signal, so it's
 * never noisy. Server component.
 */
export async function HabitNudge({ studentId, streak = 0 }: { studentId: string; streak?: number }) {
  const insight = await getHabitInsight(studentId, streak);
  if (!insight) return null;

  const t = TONE[insight.tone];
  const Icon = insight.icon === "flame" ? Flame : Clock;

  return (
    <div className={`relative overflow-hidden glass border ${t.ring} rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 animate-fade-in`}>
      <div className={`pointer-events-none absolute -top-10 -left-6 h-24 w-24 rounded-full ${t.glow} blur-2xl`} />

      <div className="relative flex items-start gap-3 flex-1 min-w-0">
        <div className={`shrink-0 h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${t.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{insight.title}</p>
          <p className="text-xs text-gray-300 mt-0.5">{insight.body}</p>
        </div>
      </div>

      {insight.cta && (
        <Link
          href={insight.cta.href}
          className={`relative shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium bg-white/5 border ${t.ring} text-white hover:bg-white/10 transition-colors`}
        >
          {insight.cta.label} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
