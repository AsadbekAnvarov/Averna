import { Info, Lightbulb, Sparkles } from "lucide-react";
import { KIND_LABEL } from "@/lib/ielts/format";
import type { GradeItem, GroupKind } from "@/lib/ielts/types";
import { cn } from "@/lib/utils";
import { GROUP_KINDS, type KindStats, type ObjectiveSkill } from "./attempt";
import { blankTip, tipFor } from "./tips";

/**
 * Accuracy per question type (TRUE/FALSE/NOT GIVEN, matching, completion …)
 * with the weakest type highlighted and one concrete habit to fix it.
 * Server component.
 */

interface Row {
  kind: GroupKind;
  correct: number;
  total: number;
  pct: number;
}

/** Paper order (first question of each type); JSON columns don't keep key order. */
function orderedKinds(byKind: KindStats, items: GradeItem[]): GroupKind[] {
  const seen: GroupKind[] = [];
  for (const it of items) if (byKind[it.kind] && !seen.includes(it.kind)) seen.push(it.kind);
  for (const k of GROUP_KINDS) if (byKind[k] && !seen.includes(k)) seen.push(k);
  return seen;
}

/** Lowest accuracy; ties → more marks lost, then more questions. Null when nothing was lost. */
function weakestOf(rows: Row[]): Row | null {
  const lost = rows.filter((r) => r.correct < r.total);
  if (!lost.length) return null;
  return [...lost].sort(
    (a, b) => a.pct - b.pct || b.total - b.correct - (a.total - a.correct) || b.total - a.total
  )[0];
}

export function KindBreakdown({
  skill,
  byKind,
  items,
  blanks,
}: {
  skill: ObjectiveSkill;
  byKind: KindStats;
  items: GradeItem[];
  /** Questions left unanswered. */
  blanks: number;
}) {
  const rows: Row[] = orderedKinds(byKind, items).map((kind) => {
    const s = byKind[kind] ?? { correct: 0, total: 0 };
    return { kind, correct: s.correct, total: s.total, pct: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0 };
  });
  if (!rows.length) return null;

  const weakest = weakestOf(rows);
  const tip = weakest ? tipFor(skill, weakest.kind) : null;

  return (
    <section aria-labelledby="kinds-title" className="av-panel rounded-2xl p-5 sm:p-6">
      <h2 id="kinds-title" className="text-base font-semibold text-white sm:text-lg">
        Accuracy by question type
      </h2>
      <p className="mt-0.5 text-sm text-gray-400">Where your marks came from — and where the next ones are.</p>

      <ul role="list" className="mt-5 space-y-4">
        {rows.map((r) => {
          const weak = weakest?.kind === r.kind;
          const label = KIND_LABEL[r.kind];
          return (
            <li key={r.kind}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className={cn("min-w-0 font-medium", weak ? "text-amber-100" : "text-gray-200")}>
                  {label}
                  {weak && (
                    <span className="ml-2 rounded-full border border-amber-300/35 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                      Focus next
                    </span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums text-gray-400">
                  <span className="font-semibold text-white">{r.correct}</span> / {r.total}
                  <span className="ml-2 inline-block w-10 text-right">{r.pct}%</span>
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={`${label}: ${r.correct} of ${r.total} correct`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={r.pct}
                className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10 print:border print:border-gray-400"
              >
                <div
                  className={cn("meter-fill h-full rounded-full", weak ? "bg-amber-300" : "bg-averna-neon")}
                  style={{ width: `${r.pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {weakest && tip ? (
        <div className="mt-6 rounded-2xl border border-amber-300/30 bg-amber-400/[0.06] p-4">
          <p className="flex items-start gap-2.5 text-sm font-semibold text-amber-100">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
            <span>
              {KIND_LABEL[weakest.kind]} ({weakest.correct} / {weakest.total}): {tip.focus}
            </span>
          </p>
          <p className="mt-1.5 pl-[1.625rem] text-sm leading-relaxed text-gray-200">{tip.tip}</p>
        </div>
      ) : (
        <p className="mt-6 flex items-start gap-2.5 rounded-2xl border border-averna-neon/25 bg-averna-neon/[0.05] p-4 text-sm text-gray-200">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
          <span>Every question type was answered correctly. Try a harder paper or the full test under exam timing next.</span>
        </p>
      )}

      {blanks > 0 && (
        <p className="mt-3 flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed text-gray-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
          <span>{blankTip(skill, blanks)}</span>
        </p>
      )}
    </section>
  );
}
