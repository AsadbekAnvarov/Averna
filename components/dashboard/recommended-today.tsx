import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, PenTool, BookOpen, Headphones, Mic, RotateCcw, ClipboardList, Trophy, ArrowRight } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";

const MOD: Record<string, { label: string; href: string; icon: any; color: string }> = {
  WRITING: { label: "Writing", href: "/learning/writing", icon: PenTool, color: "bg-averna-purple/15 text-averna-purple" },
  READING: { label: "Reading", href: "/learning/reading", icon: BookOpen, color: "bg-averna-blue/15 text-averna-blue" },
  LISTENING: { label: "Listening", href: "/learning/listening", icon: Headphones, color: "bg-emerald-400/15 text-emerald-400" },
  SPEAKING: { label: "Speaking", href: "/learning/speaking", icon: Mic, color: "bg-averna-pink/15 text-averna-pink" },
};

/**
 * "Recommended for you today" — a smart, personalised plan: resume your last
 * module, attack your weakest skill, finish the nearest homework, with a mock
 * exam as a fallback. Removes the "what should I do now?" friction.
 */
export async function RecommendedToday({ studentId, groupId }: { studentId: string; groupId: string | null }) {
  const [tests, dueHw] = await Promise.all([
    db.iELTSTest.findMany({ where: { studentId }, select: { module: true, score: true, completedAt: true } }),
    groupId
      ? db.homework.findFirst({
          where: { groupId, dueDate: { gte: new Date() }, submissions: { none: { studentId } } },
          orderBy: { dueDate: "asc" },
          select: { id: true, title: true, module: true },
        })
      : Promise.resolve(null),
  ]);

  // weakest module by average
  const sums = new Map<string, { total: number; count: number }>();
  let lastModule: string | null = null;
  let lastTime = 0;
  for (const t of tests) {
    const r = sums.get(t.module) ?? { total: 0, count: 0 };
    r.total += t.score;
    r.count += 1;
    sums.set(t.module, r);
    const ts = new Date(t.completedAt).getTime();
    if (ts > lastTime) {
      lastTime = ts;
      lastModule = t.module;
    }
  }
  let weakest: string | null = null;
  let weakestAvg = Infinity;
  for (const [mod, r] of sums.entries()) {
    const avg = r.total / r.count;
    if (avg < weakestAvg) {
      weakestAvg = avg;
      weakest = mod;
    }
  }

  type Rec = { icon: any; iconBg: string; title: string; desc: string; href: string };
  const recs: Rec[] = [];

  if (dueHw) {
    const m = MOD[dueHw.module] ?? MOD.WRITING;
    recs.push({ icon: ClipboardList, iconBg: "bg-amber-400/15 text-amber-400", title: "Finish your homework", desc: dueHw.title, href: "/schedule" });
  }
  if (weakest && MOD[weakest]) {
    recs.push({ icon: MOD[weakest].icon, iconBg: MOD[weakest].color, title: `Strengthen ${MOD[weakest].label}`, desc: `Your lowest skill (avg ${weakestAvg.toFixed(1)}) — a quick session helps most`, href: MOD[weakest].href });
  }
  if (lastModule && MOD[lastModule] && lastModule !== weakest) {
    recs.push({ icon: RotateCcw, iconBg: MOD[lastModule].color, title: `Continue ${MOD[lastModule].label}`, desc: "Pick up where you left off", href: MOD[lastModule].href });
  }
  if (recs.length === 0) {
    recs.push({ icon: Trophy, iconBg: "bg-amber-400/15 text-amber-400", title: "Take a mock exam", desc: "Get your first band estimate", href: "/learning/mock-exam" });
  }

  return (
    <Card className="glass border-averna-neon/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-neon">
          <Sparkles className="h-5 w-5" /> Recommended Today
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-3 gap-3">
          {recs.slice(0, 3).map((r) => {
            const Icon = r.icon;
            return (
              <Link
                key={r.title}
                href={r.href}
                className="group flex flex-col gap-2 p-4 rounded-xl bg-averna-dark/30 border border-white/5 hover:border-averna-neon/40 hover:-translate-y-0.5 transition-all"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${r.iconBg}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white text-sm">{r.title}</p>
                  <p className="text-xs text-gray-400 line-clamp-2">{r.desc}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-averna-neon">
                  Start <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
