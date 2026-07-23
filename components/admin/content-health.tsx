import Link from "next/link";
import { getContentHealth, type HealthSeverity } from "@/lib/admin-health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeartPulse, ArrowRight, CheckCircle2, Wrench } from "lucide-react";

const SEV: Record<HealthSeverity, { dot: string; chip: string; label: string }> = {
  high: { dot: "bg-red-500", chip: "border-red-500/40 bg-red-500/10 text-red-300", label: "Muhim" },
  medium: { dot: "bg-amber-400", chip: "border-amber-400/40 bg-amber-400/10 text-amber-300", label: "Oʻrta" },
  low: { dot: "bg-averna-cyan", chip: "border-averna-cyan/40 bg-averna-cyan/10 text-averna-cyan", label: "Past" },
};

function scoreColor(score: number): string {
  if (score >= 85) return "text-averna-neon";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

/**
 * M13 — Content Health / Auto-Repair. Scans real content for integrity issues
 * and offers one-click fix suggestions (deep links). Read-only server
 * component. Uzbek UI.
 */
export async function ContentHealth() {
  const { score, checked, issues } = await getContentHealth();

  return (
    <Card className="glass border-averna-neon/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-12 -left-12 h-44 w-44 rounded-full bg-averna-neon/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-averna-neon">
            <HeartPulse className="h-5 w-5" /> Kontent Sogʻligʻi
          </span>
          <span className={`text-lg font-extrabold tabular-nums ${scoreColor(score)}`}>{score}/100</span>
        </CardTitle>
        <p className="text-xs text-gray-400">{checked} ta tekshiruv · {issues.length} ta muammo topildi</p>
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-averna-neon py-4">
            <CheckCircle2 className="h-5 w-5" /> Hammasi sogʻlom — muammo topilmadi.
          </div>
        ) : (
          <div className="space-y-2.5">
            {issues.map((it) => {
              const s = SEV[it.severity];
              return (
                <div key={it.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-semibold text-white min-w-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${s.dot}`} />
                      <span className="truncate">{it.title}</span>
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${s.chip}`}>{s.label}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{it.detail}</p>
                  <Link
                    href={it.href}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs text-averna-neon hover:underline"
                  >
                    <Wrench className="h-3 w-3" /> {it.action} <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
