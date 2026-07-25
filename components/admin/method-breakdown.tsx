import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, CreditCard, Smartphone, Building2, HelpCircle } from "lucide-react";
import type { MethodSummary, PaymentMethodKey } from "@/lib/engine/payment-methods";

const fmt = (n: number) => n.toLocaleString("en-US");

const STYLE: Record<PaymentMethodKey, { icon: typeof Banknote; accent: string; bar: string }> = {
  CASH: { icon: Banknote, accent: "text-averna-neon", bar: "bg-averna-neon" },
  CARD: { icon: CreditCard, accent: "text-averna-cyan", bar: "bg-averna-cyan" },
  TERMINAL: { icon: Smartphone, accent: "text-averna-purple", bar: "bg-averna-purple" },
  TRANSFER: { icon: Building2, accent: "text-averna-blue", bar: "bg-averna-blue" },
  UNKNOWN: { icon: HelpCircle, accent: "text-gray-400", bar: "bg-gray-500" },
};

/**
 * Incoming money split by how it was paid.
 *
 * Shared by the finance and tuition pages so the split is computed and rendered
 * one way only — two pages showing the same figure by different means is how
 * totals start to disagree.
 *
 * Zero rows are kept: an owner reconciling the till needs to see that terminal
 * takings were zero for the period, which a disappearing row would not tell
 * them. The unknown bucket appears only when it has rows, and says why.
 */
export function MethodBreakdown({
  summary,
  title,
  periodLabel,
}: {
  summary: MethodSummary;
  title: string;
  periodLabel: string;
}) {
  return (
    <Card className="glass border-white/10 mb-8">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-white text-base">
          <span className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-averna-neon" /> {title}
          </span>
          <span className="text-xs font-normal text-gray-400">
            {periodLabel} · {fmt(summary.total)} UZS · {summary.count} ta
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {summary.rows.map((row) => {
            const s = STYLE[row.key];
            const Icon = s.icon;
            return (
              <div key={row.key} className="rounded-lg bg-white/5 border border-white/10 p-3">
                <p className={`text-[11px] flex items-center gap-1 ${s.accent}`}>
                  <Icon className="h-3.5 w-3.5" /> {row.label}
                </p>
                <p className={`text-xl font-bold mt-1 ${row.amount > 0 ? s.accent : "text-gray-500"}`}>
                  {fmt(row.amount)}
                </p>
                <p className="text-[11px] text-gray-500">
                  {row.count} ta toʻlov
                  {row.sharePct != null && row.amount > 0 ? ` · ${row.sharePct}%` : ""}
                </p>
                {/* Share bar: the same number as the percentage, easier to compare at a glance. */}
                <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full ${s.bar}`}
                    style={{ width: `${row.sharePct ?? 0}%` }}
                    aria-hidden
                  />
                </div>
              </div>
            );
          })}
        </div>

        {summary.total === 0 && (
          <p className="text-[11px] text-gray-500 mt-3">
            Bu davrda toʻlov qabul qilinmagan.
          </p>
        )}
        {summary.hasUnknown && (
          <p className="text-[11px] text-gray-500 mt-3">
            «Usul koʻrsatilmagan» — toʻlov usuli saqlanishidan oldin kiritilgan yozuvlar. Yangi
            toʻlovlarda usul har doim qayd etiladi.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
