import { getPredictions } from "@/lib/admin-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";

/**
 * M7 — Future Prediction Engine. Projects next-week values for key metrics from
 * the last 8 weekly data points, with an honest confidence estimate. Read-only,
 * server component. Uzbek UI.
 */
export async function PredictionEngine() {
  const predictions = await getPredictions();
  const max = (s: number[]) => Math.max(1, ...s);

  return (
    <Card className="glass border-averna-cyan/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-averna-cyan/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-cyan">
          <Sparkles className="h-5 w-5" /> Kelajak Bashorati
        </CardTitle>
        <p className="text-xs text-gray-400">Soʻnggi 8 haftalik trend asosidagi taxminlar</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {predictions.map((p) => (
          <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white font-medium">{p.label}</span>
              <span className="flex items-center gap-1 text-xs">
                {p.trendPct == null ? (
                  <Minus className="h-3.5 w-3.5 text-gray-500" />
                ) : p.trendPct > 0 ? (
                  <span className="flex items-center gap-1 text-averna-neon">
                    <TrendingUp className="h-3.5 w-3.5" /> +{p.trendPct}%
                  </span>
                ) : p.trendPct < 0 ? (
                  <span className="flex items-center gap-1 text-red-300">
                    <TrendingDown className="h-3.5 w-3.5" /> {p.trendPct}%
                  </span>
                ) : (
                  <span className="text-gray-400">0%</span>
                )}
              </span>
            </div>

            <div className="flex items-end justify-between mt-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-white tabular-nums">{p.predicted.toLocaleString()}</span>
                <span className="text-[11px] text-gray-500">
                  keyingi {p.unit} (hozir {p.current.toLocaleString()})
                </span>
              </div>
              {/* sparkline */}
              <div className="flex items-end gap-0.5 h-8">
                {p.series.map((v, i) => (
                  <div
                    key={i}
                    className="w-1.5 rounded-t bg-gradient-to-t from-averna-cyan/40 to-averna-neon/70"
                    style={{ height: `${Math.max(8, (v / max(p.series)) * 100)}%` }}
                  />
                ))}
              </div>
            </div>

            {/* confidence */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-averna-cyan" style={{ width: `${p.confidence}%` }} />
              </div>
              <span className="text-[10px] text-gray-400 shrink-0">{p.confidence}% ishonch</span>
            </div>
          </div>
        ))}
        <p className="text-[10px] text-gray-500 text-center">Bu taxminlar — kafolat emas. Trend oʻzgarishi natijaga taʼsir qiladi.</p>
      </CardContent>
    </Card>
  );
}
