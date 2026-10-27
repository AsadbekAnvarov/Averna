"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Bot, Headphones, Phone, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { MicCheck } from "@/components/speaking/mic-check";
import { LIVE_MODES, SURPRISE_TOPIC, type LiveMode } from "@/lib/realtime/modes";
import { MIN_CALL_SECONDS } from "@/lib/realtime/limits";

export interface LiveTopicOption {
  id: string;
  label: string;
}

export interface LiveChoice {
  mode: LiveMode;
  topicId: string;
  topicLabel: string;
}

const minutes = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m} min ${s} s` : `${m} min`;
};

/** Shown instead of the setup when no OpenAI key is configured: no broken button. */
export function LiveUnavailable() {
  return (
    <section data-testid="live-unavailable" aria-labelledby="live-unavailable-title" className="glass mx-auto max-w-xl rounded-2xl border border-white/10 p-5 sm:p-6">
      <h2 id="live-unavailable-title" className="text-lg font-semibold text-white">
        Live partner isn&apos;t available right now
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-300">
        You can still practise speaking out loud and get a band estimate with the AI Examiner.
      </p>
      <Link
        href="/learning/examiner"
        className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-averna-primary/30 px-4 text-sm font-semibold text-white hover:bg-averna-primary/45 sm:w-auto"
      >
        <Bot aria-hidden className="h-4 w-4" /> Open the AI Examiner
      </Link>
    </section>
  );
}

/**
 * Setup: mode, topic ("Surprise me" first), today's minutes, a mic check with a level
 * meter, Start. Phone first: one column, 44 px controls.
 */
export function LiveSetup({
  topics,
  limits,
  remainingSec,
  initial,
  onStart,
}: {
  topics: Record<LiveMode, LiveTopicOption[]>;
  limits: { studentSecondsPerDay: number; maxCallSeconds: number };
  /** Seconds left today (null when unknown). */
  remainingSec: number | null;
  initial?: Partial<LiveChoice>;
  onStart: (choice: LiveChoice) => void;
}) {
  const [mode, setMode] = useState<LiveMode>(initial?.mode ?? "casual");
  const [topicId, setTopicId] = useState<string>(initial?.topicId ?? SURPRISE_TOPIC);
  const [webrtc, setWebrtc] = useState(true);
  const id = useId();

  useEffect(() => {
    setWebrtc(typeof window !== "undefined" && typeof window.RTCPeerConnection === "function" && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  const list = topics[mode] ?? [];
  const validTopic = topicId === SURPRISE_TOPIC || list.some((t) => t.id === topicId);
  const chosen = validTopic ? topicId : SURPRISE_TOPIC;
  const outOfMinutes = remainingSec != null && remainingSec < MIN_CALL_SECONDS;
  const nextCall = remainingSec != null ? Math.min(limits.maxCallSeconds, remainingSec) : limits.maxCallSeconds;

  const start = () => {
    const label = chosen === SURPRISE_TOPIC ? "Surprise topic" : (list.find((t) => t.id === chosen)?.label ?? "Surprise topic");
    onStart({ mode, topicId: chosen, topicLabel: label });
  };

  return (
    <section data-testid="live-setup" aria-labelledby={`${id}-title`} className="mx-auto w-full max-w-2xl space-y-5">
      <h2 id={`${id}-title`} className="sr-only">
        Set up your call
      </h2>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold text-white">How do you want to talk?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {LIVE_MODES.map((m) => (
            <label
              key={m.id}
              className={cn(
                "flex min-h-[44px] cursor-pointer flex-col gap-0.5 rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-averna-neon",
                mode === m.id ? "border-averna-neon/60 bg-averna-neon/10" : "border-white/15 bg-white/5 hover:bg-white/10",
              )}
            >
              <span className="flex items-center gap-2">
                <input type="radio" name={`${id}-mode`} value={m.id} checked={mode === m.id} onChange={() => setMode(m.id)} className="h-4 w-4 accent-averna-neon" />
                <span className="text-sm font-semibold text-white">{m.label}</span>
              </span>
              <span className="pl-6 text-[13px] leading-snug text-gray-400">{m.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${id}-topic`} className="mb-2 block text-sm font-semibold text-white">
          Topic
        </label>
        <select
          id={`${id}-topic`}
          value={chosen}
          onChange={(e) => setTopicId(e.target.value)}
          className="min-h-[44px] w-full rounded-xl border border-white/15 bg-white/5 px-3 text-[15px] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon"
        >
          <option value={SURPRISE_TOPIC}>Surprise me</option>
          {list.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300" aria-live="polite">
        {remainingSec == null
          ? `Up to ${minutes(limits.studentSecondsPerDay)} a day · each call up to ${minutes(limits.maxCallSeconds)}`
          : outOfMinutes
            ? "You've used today's live minutes. They come back tomorrow."
            : `${minutes(remainingSec)} of ${minutes(limits.studentSecondsPerDay)} left today · this call up to ${minutes(nextCall)}`}
      </p>

      <MicCheck />

      <ul className="space-y-1.5 text-sm text-gray-400">
        <li className="flex items-start gap-2">
          <Headphones aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /> Headphones help: the partner won&apos;t hear itself.
        </li>
        <li className="flex items-start gap-2">
          <Phone aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /> Pause to think if you need to. The partner waits a few seconds before it speaks.
        </li>
        <li className="flex items-start gap-2">
          <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /> No audio is stored. Captions stay in this browser.
        </li>
      </ul>

      {!webrtc && (
        <p role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
          This browser can&apos;t make live calls. Try the latest Chrome, Edge or Safari, or{" "}
          <Link href="/learning/examiner" className="font-semibold underline underline-offset-2">
            use the AI Examiner
          </Link>
          .
        </p>
      )}

      <button
        type="button"
        onClick={start}
        disabled={outOfMinutes || !webrtc}
        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-averna-primary/30 px-6 text-base font-semibold text-white transition-colors hover:bg-averna-primary/45 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        <Phone aria-hidden className="h-5 w-5" /> Start call
      </button>
    </section>
  );
}
