"use client";
import { ExamThemeToggle } from "./exam-preferences";
import { ReviewDialog } from "./exam-review-dialog";
import { MockCdiShell, useMockCdi } from "./mock-cdi-interface";
import { MockSaveStatus } from "./mock-save-status";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, Flag, Loader2, Minus, Plus, Type, X } from "lucide-react";
import { formatClock } from "./use-exam";
import { cn } from "@/lib/utils";

/**
 * The computer-delivered IELTS frame shared by every exam runner:
 * a slim header (test, timer, text size, submit), a split passage/questions
 * body with a draggable divider (tabs on phones), and the question navigator
 * along the bottom — plus the "review before you submit" dialog.
 *
 * Full-screen overlay on purpose: like the real test, nothing else competes
 * for attention while the clock runs.
 */

export interface ExamPartNav {
  title: string;
  numbers: number[];
}

export interface ExamShellProps {
  title: string;
  subtitle?: string;
  remainingMs: number | null;
  parts: ExamPartNav[];
  /** Optional summary in the CDI Mock navigator (e.g. Writing word counts). */
  partSummaries?: string[];
  activePart: number;
  onPartChange: (i: number) => void;
  answered: Set<number>;
  flagged: Set<number>;
  current: number | null;
  onJump: (n: number) => void;
  fontScale: number;
  onFontScale: (v: number) => void;
  /** Passage (Reading) — omit for single-column layouts (Listening). */
  left?: React.ReactNode;
  leftLabel?: string;
  rightLabel?: string;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
  /** Practice scope only. Never supplied in Mock. */
  scopeExtra?: React.ReactNode;
  reviewDescription?: React.ReactNode;
  itemLabel?: "questions" | "tasks";
  /** Shown above the navigator (e.g. audio progress). */
  footerExtra?: React.ReactNode;
  onSubmit: () => void | Promise<void>;
  submitting?: boolean;
  submitLabel?: string;
  /** Where "Leave" goes (practice). Omit to hide the button (mock). */
  exitHref?: string;
}

export const FONT_STEPS = [0.9, 1, 1.12, 1.25];

function TimerPill({ remainingMs }: { remainingMs: number | null }) {
  const [announce, setAnnounce] = useState("");
  const lastMark = useRef<number | null>(null);
  useEffect(() => {
    if (remainingMs == null) return;
    const mins = Math.ceil(remainingMs / 60000);
    for (const mark of [10, 5, 1]) {
      if (mins === mark && lastMark.current !== mark) {
        lastMark.current = mark;
        setAnnounce(`${mark} minute${mark === 1 ? "" : "s"} remaining`);
      }
    }
  }, [remainingMs]);
  if (remainingMs == null) return null;
  const low = remainingMs <= 5 * 60000;
  const warn = remainingMs <= 10 * 60000;
  return (
    <>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2 py-1.5 font-mono sm:px-3 text-sm font-bold tabular-nums",
          low
            ? "border-red-400/60 bg-red-500/15 text-red-200 shadow-[0_0_18px_-6px_rgba(248,113,113,0.7)]"
            : warn
              ? "border-amber-300/50 bg-amber-400/10 text-amber-200"
              : "border-white/15 bg-white/[0.05] text-white"
        )}
        aria-label={`Time remaining ${formatClock(remainingMs)}`}
      >
        <Clock className="h-4 w-4" aria-hidden />
        {formatClock(remainingMs)}
      </span>
      <span className="sr-only" aria-live="assertive">
        {announce}
      </span>
    </>
  );
}

/**
 * Phone-only text size control (the header group is `hidden sm:flex`): an "Aa"
 * button that opens a small panel under the header. Closes on Escape, a tap
 * outside, or a second tap on "Aa".
 */
function MobileTextSize({ fontScale, onFontScale }: { fontScale: number; onFontScale: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const fontIdx = Math.max(0, FONT_STEPS.indexOf(fontScale));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    const onPointerDown = (e: Event) => {
      if (wrapRef.current && e.target instanceof Node && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const stepBtn =
    "inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 text-gray-300 hover:text-white disabled:opacity-40";

  return (
    <div ref={wrapRef} className="shrink-0 sm:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Text size"
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "inline-flex h-11 w-11 items-center justify-center rounded-lg border text-sm font-bold transition",
          open ? "border-averna-neon/50 bg-averna-neon/15 text-averna-neon" : "border-white/15 text-gray-300 hover:text-white"
        )}
      >
        <span aria-hidden>Aa</span>
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute inset-x-0 top-full flex items-center justify-center gap-3 border-b border-white/10 bg-exam-bar px-3 py-2 shadow-lg"
        >
          <button
            type="button"
            onClick={() => onFontScale(FONT_STEPS[Math.max(0, fontIdx - 1)])}
            disabled={fontIdx === 0}
            className={stepBtn}
            aria-label="Smaller text"
          >
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <span className="min-w-[3.5rem] text-center font-mono text-sm font-bold tabular-nums text-white" aria-live="polite">
            {Math.round(fontScale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => onFontScale(FONT_STEPS[Math.min(FONT_STEPS.length - 1, fontIdx + 1)])}
            disabled={fontIdx === FONT_STEPS.length - 1}
            className={stepBtn}
            aria-label="Larger text"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}


export function ExamShell(props: ExamShellProps) {
  const cdi = useMockCdi();
  return cdi ? <MockCdiShell {...props} /> : <AvernaExamShell {...props} />;
}

function AvernaExamShell(props: ExamShellProps) {
  const {
    title,
    subtitle,
    remainingMs,
    parts,
    activePart,
    onPartChange,
    answered,
    flagged,
    current,
    onJump,
    fontScale,
    onFontScale,
    left,
    leftLabel = "Passage",
    rightLabel = "Questions",
    children,
    headerExtra,
    scopeExtra,
    reviewDescription,
    itemLabel = "questions",
    footerExtra,
    onSubmit,
    submitting,
    submitLabel = "Finish Test",
    exitHref,
  } = props;

  const [reviewOpen, setReviewOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<"left" | "right">(left ? "left" : "right");
  const [split, setSplit] = useState(50);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const allNumbers = useMemo(() => parts.flatMap((p) => p.numbers), [parts]);
  const idx = current != null ? allNumbers.indexOf(current) : -1;

  const jump = useCallback(
    (n: number) => {
      setReviewOpen(false);
      setMobilePane("right");
      onJump(n);
    },
    [onJump]
  );

  const step = (dir: 1 | -1) => {
    const next = idx < 0 ? allNumbers[0] : allNumbers[Math.max(0, Math.min(allNumbers.length - 1, idx + dir))];
    if (next != null) jump(next);
  };

  // Draggable divider (desktop).
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current || !bodyRef.current) return;
      const r = bodyRef.current.getBoundingClientRect();
      setSplit(Math.max(28, Math.min(72, ((e.clientX - r.left) / r.width) * 100)));
    };
    const up = () => {
      dragging.current = false;
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  // Lock page scroll behind the overlay.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const fontIdx = Math.max(0, FONT_STEPS.indexOf(fontScale));

  return (
    <div className="exam-shell fixed inset-0 z-[70] flex flex-col bg-exam-bg pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] text-gray-100">
      {/* Header */}
      <header className="relative z-20 flex shrink-0 flex-wrap items-center gap-1.5 sm:flex-nowrap border-b border-white/10 bg-exam-bar/95 px-2 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur sm:gap-3 sm:px-5">
        {exitHref && (
          <Link
            href={exitHref}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm text-gray-400 transition hover:bg-white/5 hover:text-white sm:h-auto sm:w-auto sm:px-2 sm:py-1.5"
            aria-label="Leave the test"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
        )}
        <div className={cn("min-w-0 flex-1 truncate", exitHref ? "basis-[calc(100%-3.5rem)] sm:basis-auto" : "basis-full sm:basis-auto")}>
          <p className="truncate text-sm font-bold text-white sm:text-base">{title}</p>
          {subtitle && <p className="truncate text-xs text-gray-400">{subtitle}</p>}
        </div>
        {headerExtra}
        <TimerPill remainingMs={remainingMs} />
        <div className="hidden items-center rounded-full border border-white/15 sm:flex" role="group" aria-label="Text size">
          <button
            type="button"
            onClick={() => onFontScale(FONT_STEPS[Math.max(0, fontIdx - 1)])}
            disabled={fontIdx === 0}
            className="rounded-l-full px-2.5 py-1.5 text-gray-300 hover:text-white disabled:opacity-40"
            aria-label="Smaller text"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <Type className="h-4 w-4 text-gray-400" aria-hidden />
          <button
            type="button"
            onClick={() => onFontScale(FONT_STEPS[Math.min(FONT_STEPS.length - 1, fontIdx + 1)])}
            disabled={fontIdx === FONT_STEPS.length - 1}
            className="rounded-r-full px-2.5 py-1.5 text-gray-300 hover:text-white disabled:opacity-40"
            aria-label="Larger text"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <MobileTextSize fontScale={fontScale} onFontScale={onFontScale} />
        <ExamThemeToggle />
        <button
          type="button"
          onClick={() => setReviewOpen(true)}
          disabled={submitting}
          className="glow-cta inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-averna-primary px-3 text-sm font-semibold text-white transition hover:bg-averna-light disabled:opacity-60 sm:px-4"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {submitLabel}
        </button>
      </header>

      {scopeExtra && <div className="shrink-0 border-b border-white/10 bg-exam-bar">{scopeExtra}</div>}

      {/* Mobile pane switcher */}
      {left && (
        <div className="flex shrink-0 gap-1 border-b border-white/10 bg-exam-bar p-1.5 lg:hidden" role="tablist" aria-label="View">
          {(["left", "right"] as const).map((pane) => (
            <button
              key={pane}
              type="button"
              role="tab"
              aria-selected={mobilePane === pane}
              onClick={() => setMobilePane(pane)}
              className={cn(
                "flex-1 rounded-lg py-2 text-sm font-semibold transition",
                mobilePane === pane ? "bg-averna-neon/15 text-averna-neon" : "text-gray-400"
              )}
            >
              {pane === "left" ? leftLabel : rightLabel}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      {/* Pane widths live in CSS variables and only apply from lg: below it the
          visible pane is w-full (an inline flex-basis would override that). */}
      <div
        ref={bodyRef}
        className="relative flex min-h-0 flex-1"
        style={{ fontSize: `${fontScale}rem`, "--exam-left": `${split}%`, "--exam-right": `${100 - split}%` } as React.CSSProperties}
      >
        {left ? (
          <>
            <div
              className={cn(
                "min-h-0 min-w-0 overflow-y-auto overscroll-contain",
                mobilePane === "left" ? "block w-full" : "hidden",
                "lg:block lg:basis-[var(--exam-left)]"
              )}
            >
              {left}
            </div>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize panes"
              tabIndex={0}
              aria-valuemin={28}
              aria-valuemax={72}
              aria-valuenow={Math.round(split)}
              onKeyDown={event => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  setSplit(value => Math.max(28, Math.min(72, value + (event.key === "ArrowLeft" ? -2 : 2))));
                }
              }}
              onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => {
                // Dragging the divider must not start a text selection or let a
                // touch gesture scroll the page (touch-none below stops panning).
                e.preventDefault();
                dragging.current = true;
                document.body.style.cursor = "col-resize";
              }}
              className="group relative hidden w-2 shrink-0 cursor-col-resize touch-none select-none bg-white/[0.04] hover:bg-averna-neon/20 lg:block"
            >
              <span className="absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20 group-hover:bg-averna-neon/60" />
            </div>
            <div
              className={cn(
                "min-h-0 min-w-0 overflow-y-auto overscroll-contain",
                mobilePane === "right" ? "block w-full" : "hidden",
                "lg:block lg:basis-[var(--exam-right)]"
              )}
            >
              {children}
            </div>
          </>
        ) : (
          <div className="min-h-0 w-full overflow-y-auto overscroll-contain">{children}</div>
        )}
      </div>

      <MockSaveStatus />
      {footerExtra && <div className="shrink-0 border-t border-white/10 bg-exam-bar">{footerExtra}</div>}

      {/* Navigator */}
      <nav aria-label="Question navigator" className="relative shrink-0 border-t border-white/10 bg-exam-bar/95 px-2 pb-[calc(0.25rem+env(safe-area-inset-bottom))] pt-1 backdrop-blur sm:px-4 lg:pr-[15rem]">
        <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400 lg:absolute lg:right-4 lg:top-1/2 lg:mb-0 lg:max-w-[13rem] lg:-translate-y-1/2 lg:justify-end lg:text-xs" aria-label="Answer status legend">
          <span>{answered.size}/{allNumbers.length} {itemLabel === "tasks" ? "tasks started" : "answered"}</span>
          <span className="inline-flex items-center gap-1"><Flag className="h-3.5 w-3.5" aria-hidden />{flagged.size} for review</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/15 text-gray-300 hover:text-white sm:h-10 sm:w-10"
            aria-label="Previous question"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto no-scrollbar">
            {parts.map((p, i) => {
              const done = p.numbers.filter((n) => answered.has(n)).length;
              const active = i === activePart;
              return (
                <div key={p.title} className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onPartChange(i)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "min-h-[44px] whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-semibold transition",
                      active ? "bg-averna-neon/15 text-averna-neon" : "text-gray-400 hover:text-white"
                    )}
                  >
                    {p.title}
                    <span className="ml-1.5 font-medium text-gray-500">
                      {done}/{p.numbers.length}
                    </span>
                  </button>
                  {active && (
                    <div className="flex items-center gap-1">
                      {p.numbers.map((n) => {
                        const isCur = n === current;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => jump(n)}
                            aria-label={`Question ${n}${answered.has(n) ? ", answered" : ", not answered"}${flagged.has(n) ? ", flagged" : ""}`}
                            aria-current={isCur ? "true" : undefined}
                            className={cn(
                              "relative h-11 min-w-[2.75rem] rounded-md border px-1 text-sm font-semibold transition",
                              answered.has(n)
                                ? "border-averna-cyan/40 bg-averna-cyan/15 text-white"
                                : "border-white/15 bg-transparent text-gray-400 hover:text-white",
                              isCur && "ring-2 ring-averna-neon/70"
                            )}
                          >
                            {n}
                            {flagged.has(n) && (
                              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-300" aria-hidden />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => step(1)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/15 text-gray-300 hover:text-white sm:h-10 sm:w-10"
            aria-label="Next question"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </nav>

      {reviewOpen && (
        <ReviewDialog
          parts={parts}
          answered={answered}
          flagged={flagged}
          onClose={() => setReviewOpen(false)}
          onJump={jump}
          submitting={submitting}
          submitLabel={submitLabel}
          description={reviewDescription}
          onConfirm={async () => {
            await onSubmit();
            setReviewOpen(false);
          }}
        />
      )}
    </div>
  );
}
