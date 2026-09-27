"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Save, Sparkles, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BAND_OPTIONS,
  criteriaBand,
  criteriaComplete,
  criteriaFor,
  formatBand,
  formatBandDelta,
  MAX_COMMENT_CHARS,
  prefillFromAi,
  snapBand,
  toHalfBand,
  type CriterionKey,
  type ReviewCriteria,
  type ReviewSkill,
  type WritingTask,
} from "@/lib/review/scoring";
import { queueHref, reviewHref, type QueueFilters } from "@/lib/review/filters";

export interface ReviewFormProps {
  testId: string;
  skill: ReviewSkill;
  taskType: WritingTask | null;
  studentName: string;
  /** The AI examiner's band and criteria (prefill and "Accept AI band"). */
  aiBand: number | null;
  aiCriteria: ReviewCriteria;
  /** The saved review, when editing one. */
  existing: { band: number; criteria: ReviewCriteria; comment: string | null } | null;
  /** The teacher's queue filters: "next" follows them and the links keep them. */
  filters: QueueFilters;
}

type Values = Partial<Record<CriterionKey, string>>;

const bandValue = (b: number | null | undefined) => (typeof b === "number" && Number.isFinite(b) ? b.toFixed(1) : "");

const SELECT =
  "h-10 rounded-lg border border-white/15 bg-averna-dark/70 px-2.5 text-sm font-semibold tabular-nums text-white " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 disabled:opacity-60";

export function ReviewForm({ testId, skill, taskType, studentName, aiBand, aiCriteria, existing, filters }: ReviewFormProps) {
  const router = useRouter();
  const defs = useMemo(() => criteriaFor(skill, taskType), [skill, taskType]);
  const aiPrefill = useMemo(() => prefillFromAi(skill, aiCriteria), [skill, aiCriteria]);
  const aiSnapped = snapBand(aiBand);

  const initialCriteria = existing?.criteria ?? aiPrefill;
  const [values, setValues] = useState<Values>(() => {
    const v: Values = {};
    for (const d of defs) v[d.key] = bandValue(initialCriteria[d.key]);
    return v;
  });
  // null = the overall band follows the criteria average; a value = the teacher's own band.
  const [override, setOverride] = useState<string | null>(() => {
    if (!existing) return null;
    const avg = criteriaBand(skill, existing.criteria);
    return avg === existing.band ? null : bandValue(existing.band);
  });
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  const criteria: ReviewCriteria = {};
  for (const d of defs) criteria[d.key] = toHalfBand(values[d.key]);
  const average = criteriaBand(skill, criteria);
  const complete = criteriaComplete(skill, criteria);
  const band = override !== null ? toHalfBand(override) : average;
  const saving = status === "saving" || status === "saved";
  const aiComplete = aiSnapped !== null && criteriaComplete(skill, aiPrefill);
  const idp = `review-${testId}`;

  async function save(payload: { band: number; criteria: ReviewCriteria; comment: string }) {
    setStatus("saving");
    setMessage("Saving the review…");
    try {
      const res = await fetch(`/api/teacher/reviews/${encodeURIComponent(testId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...payload,
          queue: { group: filters.group, skill: filters.skill, source: filters.source, days: filters.days },
        }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; next?: string | null } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error || "The review couldn't be saved. Please try again.");
      setStatus("saved");
      const target = data.next
        ? `${reviewHref(data.next, { ...filters, tab: "pending", page: 1 })}`
        : queueHref({ ...filters, tab: "pending", page: 1 });
      setMessage(data.next ? "Review saved. Opening the next attempt…" : "Review saved. Nothing else is waiting — back to the queue…");
      router.push(`${target}${target.includes("?") ? "&" : "?"}saved=1`);
      // Drop cached queue / review pages so every list shows this review.
      router.refresh();
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "The review couldn't be saved. Please try again.");
    }
  }

  function submit() {
    if (saving) return;
    if (!complete) {
      setStatus("error");
      setMessage("Give a band for every criterion first.");
      return;
    }
    if (band === null) {
      setStatus("error");
      setMessage("Choose the overall band.");
      return;
    }
    void save({ band, criteria, comment });
  }

  function acceptAi() {
    if (saving || !aiComplete || aiSnapped === null) return;
    const v: Values = {};
    for (const d of defs) v[d.key] = bandValue(aiPrefill[d.key]);
    setValues(v);
    setOverride(criteriaBand(skill, aiPrefill) === aiSnapped ? null : bandValue(aiSnapped));
    void save({ band: aiSnapped, criteria: aiPrefill, comment });
  }

  const delta = band !== null ? formatBandDelta(band, aiBand) : null;
  const left = MAX_COMMENT_CHARS - comment.length;

  return (
    <form
      aria-labelledby={`${idp}-title`}
      aria-busy={saving}
      noValidate
      onSubmit={(e: React.FormEvent) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          submit();
        }
      }}
      className="glass rounded-2xl border border-averna-neon/25 p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${idp}-title`} className="text-lg font-semibold text-white">
            {existing ? "Edit your review" : "Your review"}
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">
            {studentName} sees your band, criteria and comment on their result page.
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">AI estimate</p>
          <p className="text-lg font-bold tabular-nums text-gray-200">{formatBand(aiBand)}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={acceptAi}
        disabled={saving || !aiComplete}
        aria-describedby={`${idp}-accept-hint`}
        className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-averna-neon/40 bg-averna-neon/[0.07] px-4 text-sm font-semibold text-averna-neon transition-colors hover:bg-averna-neon/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        Accept AI band{aiSnapped !== null ? ` (${formatBand(aiSnapped)})` : ""} and save
      </button>
      <p id={`${idp}-accept-hint`} className="mt-1.5 text-xs text-gray-500">
        {aiComplete
          ? "Saves the AI's criteria and band with your comment, then opens the next attempt."
          : "The AI didn't rate every criterion for this attempt — give the bands yourself."}
      </p>

      <fieldset className="mt-5" disabled={saving}>
        <legend className="text-xs font-semibold uppercase tracking-wider text-gray-400">Criteria</legend>
        <div className="mt-2 space-y-2.5">
          {defs.map((d) => {
            const id = `${idp}-${d.key}`;
            const ai = aiCriteria[d.key];
            return (
              <div key={d.key} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
                <div className="min-w-0">
                  <label htmlFor={id} className="block text-sm font-medium text-gray-100">
                    {d.label}
                    {d.optional && <span className="ml-1 text-xs font-normal text-gray-500">(optional)</span>}
                  </label>
                  <p id={`${id}-ai`} className="text-xs text-gray-500">
                    {typeof ai === "number" ? `AI: ${formatBand(ai)}` : d.key === "pronunciation" ? "The AI can't judge this from a transcript" : "AI: not rated"}
                  </p>
                </div>
                <select
                  id={id}
                  value={values[d.key] ?? ""}
                  aria-describedby={`${id}-ai`}
                  required={!d.optional}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    const next = e.target.value;
                    setValues((v: Values) => ({ ...v, [d.key]: next }));
                    if (status === "error") setStatus("idle");
                  }}
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
        </div>
        {skill === "SPEAKING" && (
          <p className="mt-2 text-xs leading-relaxed text-gray-500">
            Leave Pronunciation unrated if you couldn&apos;t listen to the recording — the band then comes from the other three criteria.
          </p>
        )}
      </fieldset>

      <div className="mt-5 rounded-xl border border-averna-neon/20 bg-averna-neon/[0.04] p-3.5">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={`${idp}-band`} className="text-sm font-semibold text-white">
            Overall band
          </label>
          <select
            id={`${idp}-band`}
            value={override ?? bandValue(average)}
            disabled={saving}
            aria-describedby={`${idp}-band-hint`}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              const next = e.target.value;
              setOverride(next === bandValue(average) ? null : next);
              if (status === "error") setStatus("idle");
            }}
            className={cn(SELECT, "w-[6rem] text-base")}
          >
            <option value="" className="bg-averna-dark">
              —
            </option>
            {BAND_OPTIONS.map((b) => (
              <option key={b} value={bandValue(b)} className="bg-averna-dark">
                {formatBand(b)}
              </option>
            ))}
          </select>
        </div>
        <p id={`${idp}-band-hint`} className="mt-2 text-xs leading-relaxed text-gray-400" aria-live="polite">
          {average === null
            ? "Rate the criteria — the band is their average with IELTS rounding."
            : override === null
              ? `The average of the criteria with IELTS rounding: ${formatBand(average)}.`
              : `You set the band yourself (the criteria average is ${formatBand(average)}).`}
          {delta && band !== null && <span className="text-gray-500"> {delta} against the AI.</span>}
        </p>
        {override !== null && average !== null && (
          <button
            type="button"
            onClick={() => setOverride(null)}
            disabled={saving}
            className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-averna-cyan hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-cyan/60"
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden />
            Use the average ({formatBand(average)})
          </button>
        )}
      </div>

      <div className="mt-5">
        <label htmlFor={`${idp}-comment`} className="text-sm font-semibold text-white">
          Comment for the student <span className="text-xs font-normal text-gray-500">(optional)</span>
        </label>
        <textarea
          id={`${idp}-comment`}
          value={comment}
          maxLength={MAX_COMMENT_CHARS}
          rows={7}
          disabled={saving}
          aria-describedby={`${idp}-comment-count ${idp}-shortcut`}
          placeholder="What went well, what to fix first, and one thing to practise before the next attempt."
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
          className="mt-2 w-full resize-y rounded-xl border border-white/15 bg-averna-dark/60 px-3 py-2.5 text-sm leading-relaxed text-gray-100 placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 disabled:opacity-60"
        />
        <p id={`${idp}-comment-count`} className={cn("mt-1 text-right text-xs tabular-nums", left < 200 ? "text-amber-300" : "text-gray-500")}>
          {comment.length} / {MAX_COMMENT_CHARS}
        </p>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="glow-cta mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-averna-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-averna-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/70 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
        {saving ? "Saving…" : `Save${band !== null ? ` band ${formatBand(band)}` : ""} and open next`}
      </button>
      <p id={`${idp}-shortcut`} className="mt-1.5 text-center text-xs text-gray-500">
        Tip: Ctrl + Enter (⌘ + Enter on a Mac) saves from anywhere in the form.
      </p>

      <div aria-live="polite" role="status" className="min-h-[1.25rem]">
        {message && status !== "error" && (
          <p className="mt-3 flex items-center gap-2 text-sm text-averna-neon">
            {status === "saved" ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> : <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />}
            {message}
          </p>
        )}
      </div>
      {status === "error" && message && (
        <p role="alert" className="mt-1 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {message}
        </p>
      )}
    </form>
  );
}
