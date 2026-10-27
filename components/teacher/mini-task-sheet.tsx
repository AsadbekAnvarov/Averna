"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertCircle, CalendarClock, Loader2, Target, X } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { MiniTask } from "@/lib/teacher/mini-task";

/**
 * The one-button mini task's preview sheet (idea 10): what will be set and
 * why ("Matching headings · 1 part · ~8 min · due tomorrow"), an editable
 * title and due date, then "Assign" — a homework for this one student, made by
 * the normal homework path. A bottom sheet on phones, a dialog from `sm` up.
 */

const BTN =
  "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 disabled:cursor-not-allowed disabled:opacity-60";
const FIELD =
  "mt-1 h-11 w-full rounded-lg border border-white/15 bg-averna-dark/60 px-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60";

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** "tomorrow" for the suggested day, otherwise "Tue 4 Nov". */
function dueLabel(due: string, suggested: string): string {
  const day = due.slice(0, 10);
  if (day === suggested.slice(0, 10)) return "tomorrow";
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export interface MiniTaskSheetProps {
  studentId: string;
  studentName: string;
  open: boolean;
  onClose: () => void;
  onAssigned?: (homeworkId: string | null) => void;
}

export function MiniTaskSheet({ studentId, studentName, open, onClose, onAssigned }: MiniTaskSheetProps) {
  const titleId = useId();
  const fieldId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [task, setTask] = useState<MiniTask | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setState("loading");
    setError("");
    fetch(`/api/teacher/mini-task?studentId=${encodeURIComponent(studentId)}`, { headers: { accept: "application/json" } })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as { task?: MiniTask | null; error?: string } | null;
        if (!alive) return;
        if (!res.ok) {
          setState("error");
          setError(data?.error || "The mini task couldn't be prepared.");
          return;
        }
        const t = data?.task ?? null;
        setTask(t);
        setTitle(t?.title ?? "");
        setDue(t?.dueDate ?? "");
        setState(t ? "ready" : "empty");
      })
      .catch(() => {
        if (!alive) return;
        setState("error");
        setError("Connection problem. Try again.");
      });
    return () => {
      alive = false;
    };
  }, [open, studentId]);

  // Focus into the sheet, Escape closes, focus returns to the opener.
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  async function assign() {
    if (!task || busy) return;
    if (!title.trim()) {
      setError("Give the task a title.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/teacher/mini-task", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId,
          contentKind: task.contentKind,
          contentId: task.contentId,
          contentPart: task.contentPart,
          kind: task.kind,
          title: title.trim(),
          dueDate: due,
        }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; homeworkId?: string | null; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error || "The task couldn't be set. Please try again.");
      toast.success(`Mini task set for ${firstName(studentName)} — they've been notified.`);
      onAssigned?.(data.homeworkId ?? null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The task couldn't be set. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      onClick={close}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 p-5 focus:outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="flex min-w-0 items-center gap-2 text-lg font-semibold text-white">
            <Target className="h-5 w-5 shrink-0 text-averna-cyan" aria-hidden />
            <span className="min-w-0 break-words">Mini task for {firstName(studentName)}</span>
          </h2>
          <button type="button" onClick={close} aria-label="Close" className={cn(BTN, "shrink-0 px-2.5 text-gray-300 hover:text-white")}>
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {state === "loading" && (
          <p role="status" className="mt-4 flex items-center gap-2 text-sm text-gray-300">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
            Picking a part from {firstName(studentName)}&apos;s recent mistakes…
          </p>
        )}
        {state === "empty" && (
          <p className="mt-4 text-sm text-gray-300">
            There&apos;s no Reading or Listening part to set right now — the library is empty or unavailable.
          </p>
        )}
        {state === "error" && (
          <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        {state === "ready" && task && (
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void assign();
            }}
          >
            <div className="rounded-xl border border-averna-cyan/25 bg-averna-cyan/[0.06] p-3.5">
              <p className="text-sm font-semibold text-white">
                {task.kindLabel ?? (task.skill === "READING" ? "Reading" : "Listening")} · 1 {task.contentPart == null ? "test" : "part"} · ~{task.minutes} min · due{" "}
                {dueLabel(due, task.dueDate)}
              </p>
              <p className="mt-1 text-sm text-gray-300">{task.reason}</p>
              <p className="mt-1 break-words text-xs text-gray-400">
                {task.testTitle}
                {task.partTitle ? ` · ${task.partTitle}` : ""}
                {task.questions ? ` · ${task.questions} questions` : ""}
                {task.fresh ? "" : " · done before (every part with this type has been)"}
              </p>
            </div>

            <div>
              <label htmlFor={`${fieldId}-title`} className="text-sm font-medium text-gray-200">
                Title
              </label>
              <input
                id={`${fieldId}-title`}
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor={`${fieldId}-due`} className="flex items-center gap-1.5 text-sm font-medium text-gray-200">
                <CalendarClock className="h-4 w-4 text-gray-400" aria-hidden /> Due (Tashkent time)
              </label>
              <input
                id={`${fieldId}-due`}
                type="datetime-local"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className={FIELD}
              />
            </div>

            {error && (
              <p role="alert" className="flex items-start gap-2 text-sm text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={close} className={cn(BTN, "border border-white/15 text-gray-200 hover:text-white")}>
                Cancel
              </button>
              <button type="submit" disabled={busy} className={cn(BTN, "bg-averna-primary text-white hover:bg-averna-light")}>
                {busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />}
                {busy ? "Assigning…" : `Assign to ${firstName(studentName)}`}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Only {firstName(studentName)} gets it: it appears in their homework and Today session, and they&apos;re notified.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

/** A "Mini task" button with its sheet — for the student page and the review page. */
export function MiniTaskButton({ studentId, studentName, className }: { studentId: string; studentName: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-averna-cyan/40 px-3.5 text-sm font-semibold text-averna-cyan transition-colors hover:bg-averna-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-cyan/60",
          className
        )}
      >
        <Target className="h-4 w-4" aria-hidden />
        Mini task
      </button>
      <MiniTaskSheet studentId={studentId} studentName={studentName} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
