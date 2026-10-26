"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Loader2, PenLine, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  BAND_OPTIONS,
  criteriaBand,
  criteriaComplete,
  criteriaFor,
  formatBand,
  toHalfBand,
  type CriterionKey,
  type ReviewCriteria,
  type ReviewSkill,
  type WritingTask,
} from "@/lib/review/scoring";
import { composeComment, parseSteps, type ReviewDraft } from "@/lib/review/draft-shared";
import { queueHref, reviewHref, type QueueFilters } from "@/lib/review/filters";

/**
 * One-tap approval of an AI-drafted review (idea 10). The draft — bands per
 * criterion, 2–4 sentences of feedback, 1–3 next steps — is shown read-only
 * under a clear "AI draft — check before approving" label.
 *
 *   Approve     saves it exactly like the manual form (same API path), then
 *               opens the next pending attempt with "Approved · Undo" (~6 s).
 *   Edit        every field inline, then Save (same save + undo).
 *   Regenerate  new words for the same bands (rate-limited on the server).
 *
 * Keys (desktop, never while typing in a field): A approve · E edit ·
 * J / K next / previous attempt in the queue.
 */

export interface AiDraftReviewProps {
  testId: string;
  skill: ReviewSkill;
  taskType: WritingTask | null;
  studentName: string;
  aiBand: number | null;
  draft: ReviewDraft;
  /** No feedback text is stored and an AI draft can be made: ask for one on open. */
  generateOnOpen: boolean;
  /** An AI key is configured (Regenerate is offered). */
  aiAvailable: boolean;
  filters: QueueFilters;
  nav: { prev: string | null; next: string | null; position: number | null; total: number };
}

type Values = Partial<Record<CriterionKey, string>>;
const bandValue = (b: number | null | undefined) => (typeof b === "number" && Number.isFinite(b) ? b.toFixed(1) : "");
const UNDO_MS = 6000;

const BTN =
  "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 disabled:cursor-not-allowed disabled:opacity-50";
const SELECT =
  "h-11 rounded-lg border border-white/15 bg-averna-dark/70 px-2.5 text-sm font-semibold tabular-nums text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60";
const FIELD =
  "mt-1.5 w-full resize-y rounded-xl border border-white/15 bg-averna-dark/60 px-3 py-2.5 text-sm leading-relaxed text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60";

const SOURCE_NOTE: Record<ReviewDraft["source"], string> = {
  stored: "From the AI examiner's assessment of this attempt.",
  ai: "Drafted by AI for you from this attempt.",
  heuristic: "From the automatic estimate (no AI examiner was available) — check it carefully.",
  none: "No feedback was stored for this attempt — write a few lines yourself.",
};

/** Typing in a field (or using a modifier) never triggers a shortcut. */
function isTyping(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  // An open dialog (e.g. the mini-task sheet) owns the keyboard.
  if (document.querySelector('[role="dialog"][aria-modal="true"]')) return true;
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function AiDraftReview({ testId, skill, taskType, studentName, aiBand, draft: initial, generateOnOpen, aiAvailable, filters, nav }: AiDraftReviewProps) {
  const router = useRouter();
  const defs = useMemo(() => criteriaFor(skill, taskType), [skill, taskType]);
  const [draft, setDraft] = useState<ReviewDraft>(initial);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [values, setValues] = useState<Values>({});
  const [override, setOverride] = useState<string>("");
  const [feedback, setFeedback] = useState("");
  const [steps, setSteps] = useState("");
  const [busy, setBusy] = useState<null | "approve" | "regenerate" | "generate">(generateOnOpen ? "generate" : null);
  const [error, setError] = useState("");
  const feedbackRef = useRef<HTMLTextAreaElement>(null);
  const idp = `draft-${testId}`;

  // First open of an attempt with no stored feedback: one AI draft (kept on the attempt).
  useEffect(() => {
    if (!generateOnOpen) return;
    let alive = true;
    fetch(`/api/teacher/reviews/${encodeURIComponent(testId)}/draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as { draft?: ReviewDraft } | null;
        if (alive && res.ok && data?.draft) setDraft(data.draft);
      })
      .catch(() => undefined)
      .finally(() => alive && setBusy((b) => (b === "generate" ? null : b)));
    return () => {
      alive = false;
    };
  }, [generateOnOpen, testId]);

  const complete = criteriaComplete(skill, draft.criteria);
  const band = draft.band ?? criteriaBand(skill, draft.criteria);
  const canApprove = complete && band !== null && !busy;

  const startEdit = useCallback(() => {
    const v: Values = {};
    for (const d of defs) v[d.key] = bandValue(draft.criteria[d.key]);
    setValues(v);
    const avg = criteriaBand(skill, draft.criteria);
    setOverride(band !== null && band !== avg ? bandValue(band) : "");
    setFeedback(draft.feedback);
    setSteps(draft.nextSteps.join("\n"));
    setError("");
    setMode("edit");
    window.setTimeout(() => feedbackRef.current?.focus(), 0);
  }, [band, defs, draft, skill]);

  const go = useCallback(
    (id: string | null) => {
      if (!id) return;
      router.push(reviewHref(id, { ...filters, tab: "pending", page: 1 }));
    },
    [filters, router]
  );

  const save = useCallback(
    async (payload: { band: number; criteria: ReviewCriteria; comment: string }, verb: "Approved" | "Saved") => {
      setBusy("approve");
      setError("");
      try {
        const res = await fetch(`/api/teacher/reviews/${encodeURIComponent(testId)}/approve`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, queue: { group: filters.group, skill: filters.skill, source: filters.source, days: filters.days } }),
        });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; next?: string | null; undo?: string | null } | null;
        if (!res.ok || !data?.ok) throw new Error(data?.error || "The review couldn't be saved. Please try again.");
        const target = data.next ? reviewHref(data.next, { ...filters, tab: "pending", page: 1 }) : queueHref({ ...filters, tab: "pending", page: 1 });
        const undoToken = data.undo ?? null;
        const back = reviewHref(testId, { ...filters, tab: "pending", page: 1 });
        toast.success(
          `${verb} · ${studentName}, band ${formatBand(payload.band)}${data.next ? "" : " — nothing else is waiting"}`,
          undoToken
            ? {
                duration: UNDO_MS,
                action: {
                  label: "Undo",
                  onClick: () => {
                    void fetch(`/api/teacher/reviews/${encodeURIComponent(testId)}/undo`, {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ token: undoToken }),
                    })
                      .then(async (r) => {
                        const d = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
                        if (!r.ok || !d?.ok) throw new Error(d?.error || "Undo didn't work — open the review to change it.");
                        toast.info(`Undone — ${studentName}'s attempt is back as it was.`);
                        router.push(back);
                        router.refresh();
                      })
                      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Undo didn't work."));
                  },
                },
              }
            : undefined
        );
        router.push(target);
        router.refresh();
      } catch (e) {
        setBusy(null);
        setError(e instanceof Error ? e.message : "The review couldn't be saved. Please try again.");
      }
    },
    [filters, router, studentName, testId]
  );

  const approve = useCallback(() => {
    if (!canApprove || band === null) return;
    void save({ band, criteria: draft.criteria, comment: composeComment(draft.feedback, draft.nextSteps) }, "Approved");
  }, [band, canApprove, draft, save]);

  function saveEdit() {
    const criteria: ReviewCriteria = {};
    for (const d of defs) criteria[d.key] = toHalfBand(values[d.key]);
    if (!criteriaComplete(skill, criteria)) {
      setError("Give a band for every criterion first.");
      return;
    }
    const b = override ? toHalfBand(override) : criteriaBand(skill, criteria);
    if (b === null) {
      setError("Choose the overall band.");
      return;
    }
    const nextSteps = parseSteps(steps);
    setDraft({ ...draft, band: b, criteria, feedback: feedback.trim(), nextSteps });
    void save({ band: b, criteria, comment: composeComment(feedback, nextSteps) }, "Saved");
  }

  async function regenerate() {
    if (busy) return;
    setBusy("regenerate");
    setError("");
    try {
      const res = await fetch(`/api/teacher/reviews/${encodeURIComponent(testId)}/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ regenerate: true }),
      });
      const data = (await res.json().catch(() => null)) as { draft?: ReviewDraft; error?: string } | null;
      if (!res.ok || !data?.draft) throw new Error(data?.error || "A new draft didn't come through.");
      setDraft(data.draft);
      setMode("view");
    } catch (e) {
      setError(e instanceof Error ? e.message : "A new draft didn't come through.");
    } finally {
      setBusy(null);
    }
  }

  // Keyboard: A approve · E edit · J / K next / previous (never while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTyping(e)) return;
      const k = e.key.toLowerCase();
      if (k === "j" && nav.next) {
        e.preventDefault();
        go(nav.next);
      } else if (k === "k" && nav.prev) {
        e.preventDefault();
        go(nav.prev);
      } else if (mode === "view" && k === "a" && canApprove) {
        e.preventDefault();
        approve();
      } else if (mode === "view" && k === "e" && !busy) {
        e.preventDefault();
        startEdit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [approve, busy, canApprove, go, mode, nav.next, nav.prev, startEdit]);

  const noText = !draft.feedback.trim();
  const average = (() => {
    const c: ReviewCriteria = {};
    for (const d of defs) c[d.key] = toHalfBand(values[d.key]);
    return criteriaBand(skill, c);
  })();

  return (
    <section aria-labelledby={`${idp}-title`} aria-busy={!!busy} className="glass rounded-2xl border border-averna-neon/25 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold text-amber-200">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            AI draft — check before approving
          </p>
          <h2 id={`${idp}-title`} className="mt-2 text-lg font-semibold text-white">
            {mode === "edit" ? "Edit the review" : "Your review"}
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">{SOURCE_NOTE[draft.source]}</p>
        </div>
        <div className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Band</p>
          <p className="text-2xl font-bold tabular-nums text-white">{formatBand(mode === "edit" ? (override ? toHalfBand(override) : average) : band)}</p>
        </div>
      </div>

      {busy === "generate" && (
        <p role="status" className="mt-4 flex items-center gap-2 text-sm text-gray-300">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
          Drafting feedback from {studentName}&apos;s work…
        </p>
      )}

      {mode === "view" ? (
        <>
          <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {defs.map((d) => {
              const v = draft.criteria[d.key];
              return (
                <div key={d.key} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
                  <dt className="text-sm text-gray-300">{d.label}</dt>
                  <dd className="shrink-0 text-base font-semibold tabular-nums text-white">
                    {typeof v === "number" ? formatBand(v) : d.optional ? <span className="text-xs font-normal text-gray-400">Not rated</span> : "—"}
                  </dd>
                </div>
              );
            })}
          </dl>

          <div className="mt-4">
            <h3 className="text-sm font-semibold text-white">Feedback</h3>
            {noText ? (
              <p className="mt-1 text-sm text-gray-400">
                {skill === "SPEAKING" ? "No feedback text yet — listen to the answers, then write a few lines." : "No feedback text yet — add a few lines."}
              </p>
            ) : (
              <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-gray-200">{draft.feedback}</p>
            )}
          </div>
          {draft.nextSteps.length > 0 && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-white">Next steps</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-200">
                {draft.nextSteps.map((s, i) => (
                  <li key={i} className="break-words">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!complete && (
            <p className="mt-3 text-sm text-amber-200">The AI didn&apos;t rate every criterion — use Edit to give the missing bands.</p>
          )}

          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={noText && skill === "SPEAKING" ? startEdit : approve}
              disabled={noText && skill === "SPEAKING" ? !!busy : !canApprove}
              aria-keyshortcuts={noText && skill === "SPEAKING" ? "E" : "A"}
              className={cn(BTN, "glow-cta bg-averna-primary text-white hover:bg-averna-light sm:col-span-3")}
            >
              {busy === "approve" ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
              ) : noText && skill === "SPEAKING" ? (
                <PenLine className="h-4 w-4" aria-hidden />
              ) : (
                <Check className="h-4 w-4" aria-hidden />
              )}
              {busy === "approve" ? "Saving…" : noText && skill === "SPEAKING" ? "Write feedback" : `Approve${band !== null ? ` band ${formatBand(band)}` : ""}`}
            </button>
            {noText && skill === "SPEAKING" ? (
              <button type="button" onClick={approve} disabled={!canApprove} className={cn(BTN, "border border-white/15 text-gray-100 hover:text-white")}>
                <Check className="h-4 w-4" aria-hidden /> Approve bands only
              </button>
            ) : (
              <button type="button" onClick={startEdit} disabled={!!busy} aria-keyshortcuts="E" className={cn(BTN, "border border-white/15 text-gray-100 hover:text-white")}>
                <PenLine className="h-4 w-4" aria-hidden /> Edit
              </button>
            )}
            {aiAvailable && (
              <button type="button" onClick={() => void regenerate()} disabled={!!busy} className={cn(BTN, "border border-white/15 text-gray-100 hover:text-white")}>
                {busy === "regenerate" ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
                Regenerate
              </button>
            )}
          </div>
        </>
      ) : (
        <form
          className="mt-4 space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            saveEdit();
          }}
        >
          <fieldset className="space-y-2" disabled={!!busy}>
            <legend className="text-xs font-semibold uppercase tracking-wider text-gray-400">Criteria</legend>
            {defs.map((d) => {
              const id = `${idp}-${d.key}`;
              return (
                <div key={d.key} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
                  <label htmlFor={id} className="min-w-0 text-sm font-medium text-gray-100">
                    {d.label}
                    {d.optional && <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>}
                  </label>
                  <select
                    id={id}
                    value={values[d.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [d.key]: e.target.value }))}
                    className={cn(SELECT, "w-[5.5rem] shrink-0")}
                  >
                    <option value="" className="bg-averna-dark">
                      {d.optional ? "Not rated" : "—"}
                    </option>
                    {BAND_OPTIONS.map((b) => (
                      <option key={b} value={bandValue(b)} className="bg-averna-dark">
                        {formatBand(b)}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-averna-neon/20 bg-averna-neon/[0.04] px-3 py-2">
              <label htmlFor={`${idp}-band`} className="text-sm font-semibold text-white">
                Overall band
              </label>
              <select id={`${idp}-band`} value={override} onChange={(e) => setOverride(e.target.value)} className={cn(SELECT, "w-[7.5rem] shrink-0")}>
                <option value="" className="bg-averna-dark">
                  Average {average !== null ? `(${formatBand(average)})` : ""}
                </option>
                {BAND_OPTIONS.map((b) => (
                  <option key={b} value={bandValue(b)} className="bg-averna-dark">
                    {formatBand(b)}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>

          <div>
            <label htmlFor={`${idp}-feedback`} className="text-sm font-semibold text-white">
              Feedback for {studentName}
            </label>
            <textarea
              id={`${idp}-feedback`}
              ref={feedbackRef}
              value={feedback}
              rows={5}
              maxLength={3000}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What went well, and the one thing to fix first."
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor={`${idp}-steps`} className="text-sm font-semibold text-white">
              Next steps <span className="text-xs font-normal text-gray-400">(one per line)</span>
            </label>
            <textarea id={`${idp}-steps`} value={steps} rows={3} maxLength={800} onChange={(e) => setSteps(e.target.value)} className={FIELD} />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="submit" disabled={!!busy} className={cn(BTN, "bg-averna-primary text-white hover:bg-averna-light")}>
              {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
              {busy === "approve" ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setMode("view")} disabled={!!busy} className={cn(BTN, "border border-white/15 text-gray-100 hover:text-white")}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => go(nav.prev)} disabled={!nav.prev} aria-keyshortcuts="K" className={cn(BTN, "px-3 text-gray-200 hover:bg-white/5")}>
            <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
          </button>
          <button type="button" onClick={() => go(nav.next)} disabled={!nav.next} aria-keyshortcuts="J" className={cn(BTN, "px-3 text-gray-200 hover:bg-white/5")}>
            Next <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {nav.position !== null && nav.total > 0 && (
          <p className="text-xs text-gray-400">
            {nav.position} of {nav.total} waiting
          </p>
        )}
      </div>
      <p className="mt-2 hidden text-xs text-gray-400 lg:block">
        Keys: <kbd className="font-semibold text-gray-200">A</kbd> approve · <kbd className="font-semibold text-gray-200">E</kbd> edit ·{" "}
        <kbd className="font-semibold text-gray-200">J</kbd> / <kbd className="font-semibold text-gray-200">K</kbd> next / previous
      </p>
      <p className="sr-only" aria-live="polite">
        {busy === "approve" ? "Saving the review…" : ""}
      </p>
      {aiBand !== null && <span className="sr-only">The AI examiner&apos;s band was {formatBand(aiBand)}.</span>}
    </section>
  );
}
