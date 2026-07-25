export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, ArrowRight, CheckCircle2, Info } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import {
  getRiskRegister,
  riskCategoryLabel,
  riskSeverityLabel,
  type RiskSeverity,
} from "@/lib/engine/risk-engine";

const SEV_STYLE: Record<RiskSeverity, { chip: string; dot: string; border: string }> = {
  critical: { chip: "border-red-500/40 bg-red-500/10 text-red-300", dot: "bg-red-500", border: "border-red-500/30" },
  high: { chip: "border-amber-500/40 bg-amber-500/10 text-amber-300", dot: "bg-amber-400", border: "border-amber-400/30" },
  medium: { chip: "border-averna-cyan/40 bg-averna-cyan/10 text-averna-cyan", dot: "bg-averna-cyan", border: "border-white/10" },
  low: { chip: "border-white/15 bg-white/5 text-gray-400", dot: "bg-gray-500", border: "border-white/10" },
};

const ORDER: RiskSeverity[] = ["critical", "high", "medium", "low"];

export default async function AdminRisksPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Faqat adminlar uchun" message="Bu boʻlim faqat administratorlar uchun." />;
  }

  const { risks, counts, gaps } = await getRiskRegister();

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <PageHeader
          back={{ href: "/admin/dashboard", label: "Admin paneliga qaytish" }}
          icon={ShieldAlert}
          iconClassName="text-red-400"
          title={<span className="neon-text">Xavflar markazi</span>}
          subtitle="Moliyaviy, operatsion va oʻquv xavflari — muhimligi boʻyicha tartiblangan."
        />

        {/* Severity counters */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {ORDER.map((s) => (
            <Card key={s} className={`glass ${SEV_STYLE[s].border}`}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-white">{counts[s]}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{riskSeverityLabel(s)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Register */}
        {risks.length === 0 ? (
          <Card className="glass border-averna-neon/30">
            <CardContent className="py-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-averna-neon mx-auto mb-3" />
              <p className="text-lg font-semibold text-white">Jiddiy xavf aniqlanmadi</p>
              <p className="text-sm text-gray-400 mt-1">
                Koʻrsatkichlar barqaror. Bu sahifa maʼlumot oʻzgarishi bilan avtomatik yangilanadi.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {risks.map((r) => {
              const st = SEV_STYLE[r.severity];
              return (
                <Card key={r.id} className={`glass ${st.border}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <p className="text-white font-semibold flex items-center gap-2 min-w-0">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${st.dot}`} />
                        <span className="truncate">{r.title}</span>
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-gray-400">
                          {riskCategoryLabel(r.category)}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${st.chip}`}>
                          {riskSeverityLabel(r.severity)}
                        </span>
                      </div>
                    </div>

                    {/* Evidence — the number the risk rests on */}
                    <p className="text-xs text-gray-400 mb-2">{r.evidence}</p>

                    <div className="flex items-end justify-between gap-3 pt-2 border-t border-white/10">
                      <p className="text-xs text-gray-200">
                        <span className="text-averna-neon">Tavsiya: </span>
                        {r.recommendation}
                      </p>
                      <Link
                        href={r.href}
                        className="text-xs text-averna-cyan hover:underline inline-flex items-center gap-1 shrink-0"
                      >
                        Hal qilish <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Honest gaps */}
        {gaps.length > 0 && (
          <Card className="glass border-white/10 mt-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-gray-400 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" /> Hozircha kuzatilmaydigan xavflar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-[11px] text-gray-500">
                {gaps.map((g, i) => (
                  <li key={i}>• {g}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
