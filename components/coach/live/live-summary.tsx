"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Info, Lightbulb, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { fallbackTips, formatClock } from "@/lib/realtime/stats";
import { buildPronunciationMap, markTranscript } from "@/lib/realtime/pronunciation-map";
import { liveModeLabel, type LiveMode } from "@/lib/realtime/modes";
import { PractiseWords } from "./practise-words";
import type { EndedCall } from "./use-live-call";

const TIPS_TEXT_LIMIT = 8_000;

/** The turns sent once for tips: the newest that fit the server's 8 000-character limit. */
function tipsTurns(call: EndedCall) {
  const out: { who: "me" | "ai"; text: string }[] = [];
  let used = 0;
  for (let i = call.turns.length - 1; i >= 0; i--) {
    const text = call.turns[i].text.slice(0, 1_500);
    if (used + text.length > TIPS_TEXT_LIMIT) break;
    used += text.length;
    out.unshift({ who: call.turns[i].who, text });
  }
  return out;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <dt className="text-xs font-medium text-gray-400">{label}</dt>
      <dd className="mt-1 text-xl font-bold tabular-nums text-white">{value}</dd>
      {sub && <dd className="mt-0.5 text-xs text-gray-400">{sub}</dd>}
    </div>
  );
}

export interface LiveTips {
  list: string[];
  source: "ai" | "numbers";
}

/** "How it went": stats, three tips, XP, and the honest pronunciation map. */
export function LiveSummary({
  call,
  mode,
  onNewCall,
  canCallAgain,
  savedTips = null,
  onTips,
}: {
  call: EndedCall;
  mode: LiveMode;
  onNewCall: () => void;
  canCallAgain: boolean;
  /** Tips kept with the summary in sessionStorage (no second request after a reload). */
  savedTips?: LiveTips | null;
  onTips?: (tips: LiveTips) => void;
}) {
  const { stats } = call;
  const [tips, setTips] = useState<LiveTips | null>(savedTips);
  const onTipsRef = useRef(onTips);
  onTipsRef.current = onTips;
  const asked = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const map = useMemo(() => buildPronunciationMap(call.turns), [call.turns]);
  const unclearSet = useMemo(() => new Set(map.unclear.map((u) => u.word)), [map]);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  useEffect(() => {
    if (tips || asked.current) return;
    asked.current = true;
    const fallback = () => {
      const t: LiveTips = { list: fallbackTips(stats), source: "numbers" };
      setTips(t);
      onTipsRef.current?.(t);
    };
    const turns = tipsTurns(call);
    if (!turns.some((t) => t.who === "me" && t.text.trim())) return fallback();
    fetch("/api/coach/live/tips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        topic: call.topicLabel.slice(0, 100) || "Free talk",
        turns,
        stats: { words: stats.words, wpm: stats.wpm, fillers: stats.fillers, longestAnswerWords: stats.longestAnswer?.words ?? 0, callSec: stats.callSec },
      }),
    })
      .then(async (res) => {
        const d = (await res.json().catch(() => null)) as { tips?: string[] } | null;
        if (res.ok && d?.tips?.length === 3) {
          const t: LiveTips = { list: d.tips, source: "ai" };
          setTips(t);
          onTipsRef.current?.(t);
        } else fallback();
      })
      .catch(fallback);
  }, [call, mode, stats, tips]);

  const top = stats.topFillers.map(([f, n]) => `${f} ×${n}`).join(", ");
  const mine = call.turns.filter((t) => t.who === "me");

  return (
    <section aria-labelledby="live-summary-title" className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="live-summary-title" ref={heading} tabIndex={-1} className="text-xl font-bold text-white sm:text-2xl">
            How it went
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            {liveModeLabel(mode)} · {call.topicLabel}
            {call.reason === "network" && " · the connection dropped, so the call ended early"}
            {call.reason === "limit" && " · the call reached its time limit"}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {canCallAgain && (
            <button type="button" onClick={onNewCall} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-averna-primary/30 px-4 text-sm font-semibold text-white hover:bg-averna-primary/45">
              <RotateCcw aria-hidden className="h-4 w-4" /> New call
            </button>
          )}
          <Link href="/coach" className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/20 px-4 text-sm font-semibold text-white hover:bg-white/10">
            Back to AI Coach
          </Link>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Talk time" value={formatClock(stats.callSec)} sub={`you spoke ~${formatClock(stats.mySpeechSec)}`} />
        <Stat label="Your words" value={String(stats.words)} />
        <Stat label="Words a minute" value={stats.wpm != null ? String(stats.wpm) : "—"} sub={stats.wpm == null ? "needs 15 s of speech" : "of your speaking time"} />
        <Stat label="Filler words" value={String(stats.fillers)} sub={top || undefined} />
        <Stat label="Longest answer" value={stats.longestAnswer ? `${stats.longestAnswer.words} words` : "—"} />
      </dl>
      {stats.longestAnswer && <p className="text-sm italic leading-relaxed text-gray-300">“{stats.longestAnswer.text}”</p>}

      <div className="glass rounded-2xl border border-white/10 p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-base font-semibold text-white">
          <Lightbulb aria-hidden className="h-5 w-5 text-amber-300" /> 3 tips for next time
        </h3>
        {tips ? (
          <>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed text-gray-200">
              {tips.list.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
              <Sparkles aria-hidden className="h-3.5 w-3.5" />
              {tips.source === "ai" ? "Written by AI from your transcript." : "Based on your numbers."}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-400" role="status">
            Writing your tips…
          </p>
        )}
        <p className="mt-3 text-sm text-gray-300">
          {call.server ? (call.server.xp > 0 ? <span className="font-semibold text-averna-neon">+{call.server.xp} XP</span> : call.server.xpNote ?? "No XP for this call.") : "The call couldn't be saved, so no XP this time."}
        </p>
      </div>

      <div className="glass rounded-2xl border border-white/10 p-4 sm:p-5">
        <h3 className="text-base font-semibold text-white">Pronunciation map</h3>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-gray-300">
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <span>Based on how clearly the speech recogniser heard each word — not a phonetic test. Noise and unusual words lower it too.</span>
        </p>
        {!map.hasLogprobs && (
          <p className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300">
            Clarity scores weren&apos;t available for this call, so only sound tips are shown.
          </p>
        )}

        {mine.length > 0 && (
          <details className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3" open={mine.length <= 6}>
            <summary className="flex min-h-[44px] cursor-pointer items-center text-sm font-semibold text-white">Your words in this call</summary>
            <ol className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
              {mine.map((t) => (
                <li key={t.id} className="text-[15px] leading-relaxed text-gray-200">
                  {markTranscript(t.text, unclearSet).map((p, i) =>
                    p.unclear ? (
                      <span key={i} className="underline decoration-amber-400 decoration-dotted decoration-2 underline-offset-4">
                        {p.text}
                        <span className="sr-only"> (unclear)</span>
                      </span>
                    ) : (
                      <span key={i}>{p.text}</span>
                    ),
                  )}
                </li>
              ))}
            </ol>
            {map.unclear.length > 0 && (
              <p className="mt-2 text-xs text-gray-400">
                <span className="underline decoration-amber-400 decoration-dotted decoration-2 underline-offset-4">Dotted underline</span> = the recogniser wasn&apos;t sure about that word.
              </p>
            )}
          </details>
        )}

        <h4 className="mt-4 text-sm font-semibold text-white">Words to practise</h4>
        <div className="mt-2">
          <PractiseWords items={map.practise} />
        </div>
      </div>

      <p className={cn("flex items-start gap-1.5 text-xs leading-relaxed text-gray-400")}>
        <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Privacy: no audio is stored. Your transcript stays in this browser; only its text is sent once to write the tips. Said-word checks are transcribed and not kept.
        </span>
      </p>
    </section>
  );
}
