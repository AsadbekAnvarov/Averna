import Link from "next/link";
import { getStudentRadar, type RadarCategory, type HealthLabel } from "@/lib/teacher-intel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Radar, ChevronRight } from "lucide-react";

const CAT: Record<RadarCategory, { label: string; emoji: string; color: string; order: number }> = {
  attention: { label: "Needs Immediate Attention", emoji: "🚨", color: "text-red-300", order: 0 },
  at_risk: { label: "At Risk", emoji: "⚠️", color: "text-amber-300", order: 1 },
  losing_motivation: { label: "Losing Motivation", emoji: "📉", color: "text-orange-300", order: 2 },
  improving: { label: "Rapidly Improving", emoji: "🚀", color: "text-averna-neon", order: 3 },
  ready_higher: { label: "Ready for Harder Material", emoji: "🎓", color: "text-averna-cyan", order: 4 },
  stable: { label: "Stable", emoji: "✅", color: "text-gray-300", order: 5 },
};

const HEALTH: Record<HealthLabel, string> = {
  Excellent: "border-averna-neon/40 bg-averna-neon/10 text-averna-neon",
  Stable: "border-averna-cyan/40 bg-averna-cyan/10 text-averna-cyan",
  "Needs Attention": "border-amber-400/40 bg-amber-400/10 text-amber-300",
  Critical: "border-red-500/40 bg-red-500/10 text-red-300",
};

/**
 * F1 + F5 — AI Student Radar. Replaces the plain risk list with a priority
 * system: every student gets a Learning Health Score and is sorted into a
 * category with a plain-language "why" and a recommended next action. Read-only,
 * real data. Supersedes the old RiskRadar (at-risk is one of the categories).
 */
export async function StudentRadar({ teacherId }: { teacherId: string }) {
  const students = await getStudentRadar(teacherId);

  // group by category
  const byCat = new Map<RadarCategory, typeof students>();
  for (const s of students) {
    const arr = byCat.get(s.category) ?? [];
    arr.push(s);
    byCat.set(s.category, arr);
  }
  const cats = Array.from(byCat.keys()).sort((a, b) => CAT[a].order - CAT[b].order);

  return (
    <Card className="glass border-averna-neon/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-averna-neon">
            <Radar className="h-5 w-5" /> AI Student Radar
          </span>
          <span className="text-sm font-normal text-gray-400">{students.length} students</span>
        </CardTitle>
        {/* category summary chips */}
        {students.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {cats.map((c) => (
              <span key={c} className={`text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ${CAT[c].color}`}>
                {CAT[c].emoji} {CAT[c].label} · {byCat.get(c)!.length}
              </span>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {students.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No students yet — your radar will populate as they practise.</p>
        ) : (
          cats.map((c) => {
            const list = byCat.get(c)!;
            const cap = c === "stable" ? 4 : 8;
            return (
              <div key={c}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5 ${CAT[c].color}`}>
                  {CAT[c].emoji} {CAT[c].label}
                  <span className="ml-auto text-gray-600 normal-case font-normal">{list.length}</span>
                </p>
                <div className="space-y-2">
                  {list.slice(0, cap).map((s) => (
                    <Link
                      key={s.id}
                      href={s.href}
                      className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:border-averna-neon/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium truncate">{s.name}</p>
                          <span className="text-[10px] text-gray-500 shrink-0">{s.group}</span>
                        </div>
                        <p className="text-[11px] text-gray-400 truncate">{s.reasons.join(" · ")}</p>
                        <p className="text-[11px] text-averna-cyan/90 truncate mt-0.5">→ {s.action}</p>
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${HEALTH[s.healthLabel]}`}>
                        {s.healthScore}
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
                    </Link>
                  ))}
                  {list.length > cap && <p className="text-[11px] text-gray-500">+{list.length - cap} more</p>}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
