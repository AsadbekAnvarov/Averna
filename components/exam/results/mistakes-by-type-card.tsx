import { ArrowRight, Target } from "lucide-react";
import { PRACTICE_KIND_LABEL, practiceKindOf } from "@/lib/ielts/format";
import type { ExamListeningTest, ExamReadingTest, GradeItem, PracticeKind } from "@/lib/ielts/types";
import { practiseLabel, type MistakeRow, type PracticePick } from "@/lib/review/practice-by-type";
import { cn } from "@/lib/utils";
import { practiceHref, scopeLabel, type ObjectiveSkill } from "./attempt";

/**
 * "Your mistakes by type": wrong and blank answers grouped by question type,
 * each with one part of another paper to practise that type on (owner only).
 * Presentational and pure; MistakesByTypeSection loads the data.
 */

export interface MistakeLine extends MistakeRow {
  pick: PracticePick | null;
}

/** An item's type, refined from the paper (matching headings / information). */
export function kindResolver(test: ExamReadingTest | ExamListeningTest | null): (it: GradeItem) => PracticeKind {
  const byNumber = new Map<number, PracticeKind>();
  for (const p of test?.parts ?? []) for (const g of p.groups) for (const q of g.questions) byNumber.set(q.n, practiceKindOf(g));
  return (it) => {
    const k = byNumber.get(it.n);
    // Only refine within the graded kind (the paper may have changed since).
    return k && (k === it.kind || (it.kind === "matching" && k.startsWith("matching"))) ? k : it.kind;
  };
}

export function MistakesByTypeCard({ skill, lines, className }: { skill: ObjectiveSkill; lines: MistakeLine[]; className?: string }) {
  if (!lines.length) return null;
  return (
    <section aria-labelledby="mistakes-title" className={cn("av-panel flex flex-col rounded-2xl p-5 sm:p-6", className)}>
      <h2 id="mistakes-title" className="flex items-center gap-2 text-base font-semibold text-white sm:text-lg">
        <Target className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
        Your mistakes by type
      </h2>
      <p className="mt-0.5 text-sm text-gray-400">
        One {skill === "READING" ? "passage" : "part"} of another test for each type you lost marks on.
      </p>
      <ul role="list" className="mt-4 flex-1 divide-y divide-white/10">
        {lines.map((l) => {
          const label = PRACTICE_KIND_LABEL[l.kind];
          const where = l.pick ? [l.pick.testTitle, l.pick.part != null ? scopeLabel(skill, l.pick.part) : null].filter(Boolean).join(" · ") : null;
          return (
            <li key={l.kind} className="py-3 first:pt-0 last:pb-0" data-testid={`mistakes-${l.kind}`}>
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-medium text-gray-100">{label}</span>
                <span className="tabular-nums text-gray-400">
                  <span className="font-semibold text-white">{l.wrong}</span> of {l.total} wrong
                </span>
              </p>
              {l.pick ? (
                <>
                  <a
                    href={practiceHref(skill, l.pick.testId, l.pick.part)}
                    className="mt-1.5 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg text-sm font-semibold text-averna-neon hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
                  >
                    {practiseLabel(l.kind)}
                    <span className="sr-only">: {where}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </a>
                  <p className="text-xs text-gray-500" aria-hidden>
                    {where}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-gray-500">No other {skill === "READING" ? "passage" : "part"} with this type yet.</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
