import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import {
  Gauge, Wallet, TrendingUp, TrendingDown, Users, CalendarCheck,
  Layers, AlertTriangle, Banknote, ArrowRight, Info,
} from "lucide-react";
import { getExecutiveSnapshot, getBusinessHealth, type HealthBand } from "@/lib/engine/business-engine";

const BAND_STYLE: Record<HealthBand, { ring: string; text: string; stroke: string }> = {
  excellent: { ring: "ring-averna-neon/30", text: "text-averna-neon", stroke: "#00ff94" },
  very_good: { ring: "ring-averna-cyan/30", text: "text-averna-cyan", stroke: "#00e5ff" },
  good: { ring: "ring-averna-purple/30", text: "text-averna-purple", stroke: "#b14eff" },
  attention: { ring: "ring-amber-400/30", text: "text-amber-400", stroke: "#fbbf24" },
  critical: { ring: "ring-red-500/30", text: "text-red-400", stroke: "#ef4444" },
};

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * Executive Overview — the business at a glance, above the existing KPI rows.
 *
 * Uses the same card language as the rest of the admin panel (no redesign). Every
 * number comes from real data; anything not yet derivable (operating expenses and
 * therefore net profit) is shown as "—" with an explicit note, never guessed.
 * Uzbek admin UI.
 */
export async function ExecutiveOverview() {
  const snapshot = await getExecutiveSnapshot();
  const health = await getBusinessHealth(snapshot);
  const st = BAND_STYLE[health.band];

  // Donut geometry for the health ring.
  const R = 42;
  const C = 2 * Math.PI * R;
  const filled = (health.score / 100) * C;

  const metrics = [
    {
      label: "Bugungi daromad",
      value: fmt(snapshot.revenueToday),
      suffix: "UZS",
      icon: Banknote,
      accent: "text-averna-neon",
      bg: "bg-averna-neon/15 text-averna-neon",
      href: "/admin/finance",
      hint: "Bugun qabul qilingan toʻlovlar",
    },
    {
      label: "Oylik daromad",
      value: fmt(snapshot.revenueMonth),
      suffix: "UZS",
      icon: Wallet,
      accent: "text-averna-cyan",
      bg: "bg-averna-cyan/15 text-averna-cyan",
      href: "/admin/finance",
      hint:
        snapshot.revenueGrowthPct == null
          ? "Oʻtgan oy bilan taqqoslash uchun maʼlumot yetarli emas"
          : `Oʻtgan oyga nisbatan ${snapshot.revenueGrowthPct > 0 ? "+" : ""}${snapshot.revenueGrowthPct}% (${fmt(snapshot.revenuePrevMonth)})`,
      trend: snapshot.revenueGrowthPct,
    },
    {
      label: "Sof foyda (oylik)",
      value: "—",
      suffix: "",
      icon: Gauge,
      accent: "text-gray-400",
      bg: "bg-white/5 text-gray-400",
      href: "/admin/finance",
      hint: "Xarajatlar moduli qoʻshilgach hisoblanadi — taxmin qilinmaydi",
    },
    {
      label: "Qarzdor oʻquvchilar",
      value: fmt(snapshot.outstandingStudents),
      suffix: "",
      icon: AlertTriangle,
      accent: snapshot.outstandingStudents > 0 ? "text-averna-pink" : "text-averna-neon",
      bg: "bg-averna-pink/15 text-averna-pink",
      href: "/admin/finance",
      hint: `${snapshot.pendingPayments} ta toʻlov tasdiqlanmagan`,
    },
    {
      label: "Faol oʻquvchilar (7 kun)",
      value: `${fmt(snapshot.activeStudents)}/${fmt(snapshot.totalStudents)}`,
      suffix: "",
      icon: Users,
      accent: "text-averna-purple",
      bg: "bg-averna-purple/15 text-averna-purple",
      href: "/admin/dashboard?tab=people",
      hint: `Bu oy ${snapshot.newStudentsMonth} ta yangi oʻquvchi`,
    },
    {
      label: "Davomat (30 kun)",
      value: snapshot.attendanceRate == null ? "—" : `${snapshot.attendanceRate}%`,
      suffix: "",
      icon: CalendarCheck,
      accent: "text-amber-400",
      bg: "bg-amber-400/15 text-amber-400",
      href: "/admin/analytics",
      hint: snapshot.attendanceRate == null ? "Davomat belgilanishi yetarli emas" : "Kelgan va kechikkanlar ulushi",
    },
    {
      label: "Guruhlar",
      value: fmt(snapshot.groups),
      suffix: "",
      icon: Layers,
      accent: "text-averna-blue",
      bg: "bg-averna-blue/15 text-averna-blue",
      href: "/admin/groups",
      hint: `Oʻrtacha ${snapshot.avgGroupSize ?? "—"} oʻquvchi · ${snapshot.underEnrolledGroups} ta kam toʻldirilgan`,
    },
    {
      label: "Naqd / boshqa (oylik)",
      value: `${fmt(snapshot.revenueByMethod.cash)} / ${fmt(snapshot.revenueByMethod.other)}`,
      suffix: "",
      icon: TrendingUp,
      accent: "text-emerald-400",
      bg: "bg-emerald-400/15 text-emerald-400",
      href: "/admin/finance",
      hint: "Toʻliq toʻlov usullari uchun ERP maydonlari kerak",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Business Health Score */}
      <Card className={`glass relative overflow-hidden ring-1 ${st.ring} border-transparent`}>
        <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-averna-neon/5 blur-3xl" />
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${st.text}`}>
            <Gauge className="h-5 w-5" /> Biznes salomatligi
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Ring */}
            <div className="flex items-center gap-4 shrink-0">
              <div className="relative h-28 w-28">
                <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
                  <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
                  <circle
                    cx="50" cy="50" r={R} fill="none"
                    stroke={st.stroke} strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={`${filled} ${C - filled}`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-bold ${st.text}`}>{health.score}</span>
                  <span className="text-[10px] text-gray-500">/ 100</span>
                </div>
              </div>
              <div>
                <p className={`text-lg font-semibold ${st.text}`}>{health.bandLabel}</p>
                <p className="text-xs text-gray-400 mt-0.5 max-w-[180px]">
                  {health.drivers.length} ta oʻlchov asosida hisoblangan
                </p>
              </div>
            </div>

            {/* Drivers */}
            <div className="flex-1 min-w-0 space-y-2">
              {health.drivers.map((d) => (
                <div key={d.label}>
                  <div className="flex items-center justify-between gap-2 text-xs mb-1">
                    <span className="text-gray-300 truncate">
                      {d.label} <span className="text-gray-600">· {d.weight}%</span>
                    </span>
                    <span className={d.score >= 70 ? "text-averna-neon" : d.score >= 45 ? "text-amber-400" : "text-red-400"}>
                      {d.score}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${d.score}%`,
                        background: d.score >= 70 ? "#00ff94" : d.score >= 45 ? "#fbbf24" : "#ef4444",
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">{d.note}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {health.recommendations.length > 0 && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-wider text-averna-neon mb-1.5">Nima qilish kerak</p>
              <ul className="space-y-1 text-xs text-gray-300">
                {health.recommendations.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Honest gaps */}
          {health.missing.length > 0 && (
            <details className="mt-3">
              <summary className="text-[11px] text-gray-500 hover:text-gray-300 cursor-pointer inline-flex items-center gap-1">
                <Info className="h-3 w-3" /> Hozircha hisoblanmaydigan oʻlchovlar ({health.missing.length})
              </summary>
              <ul className="mt-1.5 space-y-1 text-[11px] text-gray-500">
                {health.missing.map((m, i) => (
                  <li key={i}>• {m}</li>
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>

      {/* Executive metrics */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.label} href={m.href} className="group">
              <Card className="glass border-white/10 h-full transition-all duration-300 hover:-translate-y-1 hover:border-white/20">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${m.bg}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {typeof m.trend === "number" && (
                      <span
                        className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                          m.trend >= 0 ? "bg-averna-neon/15 text-averna-neon" : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {m.trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {m.trend > 0 ? "+" : ""}{m.trend}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 font-medium">{m.label}</p>
                  <p className={`text-xl font-bold mt-0.5 ${m.accent} truncate`}>
                    {m.value}
                    {m.suffix && <span className="text-[11px] text-gray-500 font-normal ml-1">{m.suffix}</span>}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1.5 leading-snug line-clamp-2">{m.hint}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-[10px] text-gray-500 group-hover:text-white transition-colors">
                    Batafsil <ArrowRight className="h-3 w-3" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
