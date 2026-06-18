import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Medal, PenTool, BookOpen, Headphones, Mic } from "lucide-react";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/ui/empty-state";

const MODULES = [
  { key: "WRITING", label: "Writing", icon: PenTool, color: "bg-averna-purple/15 text-averna-purple" },
  { key: "READING", label: "Reading", icon: BookOpen, color: "bg-averna-blue/15 text-averna-blue" },
  { key: "LISTENING", label: "Listening", icon: Headphones, color: "bg-emerald-400/15 text-emerald-400" },
  { key: "SPEAKING", label: "Speaking", icon: Mic, color: "bg-averna-pink/15 text-averna-pink" },
] as const;

/**
 * Personal bests — the student's highest band in each module. A motivating
 * "trophy cabinet" that fills the Progress tab and celebrates their peaks.
 */
export async function PersonalBests({ studentId }: { studentId: string }) {
  const tests = await db.iELTSTest.findMany({
    where: { studentId },
    select: { module: true, score: true },
  });

  const best = new Map<string, number>();
  for (const t of tests) {
    best.set(t.module, Math.max(best.get(t.module) ?? 0, t.score));
  }
  const overall = best.size > 0 ? Math.max(...best.values()) : 0;

  return (
    <Card className="glass border-amber-400/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-amber-400">
            <Medal className="h-5 w-5" /> Personal Bests
          </span>
          {overall > 0 && <span className="text-sm font-normal text-gray-400">Top {overall.toFixed(1)}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {best.size === 0 ? (
          <EmptyState
            icon={Medal}
            title="No records yet"
            description="Take tests in each skill and your best bands will be shown here as trophies."
            accent="text-amber-400"
            compact
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {MODULES.map((m) => {
              const Icon = m.icon;
              const score = best.get(m.key);
              return (
                <div key={m.key} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${m.color}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs text-gray-400">{m.label}</p>
                    <p className="text-lg font-bold text-white leading-none">
                      {score != null ? score.toFixed(1) : "—"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
