import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { db } from "@/lib/db";
import { predictBand } from "@/lib/utils";

/**
 * AI-style band prediction based on the student's recent IELTS test scores.
 * Pure heuristic — no external API needed.
 */
export async function BandPredictor({ studentId }: { studentId: string }) {
  let scores: number[] = [];
  try {
    const tests = await db.iELTSTest.findMany({
      where: { studentId },
      orderBy: { completedAt: "asc" },
      take: 30,
      select: { score: true },
    });
    scores = tests.map((t) => t.score);
  } catch {
    scores = [];
  }

  const p = predictBand(scores);

  return (
    <Card className="glass border-averna-purple/30 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-averna-purple/10 to-transparent" />
      <CardHeader className="relative">
        <CardTitle className="flex items-center gap-2 text-averna-purple">
          <Sparkles className="h-5 w-5" /> Band Predictor
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        {!p ? (
          <p className="text-sm text-gray-400">
            Take a few tests (Writing, Reading, Listening or a Mock Exam) and we&apos;ll predict your IELTS band here. 📈
          </p>
        ) : (
          <div>
            <div className="flex items-end gap-6">
              <div>
                <p className="text-xs text-gray-400">Current level</p>
                <p className="text-3xl font-bold text-white">{p.current.toFixed(1)}</p>
              </div>
              <div className="text-2xl text-gray-500">→</div>
              <div>
                <p className="text-xs text-gray-400">Predicted band</p>
                <p className="text-3xl font-bold neon-text-purple">{p.predicted.toFixed(1)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 text-sm">
              {p.trend === "up" && <span className="flex items-center gap-1 text-averna-neon"><TrendingUp className="h-4 w-4" /> Improving</span>}
              {p.trend === "down" && <span className="flex items-center gap-1 text-red-400"><TrendingDown className="h-4 w-4" /> Slipping — keep practising</span>}
              {p.trend === "flat" && <span className="flex items-center gap-1 text-gray-400"><Minus className="h-4 w-4" /> Steady</span>}
              <span className="text-gray-500">· {p.confidence} confidence ({p.sampleSize} tests)</span>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              Prediction assumes you keep practising at your recent pace. More tests = more accurate.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
