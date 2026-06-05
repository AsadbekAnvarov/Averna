export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AccountNotice } from "@/components/account-notice";
import {
  TrendingUp,
  Headphones,
  BookOpen,
  PenTool,
  Mic,
  Target,
  Sparkles,
  ArrowLeft,
} from "lucide-react";

type ModuleKey = "LISTENING" | "READING" | "WRITING" | "SPEAKING";

const MODULES: { key: ModuleKey; label: string; icon: typeof Headphones; color: string }[] = [
  { key: "LISTENING", label: "Listening", icon: Headphones, color: "text-emerald-400" },
  { key: "READING", label: "Reading", icon: BookOpen, color: "text-blue-400" },
  { key: "WRITING", label: "Writing", icon: PenTool, color: "text-purple-400" },
  { key: "SPEAKING", label: "Speaking", icon: Mic, color: "text-orange-400" },
];

function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

function bandColor(band: number | null): string {
  if (band === null) return "text-gray-500";
  if (band >= 7) return "text-averna-neon";
  if (band >= 5.5) return "text-yellow-400";
  return "text-orange-400";
}

export default async function ProgressPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    include: {
      user: true,
      ieltsTests: { orderBy: { completedAt: "asc" } },
    },
  });

  if (!student) {
    return (
      <AccountNotice
        title="No student profile found"
        message="Sign in with a student account to view your progress."
      />
    );
  }

  const tests = student.ieltsTests;

  // Build an "estimated overall band" trend: after each test, average the
  // latest score per module up to that point (rounded to nearest 0.5).
  const latestByModule: Partial<Record<ModuleKey, number>> = {};
  const trend: { band: number; date: Date }[] = [];
  for (const t of tests) {
    latestByModule[t.module as ModuleKey] = t.score;
    const vals = Object.values(latestByModule).filter((v): v is number => typeof v === "number");
    if (vals.length > 0) {
      const overall = roundHalf(vals.reduce((a, b) => a + b, 0) / vals.length);
      trend.push({ band: overall, date: t.completedAt });
    }
  }

  // Per-skill summary
  const skillStats = MODULES.map((m) => {
    const ms = tests.filter((t) => t.module === m.key);
    const count = ms.length;
    const avg = count ? roundHalf(ms.reduce((a, b) => a + b.score, 0) / count) : null;
    const best = count ? Math.max(...ms.map((t) => t.score)) : null;
    const latest = count ? ms[ms.length - 1].score : null;
    return { ...m, count, avg, best, latest };
  });

  const withData = skillStats.filter((s) => s.latest !== null);
  const estimatedOverall =
    withData.length > 0
      ? roundHalf(withData.reduce((a, b) => a + (b.latest as number), 0) / withData.length)
      : null;

  const targetBand = student.targetBand ? parseFloat(student.targetBand) : null;
  const totalTests = tests.length;

  // SVG sparkline geometry
  const chartW = 100;
  const chartH = 38;
  const pad = 4;
  const minBand = 3.5;
  const maxBand = 9;
  const points = trend.map((p, i) => {
    const x = trend.length > 1 ? (i / (trend.length - 1)) * (chartW - pad * 2) + pad : chartW / 2;
    const y = chartH - pad - ((p.band - minBand) / (maxBand - minBand)) * (chartH - pad * 2);
    return { x, y };
  });
  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath =
    points.length > 0
      ? `M ${points[0].x.toFixed(1)},${(chartH - pad).toFixed(1)} ` +
        points.map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
        ` L ${points[points.length - 1].x.toFixed(1)},${(chartH - pad).toFixed(1)} Z`
      : "";

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-6 max-w-5xl pb-24 lg:pb-6">
        <DashboardHeader user={student.user} />

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-averna-cyan" />
          Your <span className="neon-text-cyan">Progress</span>
        </h1>
        <p className="text-gray-400 mb-6">
          Track your estimated IELTS band over time and see where to focus next.
        </p>

        {totalTests === 0 ? (
          <Card className="glass border-averna-cyan/30">
            <CardContent className="py-12 text-center">
              <Sparkles className="h-10 w-10 text-averna-cyan mx-auto mb-3" />
              <p className="text-white font-semibold mb-1">No data yet</p>
              <p className="text-gray-400 text-sm mb-4">
                Complete a Listening, Reading or Writing exercise and your progress will appear here.
              </p>
              <Link
                href="/learning/listening"
                className="inline-block px-4 py-2 rounded-lg neon-button bg-averna-primary text-sm font-semibold"
              >
                Start practicing
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Top summary */}
            <div className="grid sm:grid-cols-3 gap-4">
              <Card className="glass border-averna-neon/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-averna-neon">
                    <Target className="h-4 w-4" /> Estimated Band
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-5xl font-bold ${bandColor(estimatedOverall)}`}>
                    {estimatedOverall !== null ? estimatedOverall.toFixed(1) : "—"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">based on your latest scores</p>
                </CardContent>
              </Card>

              <Card className="glass border-averna-purple/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-averna-purple">
                    <Target className="h-4 w-4" /> Target Band
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-5xl font-bold text-averna-purple">
                    {targetBand !== null ? targetBand.toFixed(1) : "—"}
                  </p>
                  {targetBand !== null && estimatedOverall !== null && (
                    <p className="text-xs text-gray-400 mt-1">
                      {estimatedOverall >= targetBand
                        ? "🎉 You've reached your goal!"
                        : `${(targetBand - estimatedOverall).toFixed(1)} band to go`}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="glass border-averna-cyan/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-averna-cyan">
                    <Sparkles className="h-4 w-4" /> Tests Completed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-5xl font-bold text-averna-cyan">{totalTests}</p>
                  <p className="text-xs text-gray-400 mt-1">keep going!</p>
                </CardContent>
              </Card>
            </div>

            {/* Trend chart */}
            <Card className="glass border-averna-cyan/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-averna-cyan" />
                  Band Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative w-full">
                  <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-40" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="bandArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(34,211,238,0.35)" />
                        <stop offset="100%" stopColor="rgba(34,211,238,0)" />
                      </linearGradient>
                    </defs>
                    {/* gridlines for bands 5,6,7,8 */}
                    {[5, 6, 7, 8].map((b) => {
                      const y = chartH - pad - ((b - minBand) / (maxBand - minBand)) * (chartH - pad * 2);
                      return (
                        <line
                          key={b}
                          x1={pad}
                          y1={y}
                          x2={chartW - pad}
                          y2={y}
                          stroke="rgba(255,255,255,0.08)"
                          strokeWidth="0.3"
                        />
                      );
                    })}
                    {areaPath && <path d={areaPath} fill="url(#bandArea)" />}
                    {polyline && (
                      <polyline
                        points={polyline}
                        fill="none"
                        stroke="#22d3ee"
                        strokeWidth="0.8"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    )}
                    {points.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="0.9" fill="#00ff94" />
                    ))}
                  </svg>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Estimated overall band after each completed test (gridlines at 5–8).
                </p>
              </CardContent>
            </Card>

            {/* Per-skill breakdown */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {skillStats.map((s) => {
                const Icon = s.icon;
                const pct = s.avg !== null ? Math.min(100, (s.avg / 9) * 100) : 0;
                return (
                  <Card key={s.key} className="glass border-white/10">
                    <CardHeader className="pb-2">
                      <CardTitle className={`text-base flex items-center gap-2 ${s.color}`}>
                        <Icon className="h-5 w-5" /> {s.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {s.count === 0 ? (
                        <p className="text-sm text-gray-500">No data yet</p>
                      ) : (
                        <>
                          <div className="flex items-end gap-2">
                            <span className={`text-3xl font-bold ${bandColor(s.avg)}`}>
                              {s.avg?.toFixed(1)}
                            </span>
                            <span className="text-xs text-gray-400 mb-1">avg band</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden mt-2">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r from-averna-cyan to-averna-neon`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[11px] text-gray-400 mt-2">
                            <span>Best {s.best?.toFixed(1)}</span>
                            <span>{s.count} test{s.count > 1 ? "s" : ""}</span>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Focus suggestion */}
            {withData.length > 0 && (
              <Card className="glass border-averna-purple/30">
                <CardContent className="py-4 flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-averna-purple shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-300">
                    {(() => {
                      const weakest = [...withData].sort(
                        (a, b) => (a.avg as number) - (b.avg as number)
                      )[0];
                      return (
                        <>
                          <span className="font-semibold text-averna-cyan">Focus tip:</span>{" "}
                          Your lowest skill right now is{" "}
                          <span className={weakest.color}>{weakest.label}</span> (band{" "}
                          {weakest.avg?.toFixed(1)}). Spend a little extra time there to lift your
                          overall band fastest.
                        </>
                      );
                    })()}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
