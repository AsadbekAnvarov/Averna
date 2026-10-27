"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Clock, Loader2, Volume2, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/realtime/stats";
import { liveModeLabel, type LiveMode } from "@/lib/realtime/modes";
import { CallControls } from "./call-controls";
import { LiveOrb } from "./live-orb";
import { useLiveCall, type CallProblem, type EndedCall, type LiveCaption } from "./use-live-call";

const PROBLEM_TEXT: Record<CallProblem, string> = {
  "mic-blocked":
    "Your browser blocked the microphone. Allow it in the site settings (the lock or settings icon next to the address bar) and try again. On iPhone: Settings → Safari → Microphone → Allow.",
  "mic-missing": "No microphone was found, or another app is using it. Close other calls or recordings and try again.",
  unsupported: "This browser can't make live calls. Try the latest Chrome, Edge or Safari, or use the AI Examiner.",
  limit: "Today's live minutes are used up.",
  server: "The live partner didn't pick up. Try again in a moment.",
  network: "Couldn't reach Averna. Check your connection and try again.",
};

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  return !!el.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], button, a, [role='button'], [role='switch']");
};

function CaptionList({ captions }: { captions: LiveCaption[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "nearest" });
  }, [captions]);
  if (!captions.length) return <p className="text-sm text-gray-400">Captions appear here as you talk.</p>;
  return (
    <div>
      <ol className="space-y-3">
        {captions.map((c) => (
          <li key={`${c.who}-${c.id}`} className={cn("rounded-xl px-3 py-2 text-[15px] leading-relaxed", c.who === "me" ? "ml-6 bg-averna-neon/10" : "mr-6 bg-white/5")}>
            <span className={cn("mb-0.5 block text-xs font-semibold", c.who === "me" ? "text-averna-neon" : "text-averna-cyan")}>{c.who === "me" ? "You" : "Partner"}</span>
            <span className={cn("break-words", c.final ? "text-white" : "italic text-gray-400")}>{c.text}</span>
          </li>
        ))}
      </ol>
      <div ref={end} />
    </div>
  );
}

/**
 * The phone-first call screen: a calm orb, the countdown, captions for both sides
 * (a side panel from lg up), Mute / Show captions / End. Space toggles mute (when not
 * typing or on a control), Esc asks to end. Screen readers hear only FINAL caption
 * segments, politely.
 */
export function LiveCallScreen({
  mode,
  topicId,
  topicLabel,
  onEnded,
  onBack,
}: {
  mode: LiveMode;
  topicId: string;
  topicLabel: string;
  onEnded: (call: EndedCall) => void;
  onBack: () => void;
}) {
  const call = useLiveCall({ mode, topicId, topicLabel, onEnded });
  const [captionsOn, setCaptionsOn] = useState(true);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const keepTalking = useRef<HTMLButtonElement>(null);
  const { start, end, toggleMute, phase } = call;

  // The Start click mounted this screen (and primed the audio). start() ignores a repeat.
  useEffect(() => {
    void start();
    heading.current?.focus();
  }, [start]);

  const inCall = phase === "connecting" || phase === "live" || phase === "reconnecting";

  useEffect(() => {
    if (!inCall) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setConfirmEnd((v) => !v);
      } else if ((e.key === " " || e.code === "Space") && !isTyping(e.target)) {
        e.preventDefault();
        toggleMute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inCall, toggleMute]);

  useEffect(() => {
    if (confirmEnd) keepTalking.current?.focus();
  }, [confirmEnd]);

  if (phase === "failed") {
    const text = call.problemText || (call.problem ? PROBLEM_TEXT[call.problem] : PROBLEM_TEXT.server);
    return (
      <section aria-labelledby="live-failed-title" className="glass mx-auto max-w-xl rounded-2xl border border-white/10 p-5 sm:p-6">
        <h2 id="live-failed-title" ref={heading} tabIndex={-1} className="flex items-center gap-2 text-lg font-semibold text-white">
          <AlertCircle aria-hidden className="h-5 w-5 shrink-0 text-amber-300" />
          {call.problem === "mic-blocked" ? "Microphone blocked" : call.problem === "limit" ? "No live minutes left" : "The call didn't start"}
        </h2>
        <p role="alert" className="mt-2 text-sm leading-relaxed text-gray-300">
          {text}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onBack} className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-averna-primary/30 px-4 text-sm font-semibold text-white hover:bg-averna-primary/45">
            Back to setup
          </button>
          <Link href="/learning/examiner" className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/20 px-4 text-sm font-semibold text-white hover:bg-white/10">
            Open the AI Examiner
          </Link>
        </div>
      </section>
    );
  }

  const left = call.secondsLeft;
  const status =
    phase === "connecting"
      ? "Connecting to your partner…"
      : phase === "reconnecting"
        ? "Connection dropped. Reconnecting…"
        : phase === "ending" || phase === "ended"
          ? "Ending the call…"
          : call.micInterrupted
            ? "Paused: your microphone was interrupted (a phone call?). The call goes on when it's back."
            : call.muted
              ? "You're muted. Press Unmute (or Space) to talk."
              : "";

  return (
    <section aria-labelledby="live-call-title" className="mx-auto w-full max-w-5xl">
      <h2 id="live-call-title" ref={heading} tabIndex={-1} className="sr-only">
        Live call with your speaking partner
      </h2>
      {/* The partner's voice. */}
      <audio ref={call.attachAudio} autoPlay playsInline className="hidden" />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-sm text-gray-300">
          <span className="font-semibold text-white">{liveModeLabel(mode)}</span>
          <span aria-hidden> · </span>
          <span className="break-words">{call.topic}</span>
        </p>
        <p role="timer" aria-label="Time left" className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-white/5 px-3 text-sm font-semibold tabular-nums text-white">
          <Clock aria-hidden className="h-4 w-4 text-gray-400" />
          {left == null ? "–:––" : `${formatClock(left)} left`}
        </p>
      </div>
      {call.oneMinuteLeft && inCall && (
        <p role="status" className="mb-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
          1 minute left. Start wrapping up your answer.
        </p>
      )}

      <div className={cn("grid gap-4", captionsOn && "lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]")}>
        <div className="glass flex flex-col items-center gap-5 rounded-2xl border border-white/10 px-4 py-6 sm:py-8">
          <LiveOrb levels={call.levels} active={phase === "live"} muted={call.muted} />
          <div className="min-h-[24px] text-center" role="status" aria-live="polite">
            {status && (
              <p className="inline-flex items-center gap-2 text-sm text-gray-300">
                {(phase === "connecting" || phase === "reconnecting" || phase === "ending") && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
                {phase === "reconnecting" && <WifiOff aria-hidden className="h-4 w-4" />}
                {status}
              </p>
            )}
          </div>
          {call.audioBlocked && (
            <button type="button" onClick={call.resumeAudio} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-averna-cyan/20 px-4 text-sm font-semibold text-white hover:bg-averna-cyan/30">
              <Volume2 aria-hidden className="h-5 w-5" /> Tap to hear your partner
            </button>
          )}
          <CallControls
            muted={call.muted}
            onToggleMute={toggleMute}
            captionsOn={captionsOn}
            onToggleCaptions={() => setCaptionsOn((v) => !v)}
            onEnd={() => end("student")}
            disabled={!inCall}
          />
          <p className="hidden text-xs text-gray-400 sm:block">
            Keys: Space mutes · Esc ends
          </p>
        </div>

        {captionsOn && (
          <aside aria-label="Captions" className="glass max-h-[45vh] overflow-y-auto rounded-2xl border border-white/10 p-4 lg:max-h-[min(70vh,640px)]">
            <h3 className="mb-3 text-sm font-semibold text-white">Captions</h3>
            <CaptionList captions={call.captions} />
          </aside>
        )}
      </div>

      {/* Final caption segments only, politely — and only while captions are on. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {captionsOn ? call.announce : ""}
      </div>

      {confirmEnd && inCall && (
        <div role="alertdialog" aria-modal="false" aria-labelledby="live-end-title" className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-sm rounded-2xl border border-white/15 bg-surface-raised p-4 shadow-2xl sm:bottom-8">
          <p id="live-end-title" className="text-base font-semibold text-white">
            End the call?
          </p>
          <p className="mt-1 text-sm text-gray-300">You&apos;ll see how it went right after.</p>
          <div className="mt-3 flex gap-2">
            <button ref={keepTalking} type="button" onClick={() => setConfirmEnd(false)} className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-white/20 px-3 text-sm font-semibold text-white hover:bg-white/10">
              Keep talking
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmEnd(false);
                end("student");
              }}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-red-400/60 bg-red-500/15 px-3 text-sm font-semibold text-red-300 hover:bg-red-500/25"
            >
              End call
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
