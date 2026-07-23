import Link from "next/link";
import { getMissionControl, type Severity } from "@/lib/admin-intel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BriefingAiButton } from "@/components/admin/briefing-ai-button";
import {
  Brain,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  ArrowRight,
  ListChecks,
  ShieldAlert,
  Zap,
  CheckCircle2,
} from "lucide-react";

const SEVERITY_STYLE: Record<Severity, { dot: string; chip: string; label: string }> = {
  high: { dot: "bg-red-500", chip: "border-red-500/40 bg-red-500/10 text-red-300", label: "Yuqori" },
  medium: { dot: "bg-amber-400", chip: "border-amber-400/40 bg-amber-400/10 text-amber-300", label: "Oʻrta" },
  low: { dot: "bg-averna-cyan", chip: "border-averna-cyan/40 bg-averna-cyan/10 text-averna-cyan", label: "Past" },
};

function greeting(): string {
  const h = (new Date().getUTCHours() + 5) % 24; // Tashkent
  if (h < 12) return "Xayrli tong";
  if (h < 18) return "Xayrli kun";
  return "Xayrli kech";
}

/**
 * Averna Mission Control — the AI-first command surface for admins. Surfaces
 * the single most important things to know and do right now: an executive
 * briefing, a critical-event feed, data-derived recommendations and a daily
 * insight. All data is real and read-only. Uzbek UI (admin language).
 */
export async function MissionControl({ firstName }: { firstName: string }) {
  const mc = await getMissionControl();
  const { stats, bullets, priorities, risks, actions, events, recommendations, insight } = mc;

  return (
    <div className="space-y-6">
      {/* Module 1 — AI Executive Briefing */}
      <Card className="glass border-averna-neon/30 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-averna-neon/10 blur-3xl" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-averna-neon">
            <Brain className="h-5 w-5" /> AI Ijrochi Xulosasi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 relative">
          <p className="text-lg font-semibold text-white">
            {greeting()}, {firstName}.
          </p>

          {/* Today's numbers */}
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-averna-neon mt-1.5 h-1 w-1 rounded-full bg-averna-neon shrink-0" /> {b}
              </li>
            ))}
          </ul>

          {/* Priorities / risks / actions */}
          <div className="grid md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-wider text-averna-cyan mb-1.5 flex items-center gap-1">
                <ListChecks className="h-3.5 w-3.5" /> Ustuvor vazifalar
              </p>
              {priorities.length ? (
                <ul className="space-y-1 text-xs text-gray-300">
                  {priorities.map((p, i) => (
                    <li key={i}>• {p}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">Shoshilinch vazifa yoʻq.</p>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-wider text-amber-300 mb-1.5 flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" /> Xavflar
              </p>
              {risks.length ? (
                <ul className="space-y-1 text-xs text-gray-300">
                  {risks.map((r, i) => (
                    <li key={i}>• {r}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">Jiddiy xavf aniqlanmadi.</p>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-wider text-averna-neon mb-1.5 flex items-center gap-1">
                <Zap className="h-3.5 w-3.5" /> Tavsiya etilgan amallar
              </p>
              {actions.length ? (
                <ul className="space-y-1">
                  {actions.map((a, i) => (
                    <li key={i}>
                      <Link href={a.href} className="text-xs text-averna-neon hover:underline inline-flex items-center gap-1">
                        {a.text} <ArrowRight className="h-3 w-3" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">Alohida amal talab qilinmaydi.</p>
              )}
            </div>
          </div>

          <BriefingAiButton />
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Module 2 — Critical Event Center */}
        <Card className="glass border-red-500/30">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-red-300">
                <AlertTriangle className="h-5 w-5" /> Muhim Hodisalar Markazi
              </span>
              <span className="text-xs font-normal text-gray-400">{events.length} ta hodisa</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-averna-neon py-4">
                <CheckCircle2 className="h-5 w-5" /> Hammasi joyida — muhim hodisa yoʻq.
              </div>
            ) : (
              <div className="space-y-2.5">
                {events.map((e) => {
                  const st = SEVERITY_STYLE[e.severity];
                  return (
                    <div key={e.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-semibold text-white min-w-0">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${st.dot}`} />
                          <span className="truncate">{e.title}</span>
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${st.chip}`}>{st.label}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{e.impact}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs text-gray-300">{e.action}</span>
                        <Link href={e.href} className="text-xs text-red-300 hover:underline inline-flex items-center gap-1 shrink-0">
                          Hal qilish <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Module 3 — AI Recommendations */}
        <Card className="glass border-averna-purple/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-averna-purple">
              <Lightbulb className="h-5 w-5" /> AI Tavsiyalari
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recommendations.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">
                Tavsiya berish uchun yetarli maʼlumot yigʻilmadi. Faollik ortgach bu yerda paydo boʻladi.
              </p>
            ) : (
              <div className="space-y-2.5">
                {recommendations.map((r) => (
                  <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-sm font-semibold text-white">{r.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{r.detail}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-averna-neon">{r.expected}</span>
                      <Link
                        href={r.href}
                        className="text-xs px-2.5 py-1 rounded-lg border border-averna-purple/40 bg-averna-purple/10 text-averna-purple hover:bg-averna-purple/20 inline-flex items-center gap-1 shrink-0 transition-colors"
                      >
                        <Sparkles className="h-3 w-3" /> {r.cta}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Module 14 — Daily Insight */}
      {insight && (
        <Card className="glass border-averna-cyan/30 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-10 -left-10 h-40 w-40 rounded-full bg-averna-cyan/10 blur-3xl" />
          <CardContent className="py-4 flex items-start gap-3 relative">
            <div className="h-9 w-9 rounded-xl bg-averna-cyan/15 text-averna-cyan flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-averna-cyan">Kunlik Kashfiyot</p>
              <p className="text-sm text-gray-200 mt-0.5">{insight}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
