import { CheckCircle2, XCircle } from "lucide-react";
import type { ExamGroup, ExamSkill, GradeItem } from "@/lib/ielts/types";
import { answerRuleFor, groupRange, rangeLabel, splitPlaceholders } from "@/lib/ielts/format";
import { cn } from "@/lib/utils";

/**
 * Post-submission review of one question group: the student's answer, the
 * correct answer(s) and the explanation for every question. No hooks — works
 * in server components (result pages) and client ones (the mock result).
 */
export function ReviewGroup({
  group,
  skill,
  items,
}: {
  group: ExamGroup;
  skill: ExamSkill;
  items: Map<number, GradeItem>;
}) {
  const { from, to } = groupRange(group);
  const optionText = (key: string) => group.options?.find((o) => o.key.toLowerCase() === key.toLowerCase())?.text;

  const describe = (key: string, perQuestion?: { key: string; text: string }[]) => {
    if (!key) return "";
    const own = perQuestion?.find((o) => o.key.toLowerCase() === key.toLowerCase())?.text;
    const shared = optionText(key);
    const text = own ?? shared;
    return text ? `${key} — ${text}` : key;
  };

  const stem = (text?: string) =>
    text
      ? splitPlaceholders(text)
          .map((t) => (t.type === "text" ? t.value : "____"))
          .join("")
      : "";

  return (
    <section className="mb-6">
      <h3 className="font-bold text-white">{rangeLabel(from, to)}</h3>
      <p className="text-sm text-gray-400">
        {group.instructions} <span className="text-gray-300">{answerRuleFor(group, skill)}</span>
      </p>
      {group.kind === "mcq-multi" && group.title && <p className="mt-1 text-sm font-medium text-gray-200">{group.title}</p>}
      <ul className="mt-3 space-y-2">
        {group.questions.map((q) => {
          const it = items.get(q.n);
          const ok = !!it?.correct;
          const blank = !it?.given;
          return (
            <li
              key={q.n}
              className={cn(
                "rounded-xl border p-3",
                ok ? "border-averna-neon/25 bg-averna-neon/[0.04]" : "border-red-400/25 bg-red-500/[0.04]"
              )}
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border border-white/15 text-sm font-bold text-white">
                  {q.n}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  {group.kind !== "mcq-multi" && (q.text || group.kind === "gap") && (
                    <p className="text-gray-200">{stem(q.text) || "Gap in the notes above"}</p>
                  )}
                  <p className="mt-1">
                    <span className="text-gray-400">Your answer: </span>
                    <span className={ok ? "font-semibold text-averna-neon" : "font-semibold text-red-300"}>
                      {blank ? "— (no answer)" : describe(it!.given, q.options)}
                    </span>
                    {it?.overLimit && <span className="ml-2 text-xs text-amber-300">over the word limit</span>}
                  </p>
                  {!ok && it && (
                    <p className="mt-0.5">
                      <span className="text-gray-400">Correct: </span>
                      <span className="font-semibold text-white">
                        {group.kind === "gap" ? it.accepted.join(" / ") : describe(it.expected, q.options)}
                      </span>
                    </p>
                  )}
                  {it?.explanation && <p className="mt-1 text-gray-400">{it.explanation}</p>}
                </div>
                {ok ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-averna-neon" aria-label="Correct" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-red-400" aria-label="Incorrect" />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
