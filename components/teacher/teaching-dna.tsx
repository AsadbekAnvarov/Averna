import { getTeachingDNA } from "@/lib/teacher-intel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dna, Users, CheckCircle2, Clock, MessageSquare, Star, TrendingUp } from "lucide-react";

function reviewLabel(hrs: number | null): string {
  if (hrs == null) return "—";
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round((hrs / 24) * 10) / 10}d`;
}

/**
 * F7 — Personal Teaching DNA. The teacher's own profile from real data: reach,
 * essays reviewed, turnaround speed, feedback depth, student satisfaction and
 * the average band improvement of their students — with strengths and focus
 * areas. Read-only.
 */
export async function TeachingDNA({ teacherId }: { teacherId: string }) {
  const d = await getTeachingDNA(teacherId);

  const metrics = [
    { icon: Users, label: "Students", value: d.studentsTaught, color: "text-averna-cyan" },
    { icon: CheckCircle2, label: "Reviewed", value: d.essaysReviewed, color: "text-averna-neon" },
    { icon: Clock, label: "Turnaround", value: reviewLabel(d.avgReviewHrs), color: "text-averna-purple" },
    { icon: MessageSquare, label: "Feedback", value: `${d.avgFeedbackLen}c`, color: "text-averna-pink" },
    { icon: Star, label: "Rating", value: d.avgRating != null ? d.avgRating : "—", color: "text-amber-400" },
    { icon: TrendingUp, label: "Avg gain", value: d.improvementRate != null ? `${d.improvementRate > 0 ? "+" : ""}${d.improvementRate.toFixed(2)}` : "—", color: "text-averna-neon" },
  ];

  return (
    <Card className="glass border-averna-cyan/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-14 -left-14 h-48 w-48 rounded-full bg-averna-cyan/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-cyan">
          <Dna className="h-5 w-5" /> Your Teaching DNA
        </CardTitle>
        <p className="text-xs text-gray-400">How your teaching shows up in the data (last 90 days)</p>
      </CardHeader>
      <CardContent className="space-y-4 relative">
        <div className="grid grid-cols-3 gap-2">
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="rounded-xl border border-white/10 bg-white/5 py-3 text-center">
                <Icon className={`h-4 w-4 mx-auto ${m.color}`} />
                <p className="text-lg font-bold text-white mt-1 tabular-nums">{m.value}</p>
                <p className="text-[10px] text-gray-500">{m.label}</p>
              </div>
            );
          })}
        </div>

        {d.strengths.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-averna-neon mb-1.5">Strengths</p>
            <div className="flex flex-wrap gap-1.5">
              {d.strengths.map((s) => (
                <span key={s} className="text-[11px] px-2 py-0.5 rounded-full border border-averna-neon/40 bg-averna-neon/10 text-averna-neon">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {d.focus.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-amber-300 mb-1.5">Room to grow</p>
            <div className="flex flex-wrap gap-1.5">
              {d.focus.map((s) => (
                <span key={s} className="text-[11px] px-2 py-0.5 rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-300">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {d.essaysReviewed === 0 && (
          <p className="text-[11px] text-gray-500">Grade a few submissions and your Teaching DNA will take shape.</p>
        )}
      </CardContent>
    </Card>
  );
}
