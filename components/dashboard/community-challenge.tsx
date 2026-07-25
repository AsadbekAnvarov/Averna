import { getCommunityChallenge } from "@/lib/community";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe2, Crown, Users2, Flame } from "lucide-react";

/**
 * F3 — Community Challenge. One shared monthly goal the whole Averna community
 * pushes toward, built from real platform-wide activity. Shows community
 * progress, the student's personal contribution and the top contributors — so
 * every student feels part of something bigger. Read-only server component.
 */
export async function CommunityChallenge({ studentId }: { studentId: string }) {
  const c = await getCommunityChallenge(studentId);

  return (
    <Card className="glass border-averna-cyan/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-averna-cyan/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-averna-cyan">
          <span className="flex items-center gap-2">
            <Globe2 className="h-5 w-5" /> {c.emoji} {c.theme}
          </span>
          <span className="text-xs font-normal text-gray-400 flex items-center gap-1">
            <Users2 className="h-3.5 w-3.5" /> {c.activeStudents}
          </span>
        </CardTitle>
        <p className="text-xs text-gray-400">{c.monthLabel} · a shared community goal</p>
      </CardHeader>
      <CardContent className="space-y-4 relative">
        {/* Community progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-gray-300">Community progress</span>
            <span className="font-mono text-averna-cyan">
              {c.total.toLocaleString()} / {c.goal.toLocaleString()}
            </span>
          </div>
          <div className="h-3.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-averna-cyan via-averna-neon to-averna-purple transition-all duration-700"
              style={{ width: `${c.pct}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            {c.reached
              ? "Goal smashed — the whole community delivered this month! 🎉"
              : `${(c.goal - c.total).toLocaleString()} ${c.verb} to go — every session counts.`}
          </p>
        </div>

        {/* Personal contribution */}
        <div className="rounded-xl border border-averna-cyan/30 bg-averna-cyan/5 p-3 flex items-center gap-3">
          <Flame className="h-5 w-5 text-orange-400 shrink-0" />
          <p className="text-sm text-gray-200">
            Your contribution: <span className="text-white font-semibold">{c.personal.toLocaleString()}</span>
            {c.personalPct > 0 && <span className="text-averna-cyan"> ({c.personalPct}% of the community)</span>}
            {c.personal === 0 && <span className="text-gray-400"> — do one activity to join in!</span>}
          </p>
        </div>

        {/* Top contributors */}
        {c.contributors.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">Top contributors</p>
            <div className="space-y-1.5">
              {c.contributors.map((m, i) => (
                <div
                  key={m.id}
                  className={`flex items-center gap-3 rounded-lg px-2.5 py-1.5 ${m.isYou ? "bg-averna-cyan/10 border border-averna-cyan/30" : ""}`}
                >
                  <span className={`w-5 text-center text-xs font-bold ${i === 0 ? "text-amber-400" : "text-gray-500"}`}>
                    {i === 0 ? <Crown className="h-4 w-4 inline" /> : i + 1}
                  </span>
                  <span className="text-sm text-white min-w-0 flex-1 truncate">
                    {m.name}
                    {m.isYou && <span className="text-averna-cyan text-[11px]"> (you)</span>}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">{m.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
