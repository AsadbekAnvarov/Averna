import Link from "next/link";
import { db } from "@/lib/db";
import { PenTool, BookOpen, Headphones, Mic, ArrowRight, PlayCircle } from "lucide-react";

const MODULES = [
  { key: "READING", label: "Reading", href: "/learning/reading", icon: BookOpen, accent: "text-averna-blue", chip: "bg-averna-blue/15 text-averna-blue", bar: "from-averna-blue to-averna-cyan", ring: "hover:border-averna-blue/40" },
  { key: "LISTENING", label: "Listening", href: "/learning/listening", icon: Headphones, accent: "text-emerald-400", chip: "bg-emerald-400/15 text-emerald-400", bar: "from-emerald-400 to-averna-neon", ring: "hover:border-emerald-400/40" },
  { key: "WRITING", label: "Writing", href: "/learning/writing", icon: PenTool, accent: "text-averna-purple", chip: "bg-averna-purple/15 text-averna-purple", bar: "from-averna-purple to-averna-pink", ring: "hover:border-averna-purple/40" },
  { key: "SPEAKING", label: "Speaking", href: "/learning/speaking", icon: Mic, accent: "text-averna-pink", chip: "bg-averna-pink/15 text-averna-pink", bar: "from-averna-pink to-orange-400", ring: "hover:border-averna-pink/40" },
] as const;

function relativeTime(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? "" : "s"} ago`;
  return `${Math.floor(days / 30)} month${days < 60 ? "" : "s"} ago`;
}

/**
 * "Your Skill Journey" — a per-skill overview for the four scored IELTS
 * modules. For each skill a student sees, at a glance: their current level
 * (average band), how many tests they've done, when they last practised,
 * progress toward their target band, and a single clear next action.
 * All figures come from real IELTSTest records — nothing is invented.
 */
export async function SkillJourney({
  studentId,
  targetBand,
}: {
  studentId: string;
  targetBand?: string | null;
}) {
  const tests = await db.iELTSTest.findMany({
    where: { studentId },
    select: { module: true, score: true, completedAt: true },
  });

  const stats = new Map<string, { total: number; count: number; lastAt: Date }>();
  for (const t of tests) {
    const r = stats.get(t.module) ?? { total: 0, count: 0, lastAt: new Date(0) };
    r.total += t.score;
    r.count += 1;
    const at = new Date(t.completedAt);
    if (at > r.lastAt) r.lastAt = at;
    stats.set(t.module, r);
  }

  const target = targetBand ? parseFloat(targetBand.replace(/[^0-9.]/g, "")) : null;

  // Determine the weakest tested skill to flag as the recommended focus.
  let weakestKey: string | null = null;
  let weakestAvg = Infinity;
  for (const m of MODULES) {
    const r = stats.get(m.key);
    if (r && r.count > 0) {
      const avg = r.total / r.count;
      if (avg < weakestAvg) {
        weakestAvg = avg;
        weakestKey = m.key;
      }
    }
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {MODULES.map((m) => {
        const Icon = m.icon;
        const r = stats.get(m.key);
        const started = !!r && r.count > 0;
        const avg = started ? r!.total / r!.count : 0;
        const pct = target && avg > 0 ? Math.min(100, Math.round((avg / target) * 100)) : 0;
        const isFocus = m.key === weakestKey;

        return (
          <Link
            key={m.key}
            href={m.href}
            className={`group block rounded-2xl glass border border-white/5 p-5 transition-all duration-300 hover:-translate-y-0.5 ${m.ring}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${m.chip}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-white">{m.label}</p>
                  <p className="text-xs text-gray-400">
                    {started ? `${r!.count} test${r!.count === 1 ? "" : "s"} · last ${relativeTime(r!.lastAt)}` : "Not started yet"}
                  </p>
                </div>
              </div>
              {isFocus && (
                <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 font-medium">
                  Focus
                </span>
              )}
            </div>

            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-500">Current level</p>
                <p className={`text-3xl font-bold leading-none mt-1 ${started ? "text-white" : "text-gray-600"}`}>
                  {started ? avg.toFixed(1) : "—"}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${m.accent}`}>
                {started ? <>Continue <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" /></> : <>Start <PlayCircle className="h-4 w-4" /></>}
              </span>
            </div>

            {target && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-gray-500">Goal {target.toFixed(1)}</span>
                  <span className={started && avg >= target ? "text-averna-neon" : "text-gray-500"}>
                    {started ? (avg >= target ? "Reached 🎉" : `${(target - avg).toFixed(1)} to go`) : ""}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${m.bar} transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
