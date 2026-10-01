import { Check, CheckCircle2, Minus, X, XCircle } from "lucide-react";
import { ReviewGroup } from "@/components/exam/review-group";
import { groupRange, partNumbers, partRange, rangeLabel } from "@/lib/ielts/format";
import type { ExamGroup, ExamListeningTest, ExamReadingTest, GradeItem, ListeningPart, ReadingPart } from "@/lib/ielts/types";
import { cn } from "@/lib/utils";
import type { ObjectiveSkill } from "./attempt";
import { PassageDetails } from "./passage";
import { RecordingPlayerProvider } from "./recording-player";
import { TranscriptDetails } from "./transcript";

/** A Listening test's one real recording, as the result page plays it (after submission only). */
export interface ReviewRecording {
  url: string;
  /** Question number → second at which its answer is spoken. */
  questionTimes?: Record<number, number>;
}

/**
 * Full answer review for an exam-v2 attempt: a question map to jump around,
 * then every attempted part with its passage / transcript (collapsed) and each
 * question group reviewed by ReviewGroup. When the paper can't be loaded any
 * more (unpublished, edited) it falls back to a plain list built from the
 * stored grading. Server component.
 */

type AnyPart = ReadingPart | ListeningPart;

interface ScopedPart {
  index: number;
  part: AnyPart;
  numbers: number[];
}

function scopedParts(test: ExamReadingTest | ExamListeningTest | null, part: number | null): ScopedPart[] {
  if (!test) return [];
  const parts: AnyPart[] = test.parts;
  const picked = part == null ? parts.map((p, index) => ({ p, index })) : parts[part] ? [{ p: parts[part], index: part }] : [];
  return picked.map(({ p, index }) => ({ index, part: p, numbers: partNumbers(p) }));
}

/** The stored grading must describe exactly the questions of the loaded parts. */
function matches(scoped: ScopedPart[], items: GradeItem[]): boolean {
  const nums = scoped.flatMap((s) => s.numbers);
  const graded = new Set(items.map((i) => i.n));
  return nums.length > 0 && nums.length === graded.size && nums.every((n) => graded.has(n));
}

const groupAnchor = (g: { questions: { n: number }[] }) => `review-q-${groupRange(g).from}`;

// ---------------------------------------------------------------------------
// Question map
// ---------------------------------------------------------------------------

function status(it: GradeItem | undefined): "correct" | "wrong" | "blank" {
  if (it?.correct) return "correct";
  return it?.given.trim() ? "wrong" : "blank";
}

const STATUS_WORD = { correct: "correct", wrong: "incorrect", blank: "no answer" } as const;

function AnswerMap({ rows }: { rows: { label: string | null; chips: { n: number; href: string; item?: GradeItem }[] }[] }) {
  return (
    <div className="mt-5">
      <ul role="list" aria-label="Key" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
        <li className="flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-averna-neon" aria-hidden /> Correct
        </li>
        <li className="flex items-center gap-1.5">
          <X className="h-3.5 w-3.5 text-red-300" aria-hidden /> Incorrect
        </li>
        <li className="flex items-center gap-1.5">
          <Minus className="h-3.5 w-3.5 text-gray-500" aria-hidden /> No answer
        </li>
      </ul>
      <nav aria-label="Jump to a question" className="mt-3 space-y-3">
        {rows.map((row, ri) => (
          <div key={row.label ?? ri}>
            {row.label && (
              <p id={`answer-map-${ri}`} className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                {row.label}
              </p>
            )}
            <ol role="list" aria-labelledby={row.label ? `answer-map-${ri}` : undefined} className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
              {row.chips.map(({ n, href, item }) => {
                const s = status(item);
                const Icon = s === "correct" ? Check : s === "wrong" ? X : Minus;
                return (
                  <li key={n}>
                    <a
                      href={href}
                      aria-label={`Question ${n}: ${STATUS_WORD[s]}`}
                      className={cn(
                        "glow-hover flex min-h-[44px] items-center justify-center gap-1 rounded-lg border text-sm font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60",
                        s === "correct" && "border-averna-neon/30 bg-averna-neon/[0.06] text-white",
                        s === "wrong" && "border-red-400/35 bg-red-500/[0.07] text-red-100",
                        s === "blank" && "border-dashed border-white/15 text-gray-400"
                      )}
                    >
                      {n}
                      <Icon
                        className={cn(
                          "h-3 w-3",
                          s === "correct" ? "text-averna-neon" : s === "wrong" ? "text-red-300" : "text-gray-500"
                        )}
                        aria-hidden
                      />
                    </a>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fallback: the stored grading on its own
// ---------------------------------------------------------------------------

function FallbackList({ items }: { items: GradeItem[] }) {
  return (
    <ol role="list" className="mt-5 space-y-2">
      {items.map((it) => {
        const s = status(it);
        const others = it.accepted.filter((a) => a && a !== it.expected);
        return (
          <li
            key={it.n}
            id={`review-item-${it.n}`}
            className={cn(
              "scroll-mt-24 rounded-xl border p-3",
              it.correct ? "border-averna-neon/25 bg-averna-neon/[0.04]" : "border-red-400/25 bg-red-500/[0.04]"
            )}
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border border-white/15 text-sm font-bold text-white">
                {it.n}
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p>
                  <span className="text-gray-400">Your answer: </span>
                  <span className={it.correct ? "font-semibold text-averna-neon" : "font-semibold text-red-300"}>
                    {s === "blank" ? "— (no answer)" : it.given}
                  </span>
                  {it.overLimit && <span className="ml-2 text-xs text-amber-300">over the word limit</span>}
                </p>
                {!it.correct && it.expected && (
                  <p className="mt-0.5">
                    <span className="text-gray-400">Correct: </span>
                    <span className="font-semibold text-white">{it.expected}</span>
                  </p>
                )}
                {others.length > 0 && (
                  <p className="mt-0.5 text-gray-400">
                    Also accepted: <span className="text-gray-200">{others.join(" / ")}</span>
                  </p>
                )}
                {it.explanation && <p className="mt-1 text-gray-400">{it.explanation}</p>}
              </div>
              {it.correct ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-averna-neon" aria-label="Correct" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 text-red-400" aria-label="Incorrect" />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export function AnswerReview({
  skill,
  test,
  part,
  items,
  recording,
}: {
  skill: ObjectiveSkill;
  test: ExamReadingTest | ExamListeningTest | null;
  /** Practised part, or null for the whole paper. */
  part: number | null;
  items: GradeItem[];
  /** Listening with one real recording (CDI): a shared player and "Play from here" per question (questionTimes). */
  recording?: ReviewRecording | null;
}) {
  const byNumber = new Map<number, GradeItem>(items.map((i) => [i.n, i]));
  const scoped = scopedParts(test, part);
  const full = matches(scoped, items);
  const word = skill === "READING" ? "Passage" : "Part";
  const times = skill === "LISTENING" && recording ? recording.questionTimes : undefined;

  const review = (
    <section id="answer-review" aria-labelledby="answer-review-title" className="scroll-mt-24 space-y-4">
      <div className="av-panel rounded-2xl p-5 sm:p-6">
        <h2 id="answer-review-title" className="text-base font-semibold text-white sm:text-lg">
          Answer review
        </h2>
        <p className="mt-0.5 text-sm text-gray-400">
          {items.length === 0
            ? "The answer details for this attempt aren't available."
            : full
              ? "Every question with your answer, the correct answer and why. Tap a number to jump to it."
              : `This ${test ? "paper has changed" : "paper is no longer available"} since you took it, so here are your answers on their own.`}
        </p>
        {items.length > 0 && (
          <AnswerMap
            rows={
              full
                ? scoped.map((s) => {
                    const anchors = new Map<number, string>();
                    for (const g of s.part.groups) for (const q of g.questions) anchors.set(q.n, `#${groupAnchor(g)}`);
                    return {
                      label: scoped.length > 1 ? `${word} ${s.index + 1}` : null,
                      chips: s.numbers.map((n) => ({ n, href: anchors.get(n) ?? `#review-part-${s.index + 1}`, item: byNumber.get(n) })),
                    };
                  })
                : [{ label: null, chips: items.map((it) => ({ n: it.n, href: `#review-item-${it.n}`, item: it })) }]
            }
          />
        )}
        {!full && items.length > 0 && <FallbackList items={items} />}
      </div>

      {full &&
        scoped.map((s) => {
          const no = s.index + 1;
          const range = partRange(s.part);
          const correct = s.numbers.filter((n) => byNumber.get(n)?.correct).length;
          const reading = skill === "READING" && "paragraphs" in s.part;
          const titleId = `review-part-${no}-title`;
          return (
            <section
              key={s.part.id || no}
              id={`review-part-${no}`}
              aria-labelledby={titleId}
              className="av-panel scroll-mt-24 rounded-2xl p-5 sm:p-6"
            >
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-averna-neon/80">
                    {reading ? `${word} ${no}` : null}
                    {reading && range ? " · " : null}
                    {range ? rangeLabel(range.from, range.to) : null}
                  </p>
                  <h2 id={titleId} className="mt-1 text-lg font-semibold text-white">
                    {reading ? s.part.title || `${word} ${no}` : `${word} ${no}`}
                  </h2>
                  {!reading && "context" in s.part && s.part.context && (
                    <p className="mt-1 text-sm text-gray-400">{s.part.context}</p>
                  )}
                </div>
                <p className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm tabular-nums text-gray-300">
                  <span className="font-semibold text-white">{correct}</span> / {s.numbers.length} correct
                </p>
              </header>

              {"paragraphs" in s.part ? (
                <PassageDetails part={s.part} no={no} />
              ) : (
                <TranscriptDetails part={s.part} no={no} />
              )}

              <div className="mt-6">
                {s.part.groups.map((g: ExamGroup, gi: number) => (
                  <div key={`${s.part.id}-${gi}`} id={groupAnchor(g)} className="scroll-mt-24">
                    <ReviewGroup group={g} skill={skill} items={byNumber} questionTimes={times} />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
    </section>
  );

  return skill === "LISTENING" && recording ? <RecordingPlayerProvider url={recording.url}>{review}</RecordingPlayerProvider> : review;
}
