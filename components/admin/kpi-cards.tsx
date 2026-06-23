import { Card, CardContent } from "@/components/ui/card";
import { Users, FileCheck2, Activity, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { Sparkline } from "@/components/ui/sparkline";
import { CountUp } from "@/components/ui/count-up";
import { TrendBadge } from "@/components/ui/trend-badge";

/** Bucket timestamps into a `days`-length daily series ending today. */
function dailySeries(dates: Date[], days: number, valueOf?: (i: number) => number): number[] {
  const buckets = new Array(days).fill(0);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  dates.forEach((d, i) => {
    const diffDays = Math.floor((startOfToday.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
    const idx = days - 1 - diffDays;
    if (idx >= 0 && idx < days) buckets[idx] += valueOf ? valueOf(i) : 1;
  });
  return buckets;
}

function pctDelta(series: number[]): number | null {
  if (series.length < 2) return null;
  const half = Math.floor(series.length / 2);
  const prev = series.slice(0, half).reduce((a, b) => a + b, 0);
  const recent = series.slice(half).reduce((a, b) => a + b, 0);
  if (prev === 0) return recent > 0 ? 100 : 0;
  return Math.round(((recent - prev) / prev) * 100);
}

export async function AdminKpis() {
  const since = new Date(Date.now() - 14 * 86400000);

  const [students, submissions, payments, activeCount] = await Promise.all([
    db.student.findMany({ select: { createdAt: true } }),
    db.homeworkSubmission.findMany({
      where: { submittedAt: { gte: since } },
      select: { submittedAt: true },
    }),
    db.payment.findMany({
      where: { status: "COMPLETED", createdAt: { gte: since } },
      select: { createdAt: true, amount: true },
    }),
    db.student.count({ where: { lastActiveDate: { gte: new Date(Date.now() - 7 * 86400000) } } }),
  ]);

  const studentSeries = dailySeries(students.map((s) => s.createdAt), 14);
  const subSeries = dailySeries(submissions.map((s) => s.submittedAt), 14);
  const paySeries = dailySeries(payments.map((p) => p.createdAt), 14, (i) => payments[i].amount);
  const activitySeries = subSeries; // submissions are a good proxy for activity

  const totalRevenue = payments.reduce((a, p) => a + p.amount, 0);

  interface Kpi {
    label: string;
    value: number;
    prefix?: string;
    suffix?: string;
    delta: number | null;
    series: number[];
    icon: any;
    accent: string;
    ring: string;
    glow: string;
    iconBg: string;
    stroke: string;
    fill: string;
  }

  const cards: Kpi[] = [
    {
      label: "Total Students",
      value: students.length,
      delta: pctDelta(studentSeries),
      series: studentSeries,
      icon: Users,
      accent: "text-averna-cyan",
      ring: "ring-averna-cyan/30",
      glow: "from-averna-cyan/20",
      iconBg: "bg-averna-cyan/15 text-averna-cyan",
      stroke: "#00e5ff",
      fill: "rgba(0,229,255,0.14)",
    },
    {
      label: "Submissions (14d)",
      value: submissions.length,
      delta: pctDelta(subSeries),
      series: subSeries,
      icon: FileCheck2,
      accent: "text-averna-purple",
      ring: "ring-averna-purple/30",
      glow: "from-averna-purple/20",
      iconBg: "bg-averna-purple/15 text-averna-purple",
      stroke: "#b14eff",
      fill: "rgba(177,78,255,0.14)",
    },
    {
      label: "Active Learners (7d)",
      value: activeCount,
      delta: pctDelta(activitySeries),
      series: activitySeries,
      icon: Activity,
      accent: "text-averna-neon",
      ring: "ring-averna-neon/30",
      glow: "from-averna-neon/20",
      iconBg: "bg-averna-neon/15 text-averna-neon",
      stroke: "#00ff94",
      fill: "rgba(0,255,148,0.14)",
    },
    {
      label: "Revenue (14d)",
      value: totalRevenue,
      prefix: "",
      suffix: " pts",
      delta: pctDelta(paySeries),
      series: paySeries,
      icon: Wallet,
      accent: "text-amber-400",
      ring: "ring-amber-400/30",
      glow: "from-amber-400/20",
      iconBg: "bg-amber-400/15 text-amber-400",
      stroke: "#fbbf24",
      fill: "rgba(251,191,36,0.14)",
    },
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card
            key={c.label}
            className={`glass relative overflow-hidden ring-1 ${c.ring} border-transparent transition-transform duration-300 hover:-translate-y-1`}
          >
            <div className={`pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${c.glow} to-transparent blur-2xl`} />
            <CardContent className="p-5 relative">
              <div className="flex items-start justify-between mb-2">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.iconBg}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <TrendBadge value={c.delta} title="vs the previous week" />
              </div>
              <p className="text-sm text-gray-400 font-medium">{c.label}</p>
              <CountUp
                value={c.value}
                prefix={c.prefix ?? ""}
                suffix={c.suffix ?? ""}
                className={`block text-3xl font-bold mt-1 ${c.accent}`}
              />
              <div className="mt-3">
                <Sparkline data={c.series} width={200} height={32} stroke={c.stroke} fill={c.fill} className="w-full" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
