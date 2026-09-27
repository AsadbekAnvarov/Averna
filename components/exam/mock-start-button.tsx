"use client";

/**
 * Actions for the real IELTS mock exam, plus the small pieces the mock UI
 * shares (button styles, the focus-trapped dialog, the JSON POST helper):
 *
 * - <MockStartButton />: confirm dialog → POST /api/mock/start → the run page.
 * - <MockLeaveButton />: confirm dialog → POST /api/mock/{id}/abandon.
 *
 * Client only — talks to the /api/mock routes and never imports server code.
 */

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Clock, Coffee, Globe, Headphones, Loader2, LogOut, Mic, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const MOCK_HUB_HREF = "/learning/mock-exam";
export const mockRunHref = (attemptId: string) => `${MOCK_HUB_HREF}/${encodeURIComponent(attemptId)}`;
export const mockResultHref = (attemptId: string) => `${MOCK_HUB_HREF}/result/${encodeURIComponent(attemptId)}`;

export const MOCK_BTN = {
  primary:
    "glow-cta inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-averna-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-averna-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/70 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-wait aria-disabled:opacity-70 motion-reduce:transition-none",
  secondary:
    "glow-hover inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-5 text-sm font-semibold text-gray-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:opacity-60",
  danger:
    "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-red-300/40 bg-red-500/10 px-5 text-sm font-semibold text-red-100 transition-colors hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-wait aria-disabled:opacity-70 motion-reduce:transition-none",
  ghost:
    "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none",
} as const;

// ---------------------------------------------------------------------------
// POST helper
// ---------------------------------------------------------------------------

export interface MockPostResult {
  ok: boolean;
  /** HTTP status; 0 when the request never got an answer. */
  status: number;
  data: Record<string, unknown> | null;
  /** Student-readable reason (the server's own message when it sent one). */
  error: string;
}

const OFFLINE = "You seem to be offline. Reconnect, then try again.";
const UNREACHABLE = "We couldn't reach the server. Check your connection and try again.";
const SLOW = "The server is taking longer than usual. Please try again in a moment.";

function statusText(status: number, fallback: string): string {
  if (status === 401) return "Your session has expired. Sign in again in a new tab, then try again.";
  if (status === 429) return "Too many requests right now. Wait a moment, then try again.";
  if (status === 502 || status === 503 || status === 504) return "The server is busy right now. Please try again in a moment.";
  return fallback;
}

/** POST JSON and read the JSON answer. Never throws. */
export async function postJson(
  url: string,
  body: unknown = {},
  opts: { timeoutMs?: number; timeoutMessage?: string; fallback?: string } = {}
): Promise<MockPostResult> {
  const fallback = opts.fallback ?? "Something went wrong. Please try again.";
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl && opts.timeoutMs ? window.setTimeout(() => ctrl.abort(), opts.timeoutMs) : 0;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      credentials: "same-origin",
      cache: "no-store",
      signal: ctrl?.signal,
    });
    const raw: unknown = await res.json().catch(() => null);
    const data = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
    const serverError = typeof data?.error === "string" ? data.error.trim() : "";
    return { ok: res.ok, status: res.status, data, error: serverError || statusText(res.status, fallback) };
  } catch {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    const error = ctrl?.signal.aborted ? opts.timeoutMessage ?? SLOW : offline ? OFFLINE : UNREACHABLE;
    return { ok: false, status: 0, data: null, error };
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}

/** Leave a mock for good (sections already submitted stay saved). */
export function abandonMock(attemptId: string): Promise<MockPostResult> {
  return postJson(`/api/mock/${encodeURIComponent(attemptId)}/abandon`, {}, {
    timeoutMs: 20_000,
    fallback: "Couldn't leave the mock exam. Please try again.",
  });
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog for the mock UI: focus moves in (to `[data-autofocus]` or the
 * first control), Tab stays inside, Escape / backdrop call `onClose` (omit it
 * for a dialog that can't be dismissed, e.g. while answers are being marked),
 * and focus returns to where it was when the dialog closes. Sits above the
 * exam runners (z-[70]) and their review dialog (z-[80]).
 */
export function MockDialog({
  titleId,
  descriptionId,
  onClose,
  role = "dialog",
  busy,
  className,
  children,
}: {
  titleId: string;
  descriptionId?: string;
  onClose?: () => void;
  role?: "dialog" | "alertdialog";
  busy?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const panel: HTMLDivElement | null = panelRef.current;
    if (!panel) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = (): HTMLElement[] =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
    const first: HTMLElement = panel.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0] ?? panel;
    first.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (onCloseRef.current) {
          e.preventDefault();
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      // Keep exam shortcuts behind the dialog (e.g. Space / Enter = "Next" in Speaking) from firing.
      if ((e.key === " " || e.key === "Enter") && e.target === panel) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (!list.length) {
        e.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const active = document.activeElement;
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (!panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? lastEl : firstEl).focus();
      } else if (e.shiftKey && (active === firstEl || active === panel)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (previous && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div
      role="presentation"
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onCloseRef.current?.();
      }}
      className="fixed inset-0 z-[90] flex items-end justify-center overflow-y-auto overscroll-contain bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={busy || undefined}
        tabIndex={-1}
        className={cn(
          "av-panel w-full max-w-lg rounded-2xl p-5 outline-none sm:p-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
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

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const BEFORE_YOU_START = [
  { icon: Clock, text: "It takes about 3 hours: Listening, Reading, Writing and Speaking, in that order. Find a quiet time when you won't be interrupted." },
  { icon: Headphones, text: "Use headphones for Listening — each recording plays once." },
  { icon: Mic, text: "You'll need a working microphone for Speaking." },
  { icon: Globe, text: "Chrome or Microsoft Edge on a computer is recommended — they have the most reliable speech recognition." },
  { icon: Coffee, text: "You can rest between sections: each section's clock starts only when you press Start." },
];

export function MockStartButton({
  disabled = false,
  disabledReason,
  label = "Start the mock exam",
  className,
}: {
  disabled?: boolean;
  /** Shown under the button (and linked to it) while it's disabled. */
  disabledReason?: string;
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
  const reasonId = useId();
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
    const r = await postJson("/api/mock/start", {}, {
      timeoutMs: 30_000,
      fallback: "The mock exam couldn't be started. Please try again.",
    });
    const attemptId = r.ok && typeof r.data?.attemptId === "string" ? r.data.attemptId : "";
    if (!attemptId) {
      setPhase("idle");
      setError(r.error);
      return;
    }
    setResumed(r.data?.resumed === true);
    setPhase("opening");
    router.push(mockRunHref(attemptId));
  };

  const status =
    phase === "starting"
      ? "Choosing your papers…"
      : phase === "opening"
        ? resumed
          ? "You already have a mock in progress — opening it…"
          : "Opening your exam…"
        : "";

  return (
    <div className={cn("flex flex-col items-stretch sm:items-start", className)}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-describedby={disabled && disabledReason ? reasonId : undefined}
        className={cn(MOCK_BTN.primary, "min-h-[52px] px-6 text-base")}
      >
        <Play className="h-4 w-4" aria-hidden />
        {label}
      </button>
      {disabled && disabledReason && (
        <p id={reasonId} className="mt-2 max-w-xs text-sm text-gray-400">
          {disabledReason}
        </p>
      )}

      {open && (
        <MockDialog titleId={titleId} descriptionId={descId} onClose={busy ? undefined : close} busy={busy}>
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-lg font-bold text-white sm:text-xl">
              Start a full IELTS mock?
            </h2>
            <CloseButton onClick={close} disabled={busy} />
          </div>
          <p id={descId} className="mt-1 text-sm leading-relaxed text-gray-300">
            This is the complete test in exam conditions. Before you begin:
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
            <button
              type="button"
              data-autofocus
              onClick={() => void start()}
              aria-disabled={busy || undefined}
              className={MOCK_BTN.primary}
            >
              {busy ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
              {busy ? "Starting…" : error ? "Try again" : "Start the mock"}
            </button>
          </div>
        </MockDialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leave
// ---------------------------------------------------------------------------

export function MockLeaveButton({
  attemptId,
  redirectTo,
  label = "Leave exam",
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
    const r = await abandonMock(attemptId);
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
              Leave this mock exam?
            </h2>
            <CloseButton onClick={close} disabled={busy} />
          </div>
          <p id={descId} className="mt-1 text-sm leading-relaxed text-gray-300">
            You can&apos;t resume a mock you leave. Sections you&apos;ve already submitted stay in your history.
          </p>
          <p aria-live="polite" className="sr-only">
            {busy ? "Leaving the mock exam…" : ""}
          </p>
          {error && <ErrorNote message={error} />}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" data-autofocus onClick={close} disabled={busy} className={MOCK_BTN.secondary}>
              Keep my mock
            </button>
            <button type="button" onClick={() => void leave()} aria-disabled={busy || undefined} className={MOCK_BTN.danger}>
              {busy ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : <LogOut className="h-4 w-4" aria-hidden />}
              {busy ? "Leaving…" : "Leave the exam"}
            </button>
          </div>
        </MockDialog>
      )}
    </>
  );
}
