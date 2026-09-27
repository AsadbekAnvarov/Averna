"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Headphones, Loader2, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import type { RunnerMode } from "./types";
import { formatClock } from "./use-exam";
import { cn } from "@/lib/utils";

/**
 * The Listening recording strip that sits above the question navigator: what
 * the audio is doing, line progress through the current part and — in
 * practice mode only — pause / replay / speed / skip-reading-time controls.
 * Mock mode shows status only (exam conditions: the recording plays once).
 *
 * No captions or transcript here on purpose: it's a listening test.
 */

export type AudioBarStatus =
  | "ready" // not started yet
  | "starting" // waiting for the first sentence
  | "playing"
  | "reading" // silent time to look at the questions
  | "paused"
  | "stopped" // interrupted (left the page, submit failed…) — can continue
  | "finished" // recording over: checking time
  | "error"
  | "unsupported";

export const PRACTICE_RATES = [0.9, 1, 1.1];

export interface AudioBarProps {
  mode: RunnerMode;
  status: AudioBarStatus;
  /** Part the recording is on, e.g. "Part 2". */
  partLabel: string;
  /** 1-based position of that part in this run, and how many parts the run has. */
  partPosition?: number;
  partCount?: number;
  /** Script lines reached in the current part / lines in it. */
  line: number;
  lines: number;
  /** Reading time end (ms epoch) while it runs. */
  silenceEndsAt?: number | null;
  /** Reading time left while paused (ms). */
  silenceLeftMs?: number;
  /** Practice speed. */
  rate?: number;
  onRateChange?: (rate: number) => void;
  onTogglePause?: () => void;
  onReplay?: () => void;
  onSkip?: () => void;
  /** Start / continue / try again (statuses "ready", "stopped", "error"). */
  onStart?: () => void;
  startLabel?: string;
  startDisabled?: boolean;
  /** Extra detail under the status (e.g. what went wrong). */
  message?: string | null;
}

const EQ_CSS = `
@keyframes av-eq-bounce { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
.av-eq-bar { transform-origin: 50% 100%; animation: av-eq-bounce 1s ease-in-out infinite; }
.av-eq-bar:nth-child(2) { animation-duration: 0.8s; animation-delay: -0.3s; }
.av-eq-bar:nth-child(3) { animation-duration: 1.15s; animation-delay: -0.55s; }
.av-eq-bar:nth-child(4) { animation-duration: 0.9s; animation-delay: -0.15s; }
@media (prefers-reduced-motion: reduce) {
  .av-eq-bar { animation: none; }
  .av-eq-bar:nth-child(1) { transform: scaleY(0.45); }
  .av-eq-bar:nth-child(2) { transform: scaleY(0.85); }
  .av-eq-bar:nth-child(3) { transform: scaleY(0.6); }
  .av-eq-bar:nth-child(4) { transform: scaleY(0.35); }
}
`;

/** Four softly bouncing bars (static under prefers-reduced-motion). */
export function Equaliser({ className }: { className?: string }) {
  return (
    <span className={cn("flex h-4 w-5 items-end justify-between", className)} aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="av-eq-bar h-full w-[3px] rounded-full bg-averna-neon/85" />
      ))}
    </span>
  );
}

function useTicker(active: boolean, everyMs = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [active, everyMs]);
  return now;
}

function StatusIcon({ status }: { status: AudioBarStatus }) {
  const box = "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border";
  switch (status) {
    case "playing":
      return (
        <span className={cn(box, "border-averna-neon/30 bg-averna-neon/10")}>
          <Equaliser />
        </span>
      );
    case "reading":
      return (
        <span className={cn(box, "border-averna-cyan/30 bg-averna-cyan/10 text-averna-cyan")}>
          <Clock className="h-5 w-5" aria-hidden />
        </span>
      );
    case "starting":
      return (
        <span className={cn(box, "border-white/10 bg-white/[0.04] text-averna-neon")}>
          <Loader2 className="h-5 w-5 motion-safe:animate-spin" aria-hidden />
        </span>
      );
    case "paused":
    case "stopped":
      return (
        <span className={cn(box, "border-white/15 bg-white/[0.05] text-gray-200")}>
          <Pause className="h-5 w-5" aria-hidden />
        </span>
      );
    case "finished":
      return (
        <span className={cn(box, "border-averna-neon/30 bg-averna-neon/10 text-averna-neon")}>
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        </span>
      );
    case "error":
    case "unsupported":
      return (
        <span className={cn(box, "border-red-400/40 bg-red-500/10 text-red-300")}>
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
      );
    default:
      return (
        <span className={cn(box, "border-white/10 bg-white/[0.04] text-gray-300")}>
          <Headphones className="h-5 w-5" aria-hidden />
        </span>
      );
  }
}

function statusLabel(status: AudioBarStatus, part: string, of: string): string {
  switch (status) {
    case "ready":
      return "The recording hasn't started yet";
    case "starting":
      return `Starting the recording · ${part}`;
    case "playing":
      return `Audio playing · ${part}${of}`;
    case "reading":
      return `Reading time · ${part}`;
    case "paused":
      return `Paused · ${part}`;
    case "stopped":
      return `Recording stopped · ${part}`;
    case "finished":
      return "Recording finished · Check your answers";
    case "error":
      return `Audio stopped · ${part}`;
    case "unsupported":
      return "Audio isn't available in this browser";
  }
}

const ctrl =
  "inline-flex h-11 min-w-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.03] px-3 text-sm font-semibold text-gray-100 transition hover:border-averna-neon/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 disabled:cursor-not-allowed disabled:opacity-45";

export function AudioBar(props: AudioBarProps) {
  const {
    mode,
    status,
    partLabel,
    partPosition,
    partCount,
    line,
    lines,
    silenceEndsAt,
    silenceLeftMs = 0,
    rate = 1,
    onRateChange,
    onTogglePause,
    onReplay,
    onSkip,
    onStart,
    startLabel = "Start",
    startDisabled,
    message,
  } = props;

  const practice = mode === "practice";
  const now = useTicker(status === "reading" && !!silenceEndsAt);
  const countdown =
    status === "reading" && silenceEndsAt
      ? formatClock(Math.max(0, silenceEndsAt - now))
      : status === "paused" && silenceLeftMs > 0
        ? formatClock(silenceLeftMs)
        : null;

  const of = partCount && partCount > 1 && partPosition ? ` of ${partCount}` : "";
  const label = statusLabel(status, partLabel, of);
  const shownLine = status === "finished" ? lines : Math.max(0, Math.min(line, lines));
  const pct = lines > 0 ? Math.round((shownLine / lines) * 100) : status === "finished" ? 100 : 0;
  const live = status === "playing" || status === "reading" || status === "paused";
  const canStart = !!onStart && (status === "ready" || status === "stopped" || status === "error");
  const canSkip = !!onSkip && (status === "reading" || (status === "paused" && silenceLeftMs > 0));

  return (
    <div role="region" aria-label="Recording" className="px-3 py-2 sm:px-5">
      <style dangerouslySetInnerHTML={{ __html: EQ_CSS }} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-[14rem] flex-1 items-center gap-3">
          <StatusIcon status={status} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-sm font-semibold text-white" aria-live="polite" aria-atomic="true">
                {label}
              </p>
              {countdown && (
                <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-averna-cyan">
                  <span className="sr-only">Reading time left: </span>
                  {countdown}
                </span>
              )}
            </div>
            {status !== "unsupported" && (
              <div className="mt-1.5 flex items-center gap-2">
                <div
                  role="progressbar"
                  aria-label={`${partLabel} progress`}
                  aria-valuemin={0}
                  aria-valuemax={Math.max(1, lines)}
                  aria-valuenow={shownLine}
                  aria-valuetext={`Line ${shownLine} of ${lines}`}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-averna-primary to-averna-neon transition-[width] duration-500 ease-out motion-reduce:transition-none"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-gray-400" aria-hidden>
                  {shownLine}/{lines}
                </span>
              </div>
            )}
            {message && <p className="mt-1 text-xs leading-snug text-red-200">{message}</p>}
          </div>
        </div>

        {(canStart || live) && (
          <div className="flex flex-wrap items-center gap-2">
            {canStart && (
              <button
                type="button"
                onClick={onStart}
                disabled={startDisabled}
                className="glow-cta inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-averna-primary px-4 text-sm font-semibold text-white transition hover:bg-averna-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/70 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === "error" ? <RotateCcw className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
                {startLabel}
              </button>
            )}

            {practice && live && (
              <>
                {canSkip && (
                  <button type="button" onClick={onSkip} className={ctrl} aria-label="Skip the reading time">
                    Skip
                    <SkipForward className="h-4 w-4" aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onTogglePause}
                  className={cn(ctrl, "px-0", status === "paused" && "border-averna-neon/50 text-averna-neon")}
                  aria-label={status === "paused" ? "Resume the recording" : "Pause the recording"}
                  title={status === "paused" ? "Resume" : "Pause"}
                >
                  {status === "paused" ? <Play className="h-5 w-5" aria-hidden /> : <Pause className="h-5 w-5" aria-hidden />}
                </button>
                <button
                  type="button"
                  onClick={onReplay}
                  className={cn(ctrl, "px-0")}
                  aria-label={`Replay ${partLabel} from the start`}
                  title={`Replay ${partLabel}`}
                >
                  <RotateCcw className="h-5 w-5" aria-hidden />
                </button>
                <div role="radiogroup" aria-label="Playback speed" className="flex overflow-hidden rounded-xl border border-white/15 bg-white/[0.03]">
                  {PRACTICE_RATES.map((r) => {
                    const on = Math.abs(r - rate) < 0.001;
                    return (
                      <button
                        key={r}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={`Speed ${r} times`}
                        onClick={() => onRateChange?.(r)}
                        className={cn(
                          "h-11 min-w-[44px] px-2.5 font-mono text-xs font-bold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-averna-neon/60",
                          on ? "bg-averna-neon/15 text-averna-neon" : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
                        )}
                      >
                        {r}×
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {!practice && live && (
              <span className="hidden text-xs text-gray-500 md:inline">Exam conditions — the recording plays once</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AudioBar;
