import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Target, Sparkles } from "lucide-react";
import { getStudentTests } from "@/lib/student-intel";
import { predictBand } from "@/lib/utils";
import { Sparkline } from "@/components/ui/sparkline";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Band score progress + prediction. Pulls the student's IELTS test history,
 * draws a trend sparkline and uses predictBand() to project where they're
 * heading — turning raw scores into motivation ("you're trending toward 6.5").
 */
export async function BandProgress({ studentId, targetBand }: { studentId: string; targetBand?: string | null }) {
  const tests = await getStudentTests(studentId);

  const scores = tests.map((t) => t.score).filter((s) => s > 0);
  const prediction = predictBand(scores);
  const target = targetBand ? parseFloat(targetBand.replace(/[^0-9.]/g, "")) : null;

  return (
    <Card className="glass border-averna-cyan/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-cyan">
          <TrendingUp className="h-5 w-5" /> Band Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!prediction ? (
          <EmptyState
            icon={Target}
            title="No test scores yet"
            description="Take a Reading, Listening, Writing or Mock test and your band trend & prediction will appear here."
            action={{ label: "Take a mock exam", href: "/learning/mock-exam" }}
            accent="text-averna-cyan"
            compact
          />
        ) : (
          <>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs text-gray-400">Current level</p>
                <p className="text-4xl font-bold text-white leading-none mt-1">
                  {prediction.current.toFixed(1)}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  from {prediction.sampleSize} test{prediction.sampleSize === 1 ? "" : "s"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 flex items-center justify-end gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-averna-neon" /> Predicted
                </p>
                <p className="text-3xl font-bold text-averna-neon leading-none mt-1">
                  {prediction.predicted.toFixed(1)}
                </p>
                <p className="text-[11px] text-gray-500 mt-1 capitalize">
                  {prediction.trend === "up" ? "improving ↑" : prediction.trend === "down" ? "dipping ↓" : "steady"} · {prediction.confidence} confidence
                </p>
              </div>
            </div>

            <div className="mt-4">
              <Sparkline
                data={scores.map((s) => Math.round(s * 10))}
                width={300}
                height={48}
                stroke="#00e5ff"
                fill="rgba(0,229,255,0.14)"
                className="w-full"
              />
            </div>

            {target && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Target className="h-3.5 w-3.5 text-averna-pink" /> Goal {target.toFixed(1)}
                  </span>
                  <span className={prediction.current >= target ? "text-averna-neon" : "text-gray-400"}>
                    {prediction.current >= target
                      ? "🎉 Goal reached!"
                      : `${(target - prediction.current).toFixed(1)} to go`}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-averna-cyan to-averna-neon transition-all"
                    style={{ width: `${Math.min(100, Math.round((prediction.current / target) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
