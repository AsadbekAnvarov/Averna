export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TeacherHeader } from "@/components/teacher/teacher-header";
import { AccountNotice } from "@/components/account-notice";
import { BarChart3, ArrowLeft, Flame } from "lucide-react";

type ModuleKey = "LISTENING" | "READING" | "WRITING" | "SPEAKING";
const MODULES: { key: ModuleKey; label: string }[] = [
  { key: "LISTENING", label: "List." },
  { key: "READING", label: "Read." },
  { key: "WRITING", label: "Writ." },
  { key: "SPEAKING", label: "Speak." },
];

function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

// Color a heatmap cell by band (or attendance % when isPct).
function cellClasses(value: number | null, isPct = false): string {
  if (value === null) return "bg-white/5 text-gray-500 border-white/5";
  const good = isPct ? value >= 85 : value >= 7;
  const mid = isPct ? value >= 60 : value >= 5.5;
  if (good) return "bg-averna-neon/15 text-averna-neon border-averna-neon/30";
  if (mid) return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
  return "bg-rose-500/15 text-rose-300 border-rose-500/30";
}

export default async function TeacherInsightsPage({
  searchParams,
}: {
  searchParams: { group?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "STUDENT") redirect("/dashboard");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");

  const teacher = await db.teacher.findUnique({
    where: { userId: session.user.id },
    include: {
      groups: {
        orderBy: { name: "asc" },
        include: {
          students: {
            orderBy: { totalPoints: "desc" },
            include: {
              user: { select: { name: true } },
              ieltsTests: { select: { module: true, score: true } },
              attendances: { select: { status: true }, orderBy: { date: "desc" }, take: 12 },
              activityLogs: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  });

  if (!teacher) {
    return (
      <AccountNotice
        title="No teacher profile found"
        message="Sign in with a teacher account to view class insights."
      />
    );
  }

  const groups = teacher.groups;
  const selected = groups.find((g) => g.id === searchParams.group) ?? groups[0];
  const now = Date.now();

  const rows = (selected?.students ?? []).map((s) => {
    const skills: Record<ModuleKey, number | null> = {
      LISTENING: null,
      READING: null,
      WRITING: null,
      SPEAKING: null,
    };
    for (const m of MODULES) {
      const ms = s.ieltsTests.filter((t) => t.module === m.key);
      skills[m.key] = ms.length ? roundHalf(ms.reduce((a, b) => a + b.score, 0) / ms.length) : null;
    }
    const present = s.attendances.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
    const attendancePct = s.attendances.length ? Math.round((present / s.attendances.length) * 100) : null;
    const last = s.activityLogs[0]?.createdAt;
    const inactiveDays = last ? Math.floor((now - new Date(last).getTime()) / 86400000) : null;
    const bandVals = MODULES.map((m) => skills[m.key]).filter((v): v is number => v !== null);
    const overall = bandVals.length ? roundHalf(bandVals.reduce((a, b) => a + b, 0) / bandVals.length) : null;
    return {
      id: s.id,
      name: s.user.name ?? "Student",
      streak: s.currentStreak,
      skills,
      attendancePct,
      inactiveDays,
      overall,
    };
  });

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <TeacherHeader user={{ name: session.user.name ?? "Teacher", email: session.user.email ?? "" }} />

        <Link
          href="/teacher/dashboard"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-averna-cyan" />
          Class <span className="neon-text-cyan">Insights</span>
        </h1>
        <p className="text-gray-400 mb-6">
          See each student&apos;s average band per skill at a glance. Spot who needs help, and where.
        </p>

        {groups.length === 0 ? (
          <Card className="glass border-averna-primary/30">
            <CardContent className="py-8 text-center text-gray-300">You have no groups yet.</CardContent>
          </Card>
        ) : (
          <>
            {/* Group selector */}
            <div className="flex flex-wrap gap-2 mb-6">
              {groups.map((g) => (
                <Link key={g.id} href={`/teacher/insights?group=${g.id}`}>
                  <Button
                    size="sm"
                    variant={selected?.id === g.id ? "default" : "outline"}
                    className={
                      selected?.id === g.id
                        ? "neon-button bg-averna-primary"
                        : "border-averna-cyan/40 text-averna-cyan"
                    }
                  >
                    {g.name}
                  </Button>
                </Link>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-averna-neon/40 border border-averna-neon/40" /> Band 7+ / 85%+
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-yellow-500/40 border border-yellow-500/40" /> Band 5.5–6.5 / 60%+
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-rose-500/40 border border-rose-500/40" /> Below / needs help
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-white/10 border border-white/10" /> No data
              </span>
            </div>

            <Card className="glass border-averna-cyan/30">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{selected?.name}</span>
                  <span className="text-sm font-normal text-gray-400">{rows.length} students</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {rows.length === 0 ? (
                  <p className="text-sm text-gray-400">No students in this group yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-separate border-spacing-1 min-w-[640px]">
                      <thead>
                        <tr className="text-xs text-gray-400">
                          <th className="text-left font-medium px-2 py-1">Student</th>
                          {MODULES.map((m) => (
                            <th key={m.key} className="font-medium px-1 py-1 text-center">{m.label}</th>
                          ))}
                          <th className="font-medium px-1 py-1 text-center">Overall</th>
                          <th className="font-medium px-1 py-1 text-center">Attend.</th>
                          <th className="font-medium px-1 py-1 text-center">Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.id}>
                            <td className="px-2 py-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm text-white truncate max-w-[160px]">{r.name}</span>
                                {r.streak > 0 && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-orange-300 shrink-0">
                                    <Flame className="h-3 w-3" />
                                    {r.streak}
                                  </span>
                                )}
                              </div>
                            </td>
                            {MODULES.map((m) => (
                              <td key={m.key} className="px-1 py-1">
                                <div
                                  className={`text-center text-sm font-semibold rounded-md border py-1.5 ${cellClasses(
                                    r.skills[m.key]
                                  )}`}
                                >
                                  {r.skills[m.key] !== null ? r.skills[m.key]?.toFixed(1) : "—"}
                                </div>
                              </td>
                            ))}
                            <td className="px-1 py-1">
                              <div
                                className={`text-center text-sm font-bold rounded-md border py-1.5 ${cellClasses(
                                  r.overall
                                )}`}
                              >
                                {r.overall !== null ? r.overall.toFixed(1) : "—"}
                              </div>
                            </td>
                            <td className="px-1 py-1">
                              <div
                                className={`text-center text-sm font-semibold rounded-md border py-1.5 ${cellClasses(
                                  r.attendancePct,
                                  true
                                )}`}
                              >
                                {r.attendancePct !== null ? `${r.attendancePct}%` : "—"}
                              </div>
                            </td>
                            <td className="px-1 py-1 text-center">
                              <span
                                className={`text-xs ${
                                  r.inactiveDays === null
                                    ? "text-gray-500"
                                    : r.inactiveDays >= 5
                                    ? "text-rose-300"
                                    : "text-gray-300"
                                }`}
                              >
                                {r.inactiveDays === null
                                  ? "—"
                                  : r.inactiveDays === 0
                                  ? "today"
                                  : `${r.inactiveDays}d`}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
