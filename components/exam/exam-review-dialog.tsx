"use client";
import { useEffect, useRef } from "react";
import { Flag, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExamPartNav } from "./exam-shell";

export function ReviewDialog({
  parts,
  answered,
  flagged,
  onClose,
  onConfirm,
  onJump,
  submitting,
  submitLabel,
  description,
}: {
  parts: ExamPartNav[];
  answered: Set<number>;
  flagged: Set<number>;
  onClose: () => void;
  onConfirm: () => void;
  onJump: (n: number) => void;
  submitting?: boolean;
  submitLabel: string;
  description?: React.ReactNode;
}) {
  const all = parts.flatMap((p) => p.numbers);
  const unanswered = all.filter((n) => !answered.has(n));
  const flaggedList = all.filter((n) => flagged.has(n));
  const dialogRef = useRef<HTMLDivElement>(null);
  // The exam clock re-renders the shell every second, so `onClose` is a new
  // function on every render. Keep it in a ref: the effect below must run only
  // when the dialog opens (mount) and closes (unmount) — never pull focus back
  // to "Keep Working" while the student is tabbing through the dialog.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const node = dialogRef.current;
    const active = document.activeElement;
    const opener = active instanceof HTMLElement && active !== document.body ? active : null;
    node?.querySelector<HTMLElement>("button[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // Closed: give focus back to whatever opened the dialog, unless the close
      // already moved it on purpose (e.g. jumping to a question).
      const now = document.activeElement;
      if (opener?.isConnected && (!now || now === document.body || node?.contains(now))) {
        opener.focus({ preventScroll: true });
      }
    };
  }, []);

  const chip = (n: number, tone: "gray" | "amber") => (
    <button
      key={n}
      type="button"
      onClick={() => onJump(n)}
      className={cn(
        "h-11 min-w-[2.75rem] rounded-lg border px-2 text-sm font-semibold transition hover:border-averna-neon/60",
        tone === "amber" ? "border-amber-300/50 bg-amber-400/10 text-amber-200" : "border-white/15 bg-white/[0.04] text-gray-200"
      )}
    >
      {n}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 py-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        onClick={(e) => e.stopPropagation()}
        className="av-modal-panel av-panel max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="review-title" className="text-lg font-bold text-white">
            Ready to submit?
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-300">
          {description ?? <>You answered <span className="font-semibold text-white">{all.length - unanswered.length}</span> of {all.length} questions.
          Blank answers score zero — it&apos;s always worth a guess.</>}
        </p>
        {unanswered.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Unanswered</p>
            <div className="flex max-h-[45vh] flex-wrap gap-1.5 overflow-y-auto">{unanswered.map((n) => chip(n, "gray"))}</div>
          </div>
        )}
        {flaggedList.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <Flag className="h-3.5 w-3.5 text-amber-300" aria-hidden /> Flagged for review
            </p>
            <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">{flaggedList.map((n) => chip(n, "amber"))}</div>
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            data-autofocus
            className="min-h-[44px] rounded-xl border border-white/15 px-4 text-sm font-semibold text-gray-200 hover:bg-white/5"
          >
            Keep Working
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="glow-cta inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-averna-primary px-5 text-sm font-semibold text-white hover:bg-averna-light disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

