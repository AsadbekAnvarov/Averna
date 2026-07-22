import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { Sparkline } from "@/components/ui/sparkline";

/** Bucket payment amounts into a daily series for the last `days` days. */
function revenueSeries(payments: { createdAt: Date; amount: number }[], days: number): number[] {
  const buckets = new Array(days).fill(0);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  for (const p of payments) {
    const diffDays = Math.floor((startOfToday.getTime() - new Date(p.createdAt).setHours(0, 0, 0, 0)) / 86400000);
    const idx = days - 1 - diffDays;
    if (idx >= 0 && idx < days) buckets[idx] += p.amount;
  }
  return buckets;
}

/**
 * Finance mini-summary — 30-day revenue trend, totals and any pending
 * payments, with a jump to the full finance page.
 */
export async function FinanceSummary() {
  const since = new Date(Date.now() - 30 * 86400000);

  const [completed, pending] = await Promise.all([
    db.payment.findMany({
      where: { status: "COMPLETED", createdAt: { gte: since } },
      select: { createdAt: true, amount: true },
    }),
    db.payment.findMany({
      where: { status: "PENDING" },
      select: { amount: true },
    }),
  ]);

  const total = completed.reduce((a, p) => a + p.amount, 0);
  const pendingTotal = pending.reduce((a, p) => a + p.amount, 0);
  const series = revenueSeries(completed, 30);

  return (
    <Card className="glass border-emerald-400/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-emerald-400">
            <Wallet className="h-5 w-5" /> Moliya
          </span>
          <Link
            href="/admin/finance"
            className="text-xs font-normal text-emerald-400 hover:underline flex items-center gap-1"
          >
            Batafsil <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <p className="text-xs text-gray-400">Daromad · soʻnggi 30 kun</p>
            <p className="text-3xl font-bold text-emerald-400">{total.toLocaleString()}</p>
            <p className="text-xs text-gray-500">{completed.length} ta toʻlov</p>
          </div>
          <Sparkline data={series} width={140} height={48} stroke="#34d399" fill="rgba(52,211,153,0.14)" />
        </div>

        {pending.length > 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-400/10 border border-amber-400/20">
            <Clock className="h-4 w-4 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-400">
              <span className="font-semibold">{pending.length}</span> ta toʻlov kutilmoqda · {pendingTotal.toLocaleString()} kutilyapti
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-500">Kutilayotgan toʻlovlar yoʻq.</p>
        )}
      </CardContent>
    </Card>
  );
}
