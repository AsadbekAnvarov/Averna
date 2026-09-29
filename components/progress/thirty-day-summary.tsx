import { Card, CardContent } from "@/components/ui/card";
import { Star, ClipboardCheck, Mic, Notebook, CalendarDays } from "lucide-react";
import { getStudentAnalytics } from "@/lib/db-helpers";

const MODULES = [
  { key: "READING", label: "Reading", bar: "bg-averna-cyan" },
  { key: "LISTENING", label: "Listening", bar: "bg-averna-purple" },
  { key: "WRITING", label: "Writing", bar: "bg-averna-neon" },
  { key: "SPEAKING", label: "Speaking", bar: "bg-averna-pink" },
] as const;

/**
 * The last 30 days at a glance: four headline numbers and how the tests were
 * spread across the four skills. (This used to be the separate /analytics page.)
 */
export async function ThirtyDaySummary({ studentId }: { studentId: string }) {
  const a = await getStudentAnalytics(studentId, 30);

  const stats = [
    { label: "Points earned", value: a.totalPoints, icon: Star, tone: "text-averna-neon bg-averna-neon/15" },
    { label: "Tests done", value: a.totalTests, icon: ClipboardCheck, tone: "text-averna-cyan bg-averna-cyan/15" },
    { label: "Speaking sessions", value: a.totalSpeakingSessions, icon: Mic, tone: "text-averna-pink bg-averna-pink/15" },
    { label: "Homework done", value: a.totalHomework, icon: Notebook, tone: "text-amber-400 bg-amber-400/15" },
  ];
  const byModule = MODULES.map((m) => ({ ...m, count: a.tests.filter((t) => t.module === m.key).length }));
  const most = Math.max(1, ...byModule.map((m) => m.count));

  return (
    <Card className="glass border-white/10">
      <CardContent className="p-5 sm:p-6">
        <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
          <CalendarDays className="h-4 w-4 text-averna-cyan" /> Last 30 days
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="text-xl font-bold text-white tabular-nums">{value}</p>
                <p className="text-[11px] leading-tight text-gray-400">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {byModule.map((m) => (
            <div key={m.key}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-gray-300">{m.label}</span>
                <span className="tabular-nums text-gray-400">{m.count} {m.count === 1 ? "test" : "tests"}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full ${m.bar}`} style={{ width: `${(m.count / most) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
