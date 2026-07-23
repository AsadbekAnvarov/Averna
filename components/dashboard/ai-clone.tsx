import { getExamReadiness } from "@/lib/student-intel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, TrendingUp, TrendingDown, Minus, Sparkles, Target } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

function bandColor(b: number): string {
  if (b >= 7) return "text-averna-neon";
  if (b >= 6) return "text-averna-cyan";
  if (b >= 5) return "text-amber-400";
  return "text-red-300";
}

/**
 * F3 — AI Clone. A digital twin that reads the student's real test history and
 * predicts each skill's exam band, with an "if your exam were tomorrow…" verdict
 * and personalised next steps. Complements (doesn't duplicate) Band Progress
 * (overall) and Skill DNA (mastery). Server component; reuses predictBand().
 */
export async function AiClone({ studentId }: { studentId: string }) {
  const r = await getExamReadiness(studentId);

  return (
    <Card className="glass border-averna-purple/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-averna-purple/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-averna-purple">
          <span className="flex items-center gap-2">
            <Bot className="h-5 w-5" /> AI Clone
          </span>
          {r.overall != null && (
            <span className="text-xs font-normal text-gray-400">{r.confidence} confidence</span>
          )}
        </CardTitle>
        <p className="text-xs text-gray-400">Your evolving digital twin — it learns from every test you take</p>
      </CardHeader>
      <CardContent className="space-y-4 relative">
        {r.overall == null ? (
          <EmptyState
            icon={Bot}
            title="Your clone is waking up"
            description="Take a test in any skill and your AI clone will start predicting your exam bands and where to focus."
            action={{ label: "Start a test", href: "/learning" }}
            accent="text-averna-purple"
            compact
          />
        ) : (
          <>
            {/* Overall predicted */}
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
              <div>
                <p className="text-xs text-gray-400">Predicted exam band</p>
                <p className={`text-4xl font-extrabold leading-none mt-1 ${bandColor(r.overall)}`}>{r.overall.toFixed(1)}</p>
              </div>
              <Sparkles className="h-8 w-8 text-averna-purple/60" />
            </div>

            {/* If exam were tomorrow */}
            <div className="rounded-xl border border-averna-purple/30 bg-averna-purple/5 p-3">
              <p className="text-sm text-gray-200 leading-relaxed">{r.narrative}</p>
            </div>

            {/* Per-skill */}
            <div className="space-y-2">
              {r.perSkill.map((s) => (
                <div key={s.key} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-sm text-gray-300">{s.label}</span>
                  {s.predicted == null ? (
                    <span className="flex-1 text-xs text-gray-500">no data yet</span>
                  ) : (
                    <>
                      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-averna-purple to-averna-neon"
                          style={{ width: `${(s.predicted / 9) * 100}%` }}
                        />
                      </div>
                      <span className={`w-9 shrink-0 text-right text-sm font-bold ${bandColor(s.predicted)}`}>
                        {s.predicted.toFixed(1)}
                      </span>
                      <span className="w-4 shrink-0">
                        {s.trend === "up" ? (
                          <TrendingUp className="h-4 w-4 text-averna-neon" />
                        ) : s.trend === "down" ? (
                          <TrendingDown className="h-4 w-4 text-red-300" />
                        ) : (
                          <Minus className="h-4 w-4 text-gray-500" />
                        )}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Recommendations */}
            {r.recommendations.length > 0 && (
              <div className="space-y-1.5">
                {r.recommendations.map((rec, i) => (
                  <p key={i} className="flex items-start gap-2 text-xs text-gray-300">
                    <Target className="h-3.5 w-3.5 text-averna-purple shrink-0 mt-0.5" /> {rec}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
