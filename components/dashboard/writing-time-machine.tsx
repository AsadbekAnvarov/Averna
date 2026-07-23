import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, ArrowRight, TrendingUp, Sparkles } from "lucide-react";

const CRITERIA = [
  { key: "taskAchievement", label: "Task" },
  { key: "coherenceCohesion", label: "Coherence" },
  { key: "lexicalResource", label: "Lexical" },
  { key: "grammarAccuracy", label: "Grammar" },
] as const;

function bandColor(score: number) {
  if (score >= 7) return "text-averna-neon";
  if (score >= 6) return "text-averna-cyan";
  if (score >= 5) return "text-amber-400";
  return "text-red-300";
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

/**
 * Writing Time Machine — pulls a student's saved Writing submissions and puts
 * their earliest essay side-by-side with their latest, showing exactly how far
 * they've come: overall band growth, per-criterion progress, and both essays in
 * full. Turns invisible progress into a visible, motivating story. Server
 * component; reads the essay text already stored in IELTSTest.answers.
 */
export async function WritingTimeMachine({ studentId }: { studentId: string }) {
  const tests = await db.iELTSTest.findMany({
    where: { studentId, module: "WRITING" },
    orderBy: { completedAt: "asc" },
    take: 50,
  });

  const withEssays = tests.filter((t) => {
    const essay = (t.answers as { essay?: unknown } | null)?.essay;
    return typeof essay === "string" && essay.trim().length > 0;
  });

  if (withEssays.length < 2) {
    return (
      <Card className="glass border-averna-cyan/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-averna-cyan">
            <History className="h-5 w-5" /> Writing Time Machine
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6 text-sm text-gray-400">
          <Sparkles className="h-8 w-8 mx-auto mb-2 text-averna-cyan" />
          Complete a couple of Writing tasks and come back — you&apos;ll see your past self next to your present one,
          and exactly how much you&apos;ve grown.
        </CardContent>
      </Card>
    );
  }

  const then = withEssays[0];
  const now = withEssays[withEssays.length - 1];
  const thenEssay = String((then.answers as { essay?: string }).essay ?? "");
  const nowEssay = String((now.answers as { essay?: string }).essay ?? "");
  const thenAnalysis = (then.aiAnalysis ?? {}) as Record<string, number>;
  const nowAnalysis = (now.aiAnalysis ?? {}) as Record<string, number>;

  const delta = now.score - then.score;
  const days = Math.max(1, Math.round((now.completedAt.getTime() - then.completedAt.getTime()) / 86_400_000));

  const maxBand = 9;
  const spark = withEssays.slice(-14);

  const panel = (label: string, t: typeof then, essay: string) => (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] uppercase tracking-wider text-gray-400">{label}</span>
        <span className="text-[11px] text-gray-500">{fmtDate(t.completedAt)}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-extrabold ${bandColor(t.score)}`}>{t.score.toFixed(1)}</span>
        <span className="text-[11px] text-gray-500">band · {wordCount(essay)} words</span>
      </div>
      <div className="mt-2 rounded-lg bg-white/5 border border-white/10 p-2.5 max-h-40 overflow-y-auto">
        <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{essay}</p>
      </div>
    </div>
  );

  return (
    <Card className="glass border-averna-cyan/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-averna-cyan/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-averna-cyan">
          <span className="flex items-center gap-2">
            <History className="h-5 w-5" /> Writing Time Machine
          </span>
          <span className="text-xs font-normal text-gray-400">{withEssays.length} essays</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Growth banner */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          {delta > 0 ? (
            <p className="flex items-center justify-center gap-2 text-lg font-bold text-averna-neon">
              <TrendingUp className="h-5 w-5" /> +{delta.toFixed(1)} band{delta === 1 ? "" : "s"} in {days} days
            </p>
          ) : delta === 0 ? (
            <p className="text-sm text-gray-300">
              Same band as your first essay — consistency is a foundation. Push a criterion below to break through.
            </p>
          ) : (
            <p className="text-sm text-gray-300">
              An off day happens — one essay doesn&apos;t define you. Look at how much stronger your writing reads now.
            </p>
          )}
        </div>

        {/* Then vs Now essays */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch">
          {panel("Then", then, thenEssay)}
          <div className="hidden sm:flex items-center">
            <ArrowRight className="h-5 w-5 text-averna-cyan" />
          </div>
          {panel("Now", now, nowEssay)}
        </div>

        {/* Per-criterion progress */}
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-gray-400">Criteria then → now</p>
          {CRITERIA.map((c) => {
            const a = Number(thenAnalysis[c.key] ?? 0);
            const b = Number(nowAnalysis[c.key] ?? 0);
            const d = b - a;
            return (
              <div key={c.key} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs text-gray-300">{c.label}</span>
                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden relative">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-white/20"
                    style={{ width: `${(a / maxBand) * 100}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-averna-cyan to-averna-neon"
                    style={{ width: `${(b / maxBand) * 100}%`, opacity: 0.85 }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-xs">
                  <span className={bandColor(b)}>{b.toFixed(1)}</span>{" "}
                  {d !== 0 && (
                    <span className={d > 0 ? "text-averna-neon" : "text-red-300"}>
                      ({d > 0 ? "+" : ""}
                      {d.toFixed(1)})
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* Band sparkline */}
        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">Band over time</p>
          <div className="flex items-end gap-1 h-16">
            {spark.map((t, i) => (
              <div
                key={t.id}
                className="flex-1 rounded-t bg-gradient-to-t from-averna-cyan/40 to-averna-neon/70"
                style={{ height: `${Math.max(6, (t.score / maxBand) * 100)}%` }}
                title={`${t.score.toFixed(1)} · ${fmtDate(t.completedAt)}`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
