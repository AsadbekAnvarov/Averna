import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, PenTool, BookOpen, Headphones, Mic, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getStudentTests } from "@/lib/student-intel";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

const MOD: Record<string, { label: string; icon: any; color: string }> = {
  WRITING: { label: "Writing", icon: PenTool, color: "bg-averna-purple/15 text-averna-purple" },
  READING: { label: "Reading", icon: BookOpen, color: "bg-averna-blue/15 text-averna-blue" },
  LISTENING: { label: "Listening", icon: Headphones, color: "bg-emerald-400/15 text-emerald-400" },
  SPEAKING: { label: "Speaking", icon: Mic, color: "bg-averna-pink/15 text-averna-pink" },
};

function bandColor(score: number) {
  if (score >= 7) return "text-averna-neon";
  if (score >= 5.5) return "text-averna-cyan";
  return "text-amber-400";
}

/**
 * A clear log of recent test attempts so the student can see their journey at a
 * glance — module, band and when they took it.
 */
export async function TestHistory({ studentId }: { studentId: string }) {
  // Shared cached history is ascending; reverse for newest-first and cap at 8.
  const tests = [...(await getStudentTests(studentId))].reverse().slice(0, 8);

  return (
    <Card className="glass border-averna-blue/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-averna-blue">
            <History className="h-5 w-5" /> Test History
          </span>
          <Link href="/learning/mock-exam" className="text-xs font-normal text-averna-blue hover:underline flex items-center gap-1">
            New test <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tests.length === 0 ? (
          <EmptyState
            icon={History}
            title="No tests taken yet"
            description="Your completed tests and bands will be listed here so you can track your progress over time."
            action={{ label: "Take your first test", href: "/learning/mock-exam" }}
            accent="text-averna-blue"
            compact
          />
        ) : (
          <ul className="space-y-2">
            {tests.map((t) => {
              const m = MOD[t.module] ?? MOD.WRITING;
              const Icon = m.icon;
              return (
                <li key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${m.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white">{m.label}</p>
                    <p className="text-[11px] text-gray-500">{formatDate(t.completedAt)}</p>
                  </div>
                  <span className={`text-lg font-bold shrink-0 ${bandColor(t.score)}`}>{t.score.toFixed(1)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
