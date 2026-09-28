"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Layers, Loader2, PenLine, RefreshCw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { KIND_LABEL } from "@/lib/ielts/format";
import type { ExamDifficulty, ExamSource, GroupKind } from "@/lib/ielts/types";
import { DifficultyBadge, SOURCE_LABEL, SourceBadge, kindLabels } from "@/components/library/badges";
import { KindIcon, toneOf } from "@/components/homework/exam-kind";
import {
  EXAM_KIND_INFO,
  LIBRARY_KINDS,
  SPEAKING_MINUTES,
  WRITING_TASK,
  matchesQuery,
  scopeFacts,
  scopeOptions,
  suggestedDifficulty,
  suggestedTitle,
  type ExamHomeworkKind,
  type HomeworkLibrary,
  type LibraryObjective,
  type LibrarySpeaking,
  type LibraryWriting,
} from "@/lib/homework/library-shared";

/**
 * The teacher's test-library picker: kind → content (search + filters over
 * the whole catalog) → passage / part. Loads summaries from
 * GET /api/teacher/homework/library (no answers) and reports the selection;
 * the create route re-validates everything against the catalog.
 */

type ObjectiveKind = "READING" | "LISTENING";

export type LibrarySelection =
  | { kind: ObjectiveKind; item: LibraryObjective; part: number | null }
  | { kind: "WRITING_TASK1" | "WRITING_TASK2"; item: LibraryWriting }
  | { kind: "WRITING_EXAM"; task1: LibraryWriting | null; task2: LibraryWriting | null }
  | { kind: "SPEAKING"; item: LibrarySpeaking };

export function isSelectionComplete(s: LibrarySelection | null): s is LibrarySelection {
  if (!s) return false;
  return s.kind === "WRITING_EXAM" ? !!(s.task1 && s.task2) : true;
}

/** The create route's content fields for a selection. */
export function selectionPayload(s: LibrarySelection): Record<string, string | number | null> {
  switch (s.kind) {
    case "READING":
    case "LISTENING":
      return { contentKind: s.kind, contentId: s.item.id, contentPart: s.part };
    case "WRITING_EXAM":
      return { contentKind: s.kind, task1Id: s.task1?.id ?? null, task2Id: s.task2?.id ?? null, contentPart: null };
    default:
      return { contentKind: s.kind, contentId: s.item.id, contentPart: null };
  }
}

function scopeName(kind: ObjectiveKind, part: number | null): string {
  return part == null ? "Full test" : `${kind === "READING" ? "Passage" : "Part"} ${part + 1}`;
}

export function selectionTitle(s: LibrarySelection): string {
  switch (s.kind) {
    case "READING":
    case "LISTENING":
      return suggestedTitle(s.kind, { title: s.item.title, scope: scopeName(s.kind, s.part) });
    case "WRITING_EXAM":
      return s.task1 && s.task2 ? suggestedTitle(s.kind, { title: s.task1.title, second: s.task2.title }) : "";
    default:
      return suggestedTitle(s.kind, { title: s.item.title });
  }
}

/** Suggested Homework.difficulty (1–5) — only papers carry a difficulty. */
export function selectionDifficulty(s: LibrarySelection): number | null {
  return s.kind === "READING" || s.kind === "LISTENING" ? suggestedDifficulty(s.item.difficulty) : null;
}

// ---------------------------------------------------------------------------
// Look
// ---------------------------------------------------------------------------

const chip =
  "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon";
const chipOn = "border-averna-neon/60 bg-averna-neon/10 text-averna-neon";
const chipOff = "border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/25 hover:text-white";
const selectCls =
  "min-h-[36px] rounded-full border border-white/10 bg-averna-dark/80 px-3 text-xs text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon";

const PAGE = 30;

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; library: HomeworkLibrary };

function useHomeworkLibrary(): [LoadState, () => void] {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    fetch("/api/teacher/homework/library")
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok || !data || !Array.isArray(data.reading)) throw new Error(data?.error || "The test library couldn't be loaded.");
        return data as HomeworkLibrary;
      })
      .then((library) => alive && setState({ status: "ready", library }))
      .catch((e: unknown) => alive && setState({ status: "error", message: e instanceof Error ? e.message : "The test library couldn't be loaded." }));
    return () => {
      alive = false;
    };
  }, [attempt]);
  return [state, () => setAttempt((a: number) => a + 1)];
}

function countFor(lib: HomeworkLibrary, kind: ExamHomeworkKind): string {
  switch (kind) {
    case "READING":
      return `${lib.reading.length} tests`;
    case "LISTENING":
      return `${lib.listening.length} tests`;
    case "WRITING_TASK1":
      return `${lib.task1.length} tasks`;
    case "WRITING_TASK2":
      return `${lib.task2.length} tasks`;
    case "WRITING_EXAM":
      return lib.task1.length && lib.task2.length ? "Pick Task 1 + Task 2" : "No tasks yet";
    case "SPEAKING":
      return `${lib.speaking.length} sets`;
  }
}

// ---------------------------------------------------------------------------
// Picker
// ---------------------------------------------------------------------------

export function HomeworkLibraryPicker({
  value,
  onChange,
}: {
  value: LibrarySelection | null;
  onChange: (s: LibrarySelection | null) => void;
}) {
  const [state, retry] = useHomeworkLibrary();
  const [kind, setKind] = useState<ExamHomeworkKind>(value?.kind ?? "READING");

  const chooseKind = (k: ExamHomeworkKind) => {
    if (k === kind) return;
    setKind(k);
    onChange(k === "WRITING_EXAM" ? { kind: k, task1: null, task2: null } : null);
  };

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-white">What should students do?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LIBRARY_KINDS.map((k) => {
            const info = EXAM_KIND_INFO[k];
            const on = k === kind;
            return (
              <label
                key={k}
                className={cn(
                  "relative flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-averna-neon",
                  on ? cn("bg-white/[0.06]", toneOf(k).ring) : "border-white/10 bg-white/[0.02] hover:border-white/25"
                )}
              >
                <input
                  type="radio"
                  name="homework-kind"
                  value={k}
                  checked={on}
                  onChange={() => chooseKind(k)}
                  className="sr-only"
                />
                <KindIcon kind={k} className="h-9 w-9" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white">{info.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-gray-400">{info.blurb}</span>
                  {state.status === "ready" && (
                    <span className="mt-1 block text-[11px] font-medium text-gray-500">{countFor(state.library, k)}</span>
                  )}
                </span>
                {on && <CheckCircle2 aria-hidden className="absolute right-2 top-2 h-4 w-4 text-averna-neon" />}
              </label>
            );
          })}
        </div>
      </fieldset>

      {state.status === "loading" && (
        <div role="status" className="space-y-2">
          <p className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading the test library…
          </p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-white/5 bg-white/[0.03]" />
          ))}
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">{state.message}</span>
          <button type="button" onClick={retry} className={cn(chip, chipOff)}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
          </button>
        </div>
      )}

      {state.status === "ready" && (
        <KindContent key={kind} kind={kind} library={state.library} value={value?.kind === kind ? value : null} onChange={onChange} />
      )}
    </div>
  );
}

function KindContent({
  kind,
  library,
  value,
  onChange,
}: {
  kind: ExamHomeworkKind;
  library: HomeworkLibrary;
  value: LibrarySelection | null;
  onChange: (s: LibrarySelection | null) => void;
}) {
  if (kind === "READING" || kind === "LISTENING") {
    const items = kind === "READING" ? library.reading : library.listening;
    const sel = value && (value.kind === "READING" || value.kind === "LISTENING") ? value : null;
    if (sel) {
      return (
        <SelectedObjective
          kind={kind}
          item={sel.item}
          part={sel.part}
          onPart={(part) => onChange({ kind, item: sel.item, part })}
          onClear={() => onChange(null)}
        />
      );
    }
    return <ObjectiveBrowser kind={kind} items={items} onPick={(item) => onChange({ kind, item, part: null })} />;
  }

  if (kind === "WRITING_TASK1" || kind === "WRITING_TASK2") {
    const sel = value && (value.kind === "WRITING_TASK1" || value.kind === "WRITING_TASK2") ? value : null;
    const items = kind === "WRITING_TASK1" ? library.task1 : library.task2;
    if (sel) return <SelectedWriting task={kind === "WRITING_TASK1" ? "task1" : "task2"} item={sel.item} onClear={() => onChange(null)} />;
    return <WritingBrowser task={kind === "WRITING_TASK1" ? "task1" : "task2"} items={items} onPick={(item) => onChange({ kind, item })} />;
  }

  if (kind === "WRITING_EXAM") {
    const sel = value && value.kind === "WRITING_EXAM" ? value : { kind: "WRITING_EXAM" as const, task1: null, task2: null };
    return <WritingExamPicker library={library} task1={sel.task1} task2={sel.task2} onChange={(t1, t2) => onChange({ kind, task1: t1, task2: t2 })} />;
  }

  const sel = value && value.kind === "SPEAKING" ? value : null;
  if (sel) return <SelectedSpeaking item={sel.item} onClear={() => onChange(null)} />;
  return <SpeakingBrowser items={library.speaking} onPick={(item) => onChange({ kind: "SPEAKING", item })} />;
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function SearchBox({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder: string }) {
  return (
    <div className="relative">
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
      <input
        type="search"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        // The picker lives inside the homework form: Enter filters, it never submits.
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        aria-label={label}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-white/10 bg-averna-dark/60 pl-9 pr-9 text-sm text-white placeholder:text-gray-500 focus:border-averna-neon/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function ResultCount({ shown, total, all }: { shown: number; total: number; all: number }) {
  return (
    <p className="text-xs text-gray-500" aria-live="polite">
      {total === all ? `${all} available` : `${total} of ${all} match`}
      {shown < total ? ` · showing ${shown}` : ""}
    </p>
  );
}

function ShowMore({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  if (shown >= total) return null;
  return (
    <button type="button" onClick={onMore} className={cn(chip, chipOff, "mx-auto flex")}>
      Show {Math.min(PAGE, total - shown)} more
    </button>
  );
}

function NoMatches({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
      <p className="text-sm text-gray-300">Nothing matches these filters.</p>
      <button type="button" onClick={onReset} className="mt-2 text-sm font-medium text-averna-neon hover:underline">
        Clear search and filters
      </button>
    </div>
  );
}

/** One choosable item; its whole content (title, counts, badges) is the button's accessible name. */
function PickRow({ onPick, children }: { onPick: () => void; children: React.ReactNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="glow-hover w-full rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:border-averna-neon/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon sm:p-4"
      >
        <span className="sr-only">Choose: </span>
        {children}
      </button>
    </li>
  );
}

function SelectedShell({ kind, title, onClear, clearLabel, children }: { kind: ExamHomeworkKind; title: string; onClear: () => void; clearLabel: string; children?: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl border bg-white/[0.04] p-4 sm:p-5", toneOf(kind).ring)}>
      <div className="flex items-start gap-3">
        <KindIcon kind={kind} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">{EXAM_KIND_INFO[kind].label}</p>
          <h3 className="text-base font-semibold leading-snug text-white sm:text-lg">{title}</h3>
        </div>
        <button type="button" onClick={onClear} className={cn(chip, chipOff, "shrink-0")}>
          {clearLabel}
        </button>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reading / Listening
// ---------------------------------------------------------------------------

const DIFFICULTIES: ExamDifficulty[] = ["Easy", "Medium", "Hard"];
const SOURCES: ExamSource[] = ["averna", "generated", "legacy"];

function objectiveText(i: LibraryObjective): string {
  return [i.title, i.description, ...i.topics, ...i.parts.map((p) => p.title), ...kindLabels(i.kinds), i.difficulty, SOURCE_LABEL[i.source]]
    .join(" ")
    .toLowerCase();
}

function ObjectiveBrowser({ kind, items, onPick }: { kind: ObjectiveKind; items: LibraryObjective[]; onPick: (i: LibraryObjective) => void }) {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<ExamDifficulty | "all">("all");
  const [source, setSource] = useState<ExamSource | "all">("all");
  const [fullOnly, setFullOnly] = useState(false);
  const [qtype, setQtype] = useState<GroupKind | "all">("all");
  const [limit, setLimit] = useState(PAGE);
  const deferred = useDeferredValue(query);

  const haystacks = useMemo(() => new Map(items.map((i) => [i.id, objectiveText(i)] as [string, string])), [items]);
  const qtypes = useMemo(() => Array.from(new Set(items.flatMap((i) => i.kinds))) as GroupKind[], [items]);
  const sources = useMemo(() => SOURCES.filter((s) => items.some((i) => i.source === s)), [items]);
  const fullCount = useMemo(() => items.filter((i) => i.full).length, [items]);

  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          (difficulty === "all" || i.difficulty === difficulty) &&
          (source === "all" || i.source === source) &&
          (!fullOnly || i.full) &&
          (qtype === "all" || i.kinds.includes(qtype)) &&
          (!deferred.trim() || matchesQuery(haystacks.get(i.id) ?? "", deferred))
      ),
    [items, difficulty, source, fullOnly, qtype, deferred, haystacks]
  );
  useEffect(() => setLimit(PAGE), [difficulty, source, fullOnly, qtype, deferred]);

  const reset = () => {
    setQuery("");
    setDifficulty("all");
    setSource("all");
    setFullOnly(false);
    setQtype("all");
  };
  const noun = kind === "READING" ? "passages" : "parts";

  if (!items.length) {
    return <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-400">No tests in the library yet.</p>;
  }

  return (
    <div className="space-y-3">
      <SearchBox
        value={query}
        onChange={setQuery}
        label={`Search ${kind === "READING" ? "Reading" : "Listening"} tests`}
        placeholder={`Search by title, topic, ${kind === "READING" ? "passage" : "part"} or question type…`}
      />
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        <button type="button" aria-pressed={difficulty === "all"} onClick={() => setDifficulty("all")} className={cn(chip, difficulty === "all" ? chipOn : chipOff)}>
          Any level
        </button>
        {DIFFICULTIES.map((d) => (
          <button key={d} type="button" aria-pressed={difficulty === d} onClick={() => setDifficulty(difficulty === d ? "all" : d)} className={cn(chip, difficulty === d ? chipOn : chipOff)}>
            {d}
          </button>
        ))}
        {fullCount > 0 && fullCount < items.length && (
          <button type="button" aria-pressed={fullOnly} onClick={() => setFullOnly(!fullOnly)} className={cn(chip, fullOnly ? chipOn : chipOff)}>
            <Layers className="h-3.5 w-3.5" aria-hidden /> Full exam papers only
          </button>
        )}
        {qtypes.length > 1 && (
          <select aria-label="Question type" value={qtype} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setQtype(e.target.value as GroupKind | "all")} className={selectCls}>
            <option value="all">All question types</option>
            {qtypes.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        )}
        {sources.length > 1 && (
          <select aria-label="Source" value={source} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSource(e.target.value as ExamSource | "all")} className={selectCls}>
            <option value="all">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        )}
      </div>
      <ResultCount shown={Math.min(limit, filtered.length)} total={filtered.length} all={items.length} />
      {filtered.length === 0 ? (
        <NoMatches onReset={reset} />
      ) : (
        <ul role="list" className="space-y-2">
          {filtered.slice(0, limit).map((i) => (
            <PickRow key={i.id} onPick={() => onPick(i)}>
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-semibold leading-snug text-white">{i.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {i.questions} questions · {kind === "LISTENING" ? "~" : ""}
                    {i.minutes} min{i.parts.length > 1 ? ` · ${i.parts.length} ${noun}` : ""}
                  </span>
                </span>
                {i.full && (
                  <span className="shrink-0 rounded-full border border-averna-neon/30 bg-averna-neon/10 px-2 py-0.5 text-[11px] font-medium text-averna-neon">
                    Full test
                  </span>
                )}
              </span>
              <span className="mt-2 flex flex-wrap items-center gap-1.5">
                <DifficultyBadge difficulty={i.difficulty} />
                <SourceBadge source={i.source} />
                {kindLabels(i.kinds)
                  .slice(0, 3)
                  .map((l) => (
                    <span key={l} className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-gray-300">
                      {l}
                    </span>
                  ))}
              </span>
              {i.description && <span className="mt-2 line-clamp-1 block text-xs text-gray-400">{i.description}</span>}
            </PickRow>
          ))}
        </ul>
      )}
      <ShowMore shown={limit} total={filtered.length} onMore={() => setLimit((l: number) => l + PAGE)} />
    </div>
  );
}

function SelectedObjective({
  kind,
  item,
  part,
  onPart,
  onClear,
}: {
  kind: ObjectiveKind;
  item: LibraryObjective;
  part: number | null;
  onPart: (p: number | null) => void;
  onClear: () => void;
}) {
  const options = scopeOptions(kind, item);
  return (
    <SelectedShell kind={kind} title={item.title} onClear={onClear} clearLabel="Change test">
      <div className="mt-3 flex flex-wrap gap-1.5">
        <DifficultyBadge difficulty={item.difficulty} />
        <SourceBadge source={item.source} />
      </div>
      {item.kinds.length > 0 && (
        <p className="mt-2 text-xs text-gray-400">
          <span className="text-gray-500">Question types in this test: </span>
          {kindLabels(item.kinds).join(" · ")}
        </p>
      )}
      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-medium text-white">
          {options.length > 1 ? `The whole test or one ${kind === "READING" ? "passage" : "part"}?` : "Scope"}
        </legend>
        <div className="space-y-2">
          {options.map((o) => {
            const on = o.part === part;
            return (
              <label
                key={o.part ?? "full"}
                className={cn(
                  "flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-averna-neon",
                  on ? "border-averna-neon/50 bg-averna-neon/[0.07]" : "border-white/10 bg-white/[0.02] hover:border-white/25"
                )}
              >
                <input
                  type="radio"
                  name={`scope-${item.id}`}
                  checked={on}
                  onChange={() => onPart(o.part)}
                  className="h-4 w-4 shrink-0 accent-[#00FF94]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">
                    {o.label}
                    {o.title && <span className="font-normal text-gray-300"> · {o.title}</span>}
                  </span>
                  <span className="block text-xs text-gray-400">
                    {[o.range, scopeFacts(kind, o)].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </SelectedShell>
  );
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

function writingText(i: LibraryWriting): string {
  return [i.title, i.type, i.excerpt].join(" ").toLowerCase();
}

function WritingBrowser({ task, items, onPick }: { task: "task1" | "task2"; items: LibraryWriting[]; onPick: (i: LibraryWriting) => void }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("all");
  const [limit, setLimit] = useState(PAGE);
  const deferred = useDeferredValue(query);
  const haystacks = useMemo(() => new Map(items.map((i) => [i.id, writingText(i)] as [string, string])), [items]);
  const types = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items) if (i.type) counts.set(i.type, (counts.get(i.type) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([t]) => t);
  }, [items]);
  const filtered = useMemo(
    () =>
      items.filter(
        (i) => (type === "all" || i.type === type) && (!deferred.trim() || matchesQuery(haystacks.get(i.id) ?? "", deferred))
      ),
    [items, type, deferred, haystacks]
  );
  useEffect(() => setLimit(PAGE), [type, deferred]);
  const label = task === "task1" ? "Task 1" : "Task 2";

  if (!items.length) {
    return <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-400">No Writing {label} prompts in the library yet.</p>;
  }

  return (
    <div className="space-y-3">
      <SearchBox value={query} onChange={setQuery} label={`Search Writing ${label} prompts`} placeholder={`Search ${label} prompts by title, type or wording…`} />
      {types.length > 1 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Task type">
          <button type="button" aria-pressed={type === "all"} onClick={() => setType("all")} className={cn(chip, type === "all" ? chipOn : chipOff)}>
            All types
          </button>
          {types.slice(0, 8).map((t) => (
            <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(type === t ? "all" : t)} className={cn(chip, type === t ? chipOn : chipOff)}>
              {t}
            </button>
          ))}
          {types.length > 8 && (
            <select aria-label="More task types" value={types.slice(0, 8).includes(type) ? "all" : type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setType(e.target.value)} className={selectCls}>
              <option value="all">More types…</option>
              {types.slice(8).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      <ResultCount shown={Math.min(limit, filtered.length)} total={filtered.length} all={items.length} />
      {filtered.length === 0 ? (
        <NoMatches
          onReset={() => {
            setQuery("");
            setType("all");
          }}
        />
      ) : (
        <ul role="list" className="space-y-2">
          {filtered.slice(0, limit).map((i) => (
            <PickRow key={i.id} onPick={() => onPick(i)}>
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold leading-snug text-white">{i.title}</span>
                {i.type && <span className="rounded-full border border-averna-pink/30 bg-averna-pink/10 px-2 py-0.5 text-[11px] text-averna-pink">{i.type}</span>}
                {i.visual && <span className="text-[11px] text-gray-500">with chart</span>}
              </span>
              <span className="mt-1.5 line-clamp-2 block text-xs leading-relaxed text-gray-400">{i.excerpt}</span>
            </PickRow>
          ))}
        </ul>
      )}
      <ShowMore shown={limit} total={filtered.length} onMore={() => setLimit((l: number) => l + PAGE)} />
    </div>
  );
}

function WritingSummary({ task, item }: { task: "task1" | "task2"; item: LibraryWriting }) {
  const spec = WRITING_TASK[task];
  return (
    <>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-400">
        {item.type && <span className="rounded-full border border-averna-pink/30 bg-averna-pink/10 px-2 py-0.5 text-averna-pink">{item.type}</span>}
        <span>
          {spec.words}+ words · {spec.minutes} min
        </span>
      </p>
      <p className="mt-2 text-sm leading-relaxed text-gray-300">{item.excerpt}</p>
    </>
  );
}

function SelectedWriting({ task, item, onClear }: { task: "task1" | "task2"; item: LibraryWriting; onClear: () => void }) {
  return (
    <SelectedShell kind={task === "task1" ? "WRITING_TASK1" : "WRITING_TASK2"} title={item.title} onClear={onClear} clearLabel="Change task">
      <WritingSummary task={task} item={item} />
    </SelectedShell>
  );
}

function WritingExamPicker({
  library,
  task1,
  task2,
  onChange,
}: {
  library: HomeworkLibrary;
  task1: LibraryWriting | null;
  task2: LibraryWriting | null;
  onChange: (t1: LibraryWriting | null, t2: LibraryWriting | null) => void;
}) {
  const [slot, setSlot] = useState<"task1" | "task2">(task1 && !task2 ? "task2" : "task1");
  const pick = (t: "task1" | "task2", item: LibraryWriting | null) => {
    if (t === "task1") {
      onChange(item, task2);
      if (item && !task2) setSlot("task2");
    } else {
      onChange(task1, item);
      if (item && !task1) setSlot("task1");
    }
  };
  const tabs: { key: "task1" | "task2"; label: string; item: LibraryWriting | null }[] = [
    { key: "task1", label: "Task 1", item: task1 },
    { key: "task2", label: "Task 2", item: task2 },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Writing test tasks">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={slot === t.key}
            onClick={() => setSlot(t.key)}
            className={cn(
              "flex min-h-[56px] items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon",
              slot === t.key ? "border-averna-pink/60 bg-averna-pink/[0.07]" : "border-white/10 bg-white/[0.02] hover:border-white/25"
            )}
          >
            {t.item ? <CheckCircle2 className="h-5 w-5 shrink-0 text-averna-neon" aria-hidden /> : <PenLine className="h-5 w-5 shrink-0 text-gray-500" aria-hidden />}
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">{t.label}</span>
              <span className="block truncate text-xs text-gray-400">{t.item ? t.item.title : "Not chosen yet"}</span>
            </span>
          </button>
        ))}
      </div>
      {(() => {
        const current = slot === "task1" ? task1 : task2;
        const items = slot === "task1" ? library.task1 : library.task2;
        if (current) {
          return (
            <SelectedShell kind="WRITING_EXAM" title={`${slot === "task1" ? "Task 1" : "Task 2"}: ${current.title}`} onClear={() => pick(slot, null)} clearLabel="Change">
              <WritingSummary task={slot} item={current} />
            </SelectedShell>
          );
        }
        return <WritingBrowser key={slot} task={slot} items={items} onPick={(i) => pick(slot, i)} />;
      })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Speaking
// ---------------------------------------------------------------------------

function SpeakingBrowser({ items, onPick }: { items: LibrarySpeaking[]; onPick: (i: LibrarySpeaking) => void }) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const deferred = useDeferredValue(query);
  const haystacks = useMemo(
    () => new Map(items.map((i) => [i.id, [i.title, i.cue, ...i.topics, SOURCE_LABEL[i.source]].join(" ").toLowerCase()] as [string, string])),
    [items]
  );
  const filtered = useMemo(
    () => items.filter((i) => !deferred.trim() || matchesQuery(haystacks.get(i.id) ?? "", deferred)),
    [items, deferred, haystacks]
  );
  useEffect(() => setLimit(PAGE), [deferred]);

  if (!items.length) {
    return <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-400">No Speaking sets in the library yet.</p>;
  }
  return (
    <div className="space-y-3">
      <SearchBox value={query} onChange={setQuery} label="Search Speaking sets" placeholder="Search by title, Part 1 topic or cue card…" />
      <ResultCount shown={Math.min(limit, filtered.length)} total={filtered.length} all={items.length} />
      {filtered.length === 0 ? (
        <NoMatches onReset={() => setQuery("")} />
      ) : (
        <ul role="list" className="space-y-2">
          {filtered.slice(0, limit).map((i) => (
            <PickRow key={i.id} onPick={() => onPick(i)}>
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold leading-snug text-white">{i.title}</span>
                <SourceBadge source={i.source} />
              </span>
              {i.topics.length > 0 && <span className="mt-1.5 block text-xs text-gray-400">Part 1: {i.topics.join(" · ")}</span>}
              {i.cue && <span className="mt-1 line-clamp-2 block text-xs text-gray-300">Part 2: {i.cue}</span>}
            </PickRow>
          ))}
        </ul>
      )}
      <ShowMore shown={limit} total={filtered.length} onMore={() => setLimit((l: number) => l + PAGE)} />
    </div>
  );
}

function SelectedSpeaking({ item, onClear }: { item: LibrarySpeaking; onClear: () => void }) {
  return (
    <SelectedShell kind="SPEAKING" title={item.title} onClear={onClear} clearLabel="Change set">
      <p className="mt-3 text-xs text-gray-400">Parts 1–3 · {SPEAKING_MINUTES} min · recorded answers</p>
      {item.topics.length > 0 && <p className="mt-2 text-sm text-gray-300">Part 1: {item.topics.join(" · ")}</p>}
      {item.cue && <p className="mt-1 text-sm text-gray-300">Part 2 cue card: {item.cue}</p>}
    </SelectedShell>
  );
}

// ---------------------------------------------------------------------------
// "What students will get"
// ---------------------------------------------------------------------------

export function SelectionPreview({ selection }: { selection: LibrarySelection }) {
  const info = EXAM_KIND_INFO[selection.kind];
  let heading = info.label;
  let what = "";
  let facts: string[] = [];
  switch (selection.kind) {
    case "READING":
    case "LISTENING": {
      const o = scopeOptions(selection.kind, selection.item).find((x) => x.part === selection.part) ?? scopeOptions(selection.kind, selection.item)[0];
      heading = `${info.label} · ${o.label}`;
      what = o.title ? `“${o.title}” from ${selection.item.title}` : selection.item.title;
      facts = [o.range ?? "", scopeFacts(selection.kind, o), selection.item.difficulty].filter(Boolean);
      break;
    }
    case "WRITING_TASK1":
    case "WRITING_TASK2": {
      const spec = WRITING_TASK[selection.kind === "WRITING_TASK1" ? "task1" : "task2"];
      what = selection.item.title;
      facts = [selection.item.type, `${spec.words}+ words`, `${spec.minutes} min`].filter(Boolean);
      break;
    }
    case "WRITING_EXAM":
      what = `${selection.task1?.title ?? "Task 1"} + ${selection.task2?.title ?? "Task 2"}`;
      facts = [`Task 1: ${WRITING_TASK.task1.words}+ words`, `Task 2: ${WRITING_TASK.task2.words}+ words`, `${WRITING_TASK.examMinutes} min`];
      break;
    case "SPEAKING":
      what = selection.item.title;
      facts = ["Parts 1–3", `${SPEAKING_MINUTES} min`];
      break;
  }
  const how =
    info.graded === "auto"
      ? "Students open it from their Homework page and take it in the exam runner. It is marked the moment they submit — you get every student's band plus class statistics for each question."
      : info.skill === "SPEAKING"
        ? "Students open it from their Homework page and record their answers. They get an AI band estimate straight away; you review each attempt from your review queue."
        : "Students open it from their Homework page and write in the exam editor (timer and word count). They get an AI band estimate straight away; you review each essay from your review queue.";
  return (
    <section aria-label="What students will get" className="rounded-2xl border border-averna-neon/25 bg-averna-neon/[0.04] p-4 sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-averna-neon">What students will get</p>
      <div className="mt-2 flex items-start gap-3">
        <KindIcon kind={selection.kind} />
        <div className="min-w-0">
          <p className="font-semibold text-white">{heading}</p>
          <p className="text-sm text-gray-300">{what}</p>
          <p className="mt-1 text-xs text-gray-400">{facts.join(" · ")}</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-gray-400">
        {how} Only the first real attempt counts — a blank or very short one leaves the homework open.
      </p>
    </section>
  );
}
