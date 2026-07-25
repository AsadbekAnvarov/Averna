import { getLearningJournal } from "@/lib/journal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookHeart, Sparkles } from "lucide-react";

/**
 * F2 — AI Learning Journal. Each active study day becomes a meaningful
 * reflection (not a stat dump) on a beautiful timeline — a personal story of
 * growth built from real data. Read-only server component.
 */
export async function LearningJournal({ studentId }: { studentId: string }) {
  const entries = await getLearningJournal(studentId);

  return (
    <Card className="glass border-averna-pink/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-14 -left-14 h-48 w-48 rounded-full bg-averna-pink/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-pink">
          <BookHeart className="h-5 w-5" /> Learning Journal
        </CardTitle>
        <p className="text-xs text-gray-400">Your story of growth, one day at a time</p>
      </CardHeader>
      <CardContent className="relative">
        {entries.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-400">
            <Sparkles className="h-8 w-8 mx-auto mb-2 text-averna-pink" />
            Your journal writes itself as you study. Complete an activity to add your first entry.
          </div>
        ) : (
          <div className="relative space-y-3 max-h-[28rem] overflow-y-auto pr-1">
            <span className="absolute left-[7px] top-1 bottom-1 w-px bg-white/10" />
            {entries.map((e) => (
              <div key={e.dateKey} className="relative pl-6">
                <span className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full bg-averna-pink ring-4 ring-black/20" />
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-400">{e.dateLabel}</span>
                    {e.highlights.length > 0 && (
                      <span className="flex flex-wrap gap-1 justify-end">
                        {e.highlights.map((h, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300">
                            {h}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-200 mt-1 leading-relaxed">{e.reflection}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
