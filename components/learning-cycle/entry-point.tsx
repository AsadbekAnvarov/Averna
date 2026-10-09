import Link from "next/link";
import { ArrowRight, BookOpenCheck } from "lucide-react";
import { learningCycleEnabled } from "@/lib/learning-cycle/rules";
export function CycleEntryPoint({ testId }: { testId: string }) {
  if (!learningCycleEnabled()) return null;
  return <section className="glass my-6 rounded-2xl border border-averna-cyan/25 p-5 sm:p-6"><h2 className="flex items-center gap-2 text-lg font-semibold text-white"><BookOpenCheck className="h-5 w-5 text-averna-cyan" aria-hidden />Make feedback useful</h2><p className="mt-2 text-sm leading-relaxed text-gray-400">Understand the recorded criteria, revise your answer, and apply the skill to a new task. Keep both responses and teacher feedback in your private portfolio.</p><Link href={`/learning/feedback-cycle/${encodeURIComponent(testId)}`} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-averna-cyan/30 px-4 text-sm font-semibold text-averna-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-cyan">Open practice cycle <ArrowRight className="h-4 w-4" aria-hidden /></Link></section>;
}
