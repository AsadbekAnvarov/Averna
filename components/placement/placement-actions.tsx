"use client";

/**
 * Placement test actions:
 * - <PlacementStartButton />: "before you start" dialog → POST /api/placement/start → the run page
 *   (resumes the sitting in progress when there is one);
 * - <PlacementLeaveButton />: confirm → POST /api/placement/{id}/abandon.
 *
 * Client only — talks to the /api/placement routes; the dialog, the JSON POST
 * helper and the button looks are shared with the mock exam.
 */

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Clock, Coffee, Headphones, Loader2, LogOut, Play, Save, X } from "lucide-react";
import { MOCK_BTN, MockDialog, postJson, type MockPostResult } from "@/components/exam/mock-start-button";
import { TOTAL_MINUTES_CORE, placementRunHref } from "@/lib/placement/config";
import { cn } from "@/lib/utils";

export function leavePlacement(attemptId: string): Promise<MockPostResult> {
  return postJson(`/api/placement/${encodeURIComponent(attemptId)}/abandon`, {}, {
    timeoutMs: 20_000,
    fallback: "Couldn't leave the placement test. Please try again.",
  });
}

function CloseButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Close"
      className="-mr-1 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 disabled:opacity-40 motion-reduce:transition-none"
    >
      <X className="h-5 w-5" aria-hidden />
    </button>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div role="alert" className="error-surface mt-4 flex items-start gap-2.5 rounded-xl px-3.5 py-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden />
      <p className="text-sm text-red-100/90">{message}</p>
    </div>
  );
}

const BEFORE_YOU_START = [
  {
    icon: Clock,
    text: `About ${TOTAL_MINUTES_CORE} minutes, plus 15 minutes of Writing if you choose to do it. Pick a quiet time when you won't be interrupted.`,
  },
  { icon: Headphones, text: "Use headphones for Listening — the recording plays once." },
  { icon: Coffee, text: "You can rest between sections: each section's clock starts only when you press Start." },
  { icon: Save, text: "Your answers save as you work, so a dropped connection won't lose them." },
];

export function PlacementStartButton({
  label = "Start the placement test",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "starting" | "opening">("idle");
  const [resumed, setResumed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const descId = useId();
  const busy = phase !== "idle";

  const close = () => {
    if (busy) return;
    setOpen(false);
    setError(null);
  };

  const start = async () => {
    if (busy) return;
    setPhase("starting");
    setError(null);
    const r = await postJson("/api/placement/start", {}, {
      timeoutMs: 30_000,
      fallback: "The placement test couldn't be started. Please try again.",
    });
    const attemptId = r.ok && typeof r.data?.attemptId === "string" ? r.data.attemptId : "";
    if (!attemptId) {
      setPhase("idle");
      setError(r.error);
      return;
    }
    setResumed(r.data?.resumed === true);
    setPhase("opening");
    router.push(placementRunHref(attemptId));
  };

  const status =
    phase === "starting"
      ? "Getting your test ready…"
      : phase === "opening"
        ? resumed
          ? "You already have a placement test in progress — opening it…"
          : "Opening your test…"
        : "";

  return (
    <div className={cn("flex flex-col items-stretch sm:items-start", className)}>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={cn(MOCK_BTN.primary, "min-h-[52px] px-6 text-base")}>
        <Play className="h-4 w-4" aria-hidden />
        {label}
      </button>

      {open && (
        <MockDialog titleId={titleId} descriptionId={descId} onClose={busy ? undefined : close} busy={busy}>
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-lg font-bold text-white sm:text-xl">
              Ready for the placement test?
            </h2>
            <CloseButton onClick={close} disabled={busy} />
          </div>
          <p id={descId} className="mt-1 text-sm leading-relaxed text-gray-300">
            It finds the right course for you — there&apos;s no pass or fail, and no XP. Before you begin:
          </p>
          <ul className="mt-4 space-y-3">
            {BEFORE_YOU_START.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 text-sm leading-relaxed text-gray-200">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
                <span>{text}</span>
              </li>
            ))}
          </ul>

          <p aria-live="polite" className={cn("mt-4 text-sm text-gray-300", !status && "sr-only")}>
            {status}
          </p>
          {error && <ErrorNote message={error} />}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={close} disabled={busy} className={MOCK_BTN.secondary}>
              Not now
            </button>
            <button type="button" data-autofocus onClick={() => void start()} aria-disabled={busy || undefined} className={MOCK_BTN.primary}>
              {busy ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
              {busy ? "Starting…" : error ? "Try again" : "Start the test"}
            </button>
          </div>
        </MockDialog>
      )}
    </div>
  );
}

export function PlacementLeaveButton({
  attemptId,
  redirectTo,
  label = "Leave the test",
  className,
}: {
  attemptId: string;
  /** Where to go after leaving; omit to stay on this page and refresh it. */
  redirectTo?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const descId = useId();
  const busy = leaving || refreshing;

  const close = () => {
    if (busy) return;
    setOpen(false);
    setError(null);
  };

  const leave = async () => {
    if (busy) return;
    setLeaving(true);
    setError(null);
    const r = await leavePlacement(attemptId);
    if (!r.ok) {
      setLeaving(false);
      setError(r.error);
      return;
    }
    if (redirectTo) {
      router.push(redirectTo);
      router.refresh(); // don't show a cached copy that still offers "Resume"
    } else {
      startTransition(() => {
        router.refresh();
      });
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={cn(MOCK_BTN.ghost, className)}>
        <LogOut className="h-4 w-4" aria-hidden />
        {label}
      </button>
      {open && (
        <MockDialog titleId={titleId} descriptionId={descId} onClose={busy ? undefined : close} busy={busy} role="alertdialog">
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-lg font-bold text-white sm:text-xl">
              Leave the placement test?
            </h2>
            <CloseButton onClick={close} disabled={busy} />
          </div>
          <p id={descId} className="mt-1 text-sm leading-relaxed text-gray-300">
            Your answers so far won&apos;t count. Next time the test starts again from the beginning.
          </p>
          <p aria-live="polite" className="sr-only">
            {busy ? "Leaving the placement test…" : ""}
          </p>
          {error && <ErrorNote message={error} />}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" data-autofocus onClick={close} disabled={busy} className={MOCK_BTN.secondary}>
              Keep going
            </button>
            <button type="button" onClick={() => void leave()} aria-disabled={busy || undefined} className={MOCK_BTN.danger}>
              {busy ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : <LogOut className="h-4 w-4" aria-hidden />}
              {busy ? "Leaving…" : "Leave the test"}
            </button>
          </div>
        </MockDialog>
      )}
    </>
  );
}
