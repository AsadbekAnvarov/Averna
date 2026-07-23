import Link from "next/link";
import { getTeachingAssistant } from "@/lib/teacher-intel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";

/**
 * F6 — AI Teaching Assistant. Proactive, data-backed recommendations for the
 * class: weakest skill to review, students who've gone quiet, who needs speaking
 * practice, grading to clear. Read-only. Every tip is grounded in real data.
 */
export async function TeachingAssistant({ teacherId }: { teacherId: string }) {
  const tips = await getTeachingAssistant(teacherId);

  return (
    <Card className="glass border-averna-purple/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-14 -right-14 h-48 w-48 rounded-full bg-averna-purple/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-purple">
          <Sparkles className="h-5 w-5" /> AI Teaching Assistant
        </CardTitle>
        <p className="text-xs text-gray-400">What I'd focus on with your classes right now</p>
      </CardHeader>
      <CardContent className="space-y-2 relative">
        {tips.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-averna-neon py-3">
            <CheckCircle2 className="h-5 w-5" /> Nothing urgent — your classes are in good shape.
          </div>
        ) : (
          tips.map((t) => (
            <Link
              key={t.id}
              href={t.href}
              className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 hover:border-averna-purple/30 p-3 transition-colors group"
            >
              <span className="mt-0.5 h-6 w-6 shrink-0 rounded-lg bg-averna-purple/15 text-averna-purple flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{t.text}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{t.detail}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-500 shrink-0 group-hover:text-averna-purple group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
