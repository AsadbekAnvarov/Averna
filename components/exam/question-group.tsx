"use client";

import { Fragment, memo } from "react";
import { Flag } from "lucide-react";
import type { ClientGroup, ClientQuestion, ExamAnswers, ExamSkill } from "@/lib/ielts/types";
import { ROMAN, answerRuleFor, binaryChoices, groupRange, parseTemplate, rangeLabel, splitPlaceholders } from "@/lib/ielts/format";
import { cn } from "@/lib/utils";

/**
 * Renders one IELTS question group (all seven kinds) in the CD-IELTS layout:
 * "Questions 1–6", the instruction, the bold answer rule (unless the instruction
 * already contains it), the shared option box when there is one, then the
 * numbered questions. Every question is wrapped in
 * an element with id="q-{n}" so the navigator can jump to it.
 *
 * Font size is inherited from the container (the exam's A−/A+ control).
 */

export interface QuestionGroupViewProps {
  group: ClientGroup;
  skill: ExamSkill;
  answers: ExamAnswers;
  onAnswer: (n: number, value: string | string[]) => void;
  flagged: Set<number>;
  onToggleFlag: (n: number) => void;
  /** The question the student is on (highlighted). */
  current?: number | null;
  onFocusQuestion?: (n: number) => void;
  disabled?: boolean;
}

function optionBoxTitle(group: ClientGroup): string {
  if (group.kind === "gap-box") return "Word list";
  const keys = (group.options ?? []).map((o) => o.key);
  if (keys.length && keys.every((k) => ROMAN.includes(k))) return "List of Headings";
  return "Options";
}

function FlagButton({ n, flagged, onToggle, disabled }: { n: number; flagged: boolean; onToggle: (n: number) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(n)}
      disabled={disabled}
      aria-pressed={flagged}
      aria-label={flagged ? `Remove review flag from question ${n}` : `Flag question ${n} for review`}
      title={flagged ? "Flagged for review" : "Flag for review"}
      className={cn(
        "ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition",
        flagged
          ? "border-amber-300/60 bg-amber-400/15 text-amber-300"
          : "border-transparent text-gray-500 hover:border-white/15 hover:text-gray-200"
      )}
    >
      <Flag className="h-4 w-4" aria-hidden />
    </button>
  );
}

function NumberBadge({ n, active }: { n: number; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-md border px-1.5 text-[0.85em] font-bold",
        active ? "border-averna-neon/60 bg-averna-neon/15 text-averna-neon" : "border-white/15 bg-white/[0.04] text-gray-100"
      )}
    >
      {n}
    </span>
  );
}

function valueOf(answers: ExamAnswers, n: number): string {
  const v = answers[String(n)];
  return typeof v === "string" ? v : "";
}

/** Case-insensitive, whitespace-normalised text for "is this already said?" checks. */
function normalizeText(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Inline typed gap — the question number sits inside the box like on the real screen. */
function GapInput({
  n,
  value,
  onAnswer,
  onFocus,
  disabled,
  active,
}: {
  n: number;
  value: string;
  onAnswer: (n: number, v: string) => void;
  onFocus?: (n: number) => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <span id={`q-${n}`} className="inline-flex scroll-mt-24 align-baseline">
      <input
        type="text"
        value={value}
        onChange={(e) => onAnswer(n, e.target.value)}
        onFocus={() => onFocus?.(n)}
        disabled={disabled}
        aria-label={`Answer to question ${n}`}
        placeholder={String(n)}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={80}
        className={cn(
          "mx-1 my-0.5 h-[1.9em] w-[9.5em] max-w-[70vw] rounded-md border bg-surface-well/30 px-2 text-center font-semibold text-white outline-none transition placeholder:font-bold placeholder:text-gray-500",
          "focus:border-averna-neon/70 focus:ring-2 focus:ring-averna-neon/25",
          active ? "border-averna-neon/60" : value ? "border-averna-cyan/40" : "border-white/20"
        )}
      />
    </span>
  );
}

function BoxSelect({
  n,
  value,
  options,
  onAnswer,
  onFocus,
  disabled,
  active,
  compact,
}: {
  n: number;
  value: string;
  options: { key: string; text: string }[];
  onAnswer: (n: number, v: string) => void;
  onFocus?: (n: number) => void;
  disabled?: boolean;
  active?: boolean;
  compact?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onAnswer(n, e.target.value)}
      onFocus={() => onFocus?.(n)}
      disabled={disabled}
      aria-label={`Answer to question ${n}`}
      className={cn(
        "h-[2.1em] rounded-md border bg-surface-raised px-2 font-semibold text-white outline-none transition",
        "focus:border-averna-neon/70 focus:ring-2 focus:ring-averna-neon/25",
        compact ? "mx-1 w-[6.5em]" : "w-full max-w-[22em]",
        active ? "border-averna-neon/60" : value ? "border-averna-cyan/40" : "border-white/20"
      )}
    >
      <option value="">{compact ? `${n}` : `Choose… (${n})`}</option>
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {compact ? o.key : `${o.key}  ${o.text.length > 70 ? `${o.text.slice(0, 68)}…` : o.text}`}
        </option>
      ))}
    </select>
  );
}

function QuestionRow({
  q,
  active,
  flagged,
  onToggleFlag,
  disabled,
  children,
}: {
  q: ClientQuestion;
  active: boolean;
  flagged: boolean;
  onToggleFlag: (n: number) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      id={`q-${q.n}`}
      className={cn(
        "scroll-mt-24 rounded-xl border p-3 transition-colors",
        active ? "border-averna-neon/40 bg-averna-neon/[0.04]" : "border-transparent"
      )}
    >
      <div className="flex items-start gap-3">
        <NumberBadge n={q.n} active={active} />
        <div className="min-w-0 flex-1">{children}</div>
        <FlagButton n={q.n} flagged={flagged} onToggle={onToggleFlag} disabled={disabled} />
      </div>
    </div>
  );
}

function OptionBox({ group }: { group: ClientGroup }) {
  const opts = group.options ?? [];
  if (!opts.length) return null;
  const roman = opts.every((o) => ROMAN.includes(o.key));
  return (
    <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="mb-2 text-[0.8em] font-bold uppercase tracking-wider text-gray-400">
        {group.kind === "matching" && group.title ? group.title : optionBoxTitle(group)}
      </p>
      <ul className={cn("grid gap-x-6 gap-y-1", group.kind === "gap-box" ? "grid-cols-2 sm:grid-cols-3" : "")}>
        {opts.map((o) => (
          <li key={o.key} className="flex gap-2">
            <span className={cn("shrink-0 font-bold text-averna-neon", roman ? "w-8" : "w-5")}>{o.key}</span>
            <span className="text-gray-200">{o.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TemplateView({
  group,
  answers,
  onAnswer,
  onFocus,
  disabled,
  current,
}: {
  group: ClientGroup;
  answers: ExamAnswers;
  onAnswer: (n: number, v: string) => void;
  onFocus?: (n: number) => void;
  disabled?: boolean;
  current?: number | null;
}) {
  const lines = parseTemplate(group.template ?? "");
  const renderInline = (text: string, key: string) => (
    <Fragment key={key}>
      {splitPlaceholders(text).map((tok, i) =>
        tok.type === "text" ? (
          <Fragment key={i}>{tok.value}</Fragment>
        ) : group.kind === "gap-box" ? (
          <span key={i} id={`q-${tok.n}`} className="inline-flex scroll-mt-24">
            <BoxSelect
              n={tok.n}
              value={valueOf(answers, tok.n)}
              options={group.options ?? []}
              onAnswer={onAnswer}
              onFocus={onFocus}
              disabled={disabled}
              active={current === tok.n}
              compact
            />
          </span>
        ) : (
          <GapInput
            key={i}
            n={tok.n}
            value={valueOf(answers, tok.n)}
            onAnswer={onAnswer}
            onFocus={onFocus}
            disabled={disabled}
            active={current === tok.n}
          />
        )
      )}
    </Fragment>
  );

  // Group consecutive table rows into one <table>.
  const blocks: ({ type: "table"; rows: { cells: string[]; header: boolean }[] } | (typeof lines)[number])[] = [];
  for (const l of lines) {
    if (l.type === "row") {
      const last = blocks[blocks.length - 1];
      if (last && last.type === "table") last.rows.push({ cells: l.cells, header: l.header });
      else blocks.push({ type: "table", rows: [{ cells: l.cells, header: l.header }] });
    } else blocks.push(l);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 leading-[2.1]">
      {group.title && group.kind !== "matching" && <p className="mb-2 text-center font-bold text-white">{group.title}</p>}
      {blocks.map((b, i) => {
        if (b.type === "table") {
          return (
            <div key={i} className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <tbody>
                  {b.rows.map((r, ri) => (
                    <tr key={ri} className={r.header ? "bg-white/[0.06]" : ""}>
                      {r.cells.map((c, ci) => {
                        const Cell = r.header ? "th" : "td";
                        return (
                          <Cell key={ci} className={cn("border border-white/15 px-3 py-1.5 align-top", r.header && "font-bold text-white")}>
                            {renderInline(c, `${i}-${ri}-${ci}`)}
                          </Cell>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (b.type === "heading") return <p key={i} className="mt-2 font-bold text-white">{renderInline(b.text, `h${i}`)}</p>;
        if (b.type === "bullet")
          return (
            <p key={i} className="flex gap-2 pl-1">
              <span className="text-averna-neon" aria-hidden>•</span>
              <span>{renderInline(b.text, `b${i}`)}</span>
            </p>
          );
        if (b.type === "blank") return <div key={i} className="h-2" />;
        if (b.type === "text") return <p key={i}>{renderInline(b.text, `t${i}`)}</p>;
        return null;
      })}
    </div>
  );
}

function QuestionGroupViewImpl({
  group,
  skill,
  answers,
  onAnswer,
  flagged,
  onToggleFlag,
  current,
  onFocusQuestion,
  disabled,
}: QuestionGroupViewProps) {
  const { from, to } = groupRange(group);
  const rule = answerRuleFor(group, skill);
  // Many papers already spell the rule out in the instructions — don't say it twice.
  const showRule = !normalizeText(group.instructions ?? "").includes(normalizeText(rule));
  const focus = (n: number) => onFocusQuestion?.(n);

  let body: React.ReactNode = null;

  if (group.kind === "tfng" || group.kind === "ynng") {
    const choices = binaryChoices(group.kind);
    body = (
      <div className="space-y-1">
        {group.questions.map((q) => {
          const v = valueOf(answers, q.n);
          return (
            <QuestionRow key={q.n} q={q} active={current === q.n} flagged={flagged.has(q.n)} onToggleFlag={onToggleFlag} disabled={disabled}>
              <p className="text-gray-100">{q.text}</p>
              <div role="radiogroup" aria-label={`Question ${q.n}`} className="mt-2 flex flex-wrap gap-2">
                {choices.map((c) => (
                  <label key={c} className="cursor-pointer">
                    <input
                      type="radio"
                      name={`q${q.n}`}
                      value={c}
                      checked={v === c}
                      onChange={() => onAnswer(q.n, c)}
                      onFocus={() => focus(q.n)}
                      disabled={disabled}
                      className="peer sr-only"
                    />
                    <span className="inline-flex min-h-[40px] items-center rounded-lg border border-white/15 bg-white/[0.03] px-3.5 text-[0.9em] font-semibold text-gray-200 transition hover:border-averna-neon/40 peer-checked:border-averna-neon/70 peer-checked:bg-averna-neon/15 peer-checked:text-averna-neon peer-focus-visible:ring-2 peer-focus-visible:ring-averna-neon/40">
                      {c}
                    </span>
                  </label>
                ))}
              </div>
            </QuestionRow>
          );
        })}
      </div>
    );
  } else if (group.kind === "mcq") {
    body = (
      <div className="space-y-2">
        {group.questions.map((q) => {
          const v = valueOf(answers, q.n);
          return (
            <QuestionRow key={q.n} q={q} active={current === q.n} flagged={flagged.has(q.n)} onToggleFlag={onToggleFlag} disabled={disabled}>
              <p className="font-medium text-gray-100">{q.text}</p>
              <div role="radiogroup" aria-label={`Question ${q.n}`} className="mt-2 space-y-1.5">
                {(q.options ?? []).map((o) => (
                  <label key={o.key} className="block cursor-pointer">
                    <input
                      type="radio"
                      name={`q${q.n}`}
                      value={o.key}
                      checked={v === o.key}
                      onChange={() => onAnswer(q.n, o.key)}
                      onFocus={() => focus(q.n)}
                      disabled={disabled}
                      className="peer sr-only"
                    />
                    <span className="flex min-h-[44px] items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-gray-200 transition hover:border-averna-neon/40 peer-checked:border-averna-neon/70 peer-checked:bg-averna-neon/10 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-averna-neon/40">
                      <span className="mt-0.5 font-bold text-averna-neon">{o.key}</span>
                      <span>{o.text}</span>
                    </span>
                  </label>
                ))}
              </div>
            </QuestionRow>
          );
        })}
      </div>
    );
  } else if (group.kind === "mcq-multi") {
    const first = group.questions[0];
    const raw = answers[String(first.n)];
    const picked = Array.isArray(raw) ? raw : [];
    const max = group.questions.length;
    const toggle = (key: string) => {
      const next = picked.includes(key) ? picked.filter((k) => k !== key) : picked.length < max ? [...picked, key] : picked;
      onAnswer(first.n, next);
    };
    body = (
      <div
        id={`q-${first.n}`}
        className={cn(
          "scroll-mt-24 rounded-xl border p-3",
          group.questions.some((q) => q.n === current) ? "border-averna-neon/40 bg-averna-neon/[0.04]" : "border-transparent"
        )}
      >
        {group.questions.slice(1).map((q) => (
          <span key={q.n} id={`q-${q.n}`} className="block scroll-mt-24" aria-hidden />
        ))}
        <div className="flex items-start gap-3">
          <span className="flex shrink-0 gap-1">
            {group.questions.map((q) => (
              <NumberBadge key={q.n} n={q.n} active={current === q.n} />
            ))}
          </span>
          <p className="min-w-0 flex-1 font-medium text-gray-100">{group.title}</p>
          <FlagButton n={first.n} flagged={flagged.has(first.n)} onToggle={onToggleFlag} disabled={disabled} />
        </div>
        <p className="mt-2 text-[0.85em] text-gray-400">
          Selected {picked.length} of {max}
        </p>
        <div role="group" aria-label={`Questions ${from}–${to}`} className="mt-2 space-y-1.5">
          {(group.options ?? []).map((o) => {
            const on = picked.includes(o.key);
            const blocked = !on && picked.length >= max;
            return (
              <label key={o.key} className={cn("block", blocked ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(o.key)}
                  onFocus={() => focus(first.n)}
                  disabled={disabled || blocked}
                  className="peer sr-only"
                />
                <span className="flex min-h-[44px] items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-gray-200 transition hover:border-averna-neon/40 peer-checked:border-averna-neon/70 peer-checked:bg-averna-neon/10 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-averna-neon/40">
                  <span className="mt-0.5 font-bold text-averna-neon">{o.key}</span>
                  <span>{o.text}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
    );
  } else if (group.kind === "matching") {
    body = (
      <>
        <OptionBox group={group} />
        <div className="space-y-1">
          {group.questions.map((q) => (
            <QuestionRow key={q.n} q={q} active={current === q.n} flagged={flagged.has(q.n)} onToggleFlag={onToggleFlag} disabled={disabled}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-gray-100">{q.text}</p>
                <BoxSelect
                  n={q.n}
                  value={valueOf(answers, q.n)}
                  options={group.options ?? []}
                  onAnswer={onAnswer}
                  onFocus={focus}
                  disabled={disabled}
                  active={current === q.n}
                />
              </div>
            </QuestionRow>
          ))}
        </div>
      </>
    );
  } else if (group.kind === "gap-box" || (group.kind === "gap" && group.template)) {
    body = (
      <>
        {group.kind === "gap-box" && <OptionBox group={group} />}
        <TemplateView group={group} answers={answers} onAnswer={onAnswer} onFocus={focus} disabled={disabled} current={current} />
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Flag questions in this group">
          {group.questions.map((q) => (
            <button
              key={q.n}
              type="button"
              onClick={() => onToggleFlag(q.n)}
              aria-pressed={flagged.has(q.n)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[0.75em] font-semibold transition",
                flagged.has(q.n) ? "border-amber-300/60 bg-amber-400/15 text-amber-300" : "border-white/10 text-gray-400 hover:text-gray-200"
              )}
            >
              <Flag className="h-3 w-3" aria-hidden /> {q.n}
            </button>
          ))}
        </div>
      </>
    );
  } else {
    // gap without template: sentence completion / short answer — gap inline in each question.
    body = (
      <div className="space-y-1">
        {group.questions.map((q) => (
          <div key={q.n} className={cn("rounded-xl border p-3", current === q.n ? "border-averna-neon/40 bg-averna-neon/[0.04]" : "border-transparent")}>
            <div className="flex items-start gap-3">
              <p className="min-w-0 flex-1 leading-[2.1] text-gray-100">
                {splitPlaceholders(q.text ?? `[[${q.n}]]`).map((tok, i) =>
                  tok.type === "text" ? (
                    <Fragment key={i}>{tok.value}</Fragment>
                  ) : (
                    <GapInput
                      key={i}
                      n={tok.n}
                      value={valueOf(answers, tok.n)}
                      onAnswer={onAnswer}
                      onFocus={focus}
                      disabled={disabled}
                      active={current === tok.n}
                    />
                  )
                )}
              </p>
              <FlagButton n={q.n} flagged={flagged.has(q.n)} onToggle={onToggleFlag} disabled={disabled} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section aria-labelledby={`grp-${from}`} className="mb-8">
      <h3 id={`grp-${from}`} className="text-[1.05em] font-bold text-white">
        {rangeLabel(from, to)}
      </h3>
      <p className={cn("mt-1 text-gray-300", !showRule && "mb-3")}>{group.instructions}</p>
      {showRule && <p className="mt-1 mb-3 font-semibold text-gray-100">{rule}</p>}
      {body}
    </section>
  );
}

export const QuestionGroupView = memo(QuestionGroupViewImpl);
