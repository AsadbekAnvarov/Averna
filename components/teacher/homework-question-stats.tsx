import { ChevronDown, Lightbulb, ListChecks, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { KIND_LABEL } from "@/lib/ielts/format";
import { entriesByKind, type AnswerTally, type ClassStats, type MultiStat, type QuestionStat, type StatEntry } from "@/lib/homework/stats";

/**
 * Class statistics for Reading / Listening homework (lib/homework/stats.ts):
 * the questions to discuss in class, accuracy per question type and every
 * question with its most common wrong answers. Server component, no hooks.
 */

function tone(pct: number): { bar: string; text: string } {
  if (pct >= 75) return { bar: "bg-averna-neon", text: "text-averna-neon" };
  if (pct >= 50) return { bar: "bg-averna-cyan", text: "text-averna-cyan" };
  if (pct >= 30) return { bar: "bg-amber-300", text: "text-amber-300" };
  return { bar: "bg-averna-pink", text: "text-averna-pink" };
}

function Bar({ pct, className }: { pct: number; className?: string }) {
  return (
    <span aria-hidden className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-white/10", className)}>
      <span className={cn("block h-full rounded-full", tone(pct).bar)} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
    </span>
  );
}

const answerText = (a: { answer: string; label?: string }) => (a.label ? `${a.answer} — ${a.label}` : a.answer);
const times = (n: number) => `×${n}`;

function Score({ e }: { e: StatEntry }) {
  return (
    <p className={cn("shrink-0 text-sm font-bold tabular-nums", tone(e.pct).text)}>
      {e.pct}%
      <span className="ml-1 text-xs font-normal text-gray-500">
        ({e.earned}/{e.marks}
        {e.type === "multi" ? " marks" : ""})
      </span>
    </p>
  );
}

function QuestionDetail({ e }: { e: QuestionStat }) {
  const others = e.accepted.filter((a) => a.toLowerCase() !== e.expected.toLowerCase());
  return (
    <div className="space-y-1">
      {e.prompt && <p className="text-sm leading-relaxed text-gray-300">{e.prompt}</p>}
      <p className="text-xs text-gray-400">
        <span className="text-gray-500">Answer: </span>
        <span className="font-medium text-averna-neon">{answerText({ answer: e.expected, label: e.expectedLabel })}</span>
        {others.length > 0 && <span className="text-gray-500"> (also accepted: {others.slice(0, 4).join(", ")})</span>}
      </p>
      {e.wrong.length > 0 && (
        <p className="text-xs text-gray-300">
          <span className="text-gray-500">Most common wrong answers: </span>
          {e.wrong.map((w, i) => (
            <span key={w.answer}>
              {i > 0 && <span className="text-gray-600"> · </span>}“{answerText(w)}” <span className="text-gray-500">{times(w.count)}</span>
            </span>
          ))}
        </p>
      )}
      {(e.blank > 0 || e.overLimit > 0) && (
        <p className="text-xs text-gray-500">
          {[e.blank > 0 ? `${e.blank} left it blank` : null, e.overLimit > 0 ? `${e.overLimit} broke the word limit` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}

function distributionText(e: MultiStat): string {
  const parts: string[] = [];
  for (let k = e.perAttempt; k >= 0; k--) {
    const n = e.distribution[k] ?? 0;
    const label = k === e.perAttempt ? (e.perAttempt === 2 ? "Both right" : `All ${k} right`) : k === 0 ? "None right" : `${k} of ${e.perAttempt}`;
    parts.push(`${label}: ${n}`);
  }
  return parts.join(" · ");
}

function MultiDetail({ e }: { e: MultiStat }) {
  return (
    <div className="space-y-1">
      {e.prompt && <p className="text-sm leading-relaxed text-gray-300">{e.prompt}</p>}
      <p className="text-xs text-gray-300">
        <span className="text-gray-500">Correct letters (any order): </span>
        {e.found.map((f: AnswerTally, i: number) => (
          <span key={f.answer}>
            {i > 0 && <span className="text-gray-600"> · </span>}
            <span className="font-medium text-averna-neon">{answerText(f)}</span>{" "}
            <span className="text-gray-500">
              chosen by {f.count}/{e.attempts}
            </span>
          </span>
        ))}
      </p>
      {e.wrongPicks.length > 0 && (
        <p className="text-xs text-gray-300">
          <span className="text-gray-500">Wrong letters chosen: </span>
          {e.wrongPicks.slice(0, 4).map((w, i) => (
            <span key={w.answer}>
              {i > 0 && <span className="text-gray-600"> · </span>}“{answerText(w)}” <span className="text-gray-500">{times(w.count)}</span>
            </span>
          ))}
        </p>
      )}
      <p className="text-xs text-gray-500">
        {distributionText(e)}
        {e.blank > 0 ? ` · ${e.blank} chose nothing` : ""}
      </p>
    </div>
  );
}

function EntryDetail({ e }: { e: StatEntry }) {
  return e.type === "multi" ? <MultiDetail e={e} /> : <QuestionDetail e={e} />;
}

function EntryHead({ e, hard }: { e: StatEntry; hard?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="min-w-0 text-sm font-semibold text-white">
        {e.label}
        <span className="font-normal text-gray-400"> · {KIND_LABEL[e.kind]}</span>
        {hard && (
          <span className="ml-2 inline-flex items-center rounded-full border border-averna-pink/30 bg-averna-pink/10 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-averna-pink">
            Discuss
          </span>
        )}
      </p>
      <Score e={e} />
    </div>
  );
}

export function HomeworkQuestionStats({ stats, maxQuestions }: { stats: ClassStats; maxQuestions?: number }) {
  if (stats.attempts === 0 || stats.entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-400">
        Question statistics appear here as soon as the first student submits.
      </p>
    );
  }
  const hardIds = new Set(stats.hardest.map((e) => e.id));
  const total = maxQuestions ?? stats.meanTotal;
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-400">
        Based on {stats.attempts} attempt{stats.attempts === 1 ? "" : "s"} · average{" "}
        <span className="font-semibold text-white">
          {stats.meanCorrect} / {total}
        </span>{" "}
        correct.
        {stats.attempts < 3 && " With so few attempts, treat these numbers as a first impression."}
      </p>

      <section aria-labelledby="hw-hardest">
        <h3 id="hw-hardest" className="mb-3 flex items-center gap-2 text-base font-semibold text-white">
          <Lightbulb className="h-4 w-4 text-averna-pink" aria-hidden /> Discuss in class
        </h3>
        {stats.hardest.length === 0 ? (
          <p className="rounded-xl border border-averna-neon/20 bg-averna-neon/[0.05] p-4 text-sm text-gray-300">
            No question stood out — every question was answered correctly by at least 60% of the class.
          </p>
        ) : (
          <ol role="list" className="space-y-2">
            {stats.hardest.map((e) => (
              <li key={e.id} className="rounded-xl border border-averna-pink/25 bg-averna-pink/[0.05] p-3 sm:p-4">
                <EntryHead e={e} />
                <Bar pct={e.pct} className="my-2" />
                <EntryDetail e={e} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="hw-by-type">
        <h3 id="hw-by-type" className="mb-3 flex items-center gap-2 text-base font-semibold text-white">
          <Target className="h-4 w-4 text-averna-cyan" aria-hidden /> By question type
        </h3>
        <ul role="list" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[...stats.byKind]
            .sort((a, b) => a.pct - b.pct)
            .map((k) => (
              <li key={k.kind} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-white">
                    {KIND_LABEL[k.kind]}
                    <span className="ml-1 text-xs font-normal text-gray-500">
                      {k.questions} question{k.questions === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p className={cn("text-sm font-bold tabular-nums", tone(k.pct).text)}>{k.pct}%</p>
                </div>
                <Bar pct={k.pct} className="mt-2" />
              </li>
            ))}
        </ul>
      </section>

      <section aria-labelledby="hw-every">
        <h3 id="hw-every" className="mb-3 flex items-center gap-2 text-base font-semibold text-white">
          <ListChecks className="h-4 w-4 text-averna-neon" aria-hidden /> Every question, by type
        </h3>
        <div className="space-y-2">
          {entriesByKind(stats).map(({ kind, entries }) => (
            <details key={kind.kind} className="group rounded-xl border border-white/10 bg-white/[0.02]" open={entries.some((e) => hardIds.has(e.id))}>
              <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 p-3 sm:px-4 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 text-sm font-medium text-white">
                  {KIND_LABEL[kind.kind]}
                  <span className="ml-1 text-xs font-normal text-gray-500">
                    {entries.map((e) => e.label).join(", ")}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={cn("text-sm font-bold tabular-nums", tone(kind.pct).text)}>{kind.pct}%</span>
                  <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" aria-hidden />
                </span>
              </summary>
              <ul role="list" className="divide-y divide-white/5 border-t border-white/5">
                {entries.map((e) => (
                  <li key={e.id} className={cn("p-3 sm:px-4", hardIds.has(e.id) && "bg-averna-pink/[0.04]")}>
                    <EntryHead e={e} hard={hardIds.has(e.id)} />
                    <Bar pct={e.pct} className="my-2" />
                    <EntryDetail e={e} />
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
