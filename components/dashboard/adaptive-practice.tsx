import Link from "next/link";
import { getStudentTests } from "@/lib/student-intel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge, BookOpen, Headphones, PenLine, Mic, TrendingUp, TrendingDown, Minus, ArrowRight, Target } from "lucide-react";

const MODULES = [
  { key: "READING", label: "Reading", href: "/learning/reading", icon: BookOpen },
  { key: "LISTENING", label: "Listening", href: "/learning/listening", icon: Headphones },
  { key: "WRITING", label: "Writing", href: "/learning/writing", icon: PenLine },
  { key: "SPEAKING", label: "Speaking", href: "/learning/speaking", icon: Mic },
] as const;

function tierFor(band: number): { label: string; cls: string; hint: string } {
  if (band < 5) return { label: "Foundation", cls: "text-red-300 border-red-500/40 bg-red-500/10", hint: "Build the fundamentals with guided, lower-difficulty sets." };
  if (band < 6) return { label: "Core", cls: "text-amber-400 border-amber-500/40 bg-amber-500/10", hint: "Consolidate at standard difficulty and target your weak questions." };
  if (band < 7) return { label: "Advanced", cls: "text-averna-cyan border-averna-cyan/40 bg-averna-cyan/10", hint: "Step up to harder passages and tighter timing." };
  return { label: "Exam", cls: "text-averna-neon border-averna-neon/40 bg-averna-neon/10", hint: "Simulate full exams under time pressure to hold Band 7+." };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Adaptive Practice Plan — a read-only advisor that reads the student's recent
 * test results per module, works out the trend, and recommends the right
 * difficulty tier plus a direct link to practise it. Delivers the intelligence
 * of adaptive difficulty without touching the test runner. Server component.
 */
export async function AdaptivePractice({ studentId }: { studentId: string }) {
  // Shared cached history is ascending (oldest -> newest); reverse so the
  // per-module arrays stay newest -> oldest, which the trend logic below expects.
  const tests = [...(await getStudentTests(studentId))].reverse();

  const byModule = new Map<string, number[]>();
  for (const t of tests) {
    const arr = byModule.get(t.module) ?? [];
    arr.push(t.score); // ordered newest -> oldest
    byModule.set(t.module, arr);
  }

  const rows = MODULES.map((m) => {
    const scores = byModule.get(m.key) ?? [];
    const recent = avg(scores.slice(0, 3));
    const earlier = avg(scores.slice(3, 6));
    const trend = earlier > 0 ? recent - earlier : 0;
    return { ...m, count: scores.length, recent, trend };
  });

  const practiced = rows.filter((r) => r.count > 0);
  // Focus = lowest recent band among practised modules; else first unstarted.
  const focus =
    practiced.length > 0
      ? practiced.reduce((lo, r) => (r.recent < lo.recent ? r : lo))
      : rows.find((r) => r.count === 0) ?? rows[0];

  return (
    <Card className="glass border-averna-cyan/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-averna-cyan/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-cyan">
          <Gauge className="h-5 w-5" /> Adaptive Practice Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Focus recommendation */}
        <div className="rounded-xl border border-averna-cyan/30 bg-averna-cyan/5 p-3 flex items-center gap-3">
          <Target className="h-5 w-5 text-averna-cyan shrink-0" />
          <p className="text-sm text-gray-200">
            {focus.count === 0 ? (
              <>Start with a <span className="text-averna-cyan font-semibold">{focus.label}</span> diagnostic to build your plan.</>
            ) : (
              <>Focus area: <span className="text-averna-cyan font-semibold">{focus.label}</span> — your lowest band right now. {tierFor(focus.recent).hint}</>
            )}
          </p>
        </div>

        {/* Per-module rows */}
        <div className="space-y-2">
          {rows.map((r) => {
            const Icon = r.icon;
            const tier = tierFor(r.recent);
            return (
              <Link
                key={r.key}
                href={r.href}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2.5 transition-colors group"
              >
                <Icon className="h-5 w-5 text-gray-300 shrink-0" />
                <span className="w-20 shrink-0 text-sm text-white">{r.label}</span>

                {r.count > 0 ? (
                  <>
                    <span className="text-sm font-bold text-white tabular-nums w-9">{r.recent.toFixed(1)}</span>
                    <span className="w-6 shrink-0">
                      {r.trend > 0.05 ? (
                        <TrendingUp className="h-4 w-4 text-averna-neon" />
                      ) : r.trend < -0.05 ? (
                        <TrendingDown className="h-4 w-4 text-red-300" />
                      ) : (
                        <Minus className="h-4 w-4 text-gray-500" />
                      )}
                    </span>
                    <span className={`hidden sm:inline text-[11px] px-2 py-0.5 rounded-full border ${tier.cls}`}>{tier.label}</span>
                  </>
                ) : (
                  <span className="flex-1 text-xs text-gray-500">Not started</span>
                )}

                <ArrowRight className="h-4 w-4 text-gray-500 group-hover:text-averna-cyan ml-auto shrink-0 transition-colors" />
              </Link>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-500 text-center">
          Recommendations adapt to your last few results in each module.
        </p>
      </CardContent>
    </Card>
  );
}
