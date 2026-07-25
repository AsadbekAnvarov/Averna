import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, TrendingUp, Brain, AlertTriangle } from "lucide-react";
import { getOutcomeMetrics } from "@/lib/engine/admin-analytics-engine";
import { CountUp } from "@/components/ui/count-up";

/**
 * Learning-outcome KPIs for admins. Sits beside the existing volume KPIs
 * (students / submissions / revenue) and answers what counts cannot: is the
 * activity real learning, is mastery advancing, is knowledge retained, and who
 * is slipping. Same visual language as AdminKpis — no redesign. Uzbek UI.
 */
export async function OutcomeKpis() {
  const m = await getOutcomeMetrics();

  const cards = [
    {
      label: "Tasdiqlangan oʻqish",
      value: m.verifiedLearningRate,
      suffix: "%",
      hint:
        m.verifiedSample > 0
          ? `${m.verifiedSample} ta urinishdan haqiqiy harakat ulushi`
          : "Hozircha yetarli maʼlumot yoʻq",
      icon: ShieldCheck,
      accent: "text-averna-neon",
      ring: "ring-averna-neon/30",
      glow: "from-averna-neon/20",
      iconBg: "bg-averna-neon/15 text-averna-neon",
    },
    {
      label: "Mahorat oʻsishi (7 kun)",
      value: m.masteryAdvances,
      suffix: "",
      hint: "Tasdiqlangan darajaga koʻtarilgan koʻnikmalar",
      icon: TrendingUp,
      accent: "text-averna-cyan",
      ring: "ring-averna-cyan/30",
      glow: "from-averna-cyan/20",
      iconBg: "bg-averna-cyan/15 text-averna-cyan",
    },
    {
      label: "Takrorlash (7 kun)",
      value: m.reviewsCompleted,
      suffix: "",
      hint:
        m.reviewsOverdue != null && m.reviewsOverdue > 0
          ? `${m.reviewsOverdue} ta takrorlash muddati oʻtgan`
          : "Muddati oʻtgan takrorlash yoʻq",
      icon: Brain,
      accent: "text-averna-purple",
      ring: "ring-averna-purple/30",
      glow: "from-averna-purple/20",
      iconBg: "bg-averna-purple/15 text-averna-purple",
    },
    {
      label: "Xavf ostida",
      value: m.atRisk,
      suffix: "",
      hint:
        m.integrityFlags != null && m.integrityFlags > 0
          ? `${m.integrityFlags} ta halollik belgisi qayd etildi`
          : "2 haftadan beri mashq qilmagan oʻquvchilar",
      icon: AlertTriangle,
      accent: "text-averna-pink",
      ring: "ring-averna-pink/30",
      glow: "from-averna-pink/20",
      iconBg: "bg-averna-pink/15 text-averna-pink",
    },
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card
            key={c.label}
            className={`glass relative overflow-hidden ring-1 ${c.ring} border-transparent transition-transform duration-300 hover:-translate-y-1`}
          >
            <div className={`pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${c.glow} to-transparent blur-2xl`} />
            <CardContent className="p-5 relative">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.iconBg} mb-2`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm text-gray-400 font-medium">{c.label}</p>
              {c.value == null ? (
                <p className={`text-3xl font-bold mt-1 ${c.accent}`}>—</p>
              ) : (
                <CountUp value={c.value} suffix={c.suffix} className={`block text-3xl font-bold mt-1 ${c.accent}`} />
              )}
              <p className="text-[11px] text-gray-500 mt-2 leading-snug">{c.hint}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
