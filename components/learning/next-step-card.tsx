import Link from "next/link";
import { db } from "@/lib/db";
import { getStudentTests } from "@/lib/student-intel";
import { Compass, ArrowRight, TrendingUp, Target } from "lucide-react";

const MODULE_META: Record<string, { label: string; href: string }> = {
  READING: { label: "Reading", href: "/learning/reading" },
  LISTENING: { label: "Listening", href: "/learning/listening" },
  WRITING: { label: "Writing", href: "/learning/writing" },
  SPEAKING: { label: "Speaking", href: "/learning/speaking" },
};

/**
 * "What's next?" — a data-driven reinforcement shown after a test result.
 * Confirms the score was saved to the Skill Journey and recommends the
 * student's weakest tested skill as the next focus, using the same averaging
 * logic as the Skill Journey. Closes the learning loop: test → feedback →
 * next action.
 */
export async function NextStepCard({
  studentId,
  completedLabel,
  completedScore,
}: {
  studentId: string;
  completedLabel?: string;
  completedScore?: number;
}) {
  const [student, tests] = await Promise.all([
    db.student.findUnique({ where: { id: studentId }, select: { targetBand: true } }),
    getStudentTests(studentId),
  ]);

  // Average band per module → find the weakest tested skill.
  const totals = new Map<string, { total: number; count: number }>();
  for (const t of tests) {
    const r = totals.get(t.module) ?? { total: 0, count: 0 };
    r.total += t.score;
    r.count += 1;
    totals.set(t.module, r);
  }

  let focusKey: string | null = null;
  let focusAvg = Infinity;
  for (const [key, r] of totals) {
    if (!MODULE_META[key]) continue;
    const avg = r.total / r.count;
    if (avg < focusAvg) {
      focusAvg = avg;
      focusKey = key;
    }
  }

  const target = student?.targetBand ? parseFloat(student.targetBand.replace(/[^0-9.]/g, "")) : null;
  const reachedTarget = target != null && completedScore != null && completedScore >= target;
  const focus = focusKey ? MODULE_META[focusKey] : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-averna-neon/30 glass-strong p-6 mt-8 animate-fade-in">
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-averna-neon/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Compass className="h-5 w-5 text-averna-neon" />
          <span className="text-xs uppercase tracking-wider text-averna-neon font-semibold">What&apos;s next</span>
        </div>

        <h2 className="text-xl font-bold text-white">
          {reachedTarget
            ? "🎉 You hit your target band on this test!"
            : "Nice work — this result is saved to your progress"}
        </h2>
        <p className="text-gray-300 mt-1 mb-5 max-w-xl text-sm">
          {completedLabel && completedScore != null
            ? `Your ${completedLabel} band (${completedScore.toFixed(1)}) now feeds your Skill Journey and band prediction. `
            : "Your result now feeds your Skill Journey and band prediction. "}
          {focus
            ? `Right now, ${focus.label} is your lowest skill (avg ${focusAvg.toFixed(1)}) — the fastest place to gain points.`
            : "Keep practising across all four skills to lift your overall band."}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {focus && (
            <Link
              href={focus.href}
              className="inline-flex items-center gap-2 rounded-xl bg-averna-primary hover:bg-averna-light text-white px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              <Target className="h-4 w-4" />
              Practise {focus.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          <Link
            href="/progress"
            className="inline-flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors"
          >
            <TrendingUp className="h-4 w-4" />
            View full progress
          </Link>
          <Link
            href="/learning"
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Skill Journey →
          </Link>
        </div>
      </div>
    </div>
  );
}
