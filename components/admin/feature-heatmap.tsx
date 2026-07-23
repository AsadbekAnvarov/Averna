import { getFeatureHeatmap, type FeatureUsage } from "@/lib/admin-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Grid3x3 } from "lucide-react";

const LEVEL: Record<FeatureUsage["level"], { bar: string; dot: string }> = {
  green: { bar: "bg-averna-neon", dot: "bg-averna-neon" },
  yellow: { bar: "bg-amber-400", dot: "bg-amber-400" },
  red: { bar: "bg-red-500", dot: "bg-red-500" },
};

/**
 * M6 — Feature Heatmap. Shows which platform features are actually used, based
 * on real activity-log actions over the last 30 days, coloured green (heavy) /
 * yellow (average) / red (rarely used). Read-only server component. Uzbek UI.
 */
export async function FeatureHeatmap() {
  const features = await getFeatureHeatmap();

  return (
    <Card className="glass border-averna-purple/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-purple">
          <Grid3x3 className="h-5 w-5" /> Funksiyalar Issiqlik Xaritasi
        </CardTitle>
        <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-1">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-averna-neon" /> Koʻp</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Oʻrtacha</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Kam</span>
        </div>
      </CardHeader>
      <CardContent>
        {features.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">Soʻnggi 30 kunda faollik qayd etilmadi.</p>
        ) : (
          <div className="space-y-2">
            {features.map((f) => (
              <div key={f.action} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-xs text-gray-300 truncate flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${LEVEL[f.level].dot}`} /> {f.label}
                </span>
                <div className="flex-1 h-2.5 rounded-full bg-white/10 overflow-hidden">
                  <div className={`h-full rounded-full ${LEVEL[f.level].bar}`} style={{ width: `${Math.max(4, f.pct)}%` }} />
                </div>
                <span className="w-12 shrink-0 text-right text-xs text-gray-400 tabular-nums">{f.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
