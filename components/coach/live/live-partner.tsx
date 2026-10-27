"use client";

import { useCallback, useEffect, useState } from "react";
import { MIN_CALL_SECONDS } from "@/lib/realtime/limits";
import { isLiveMode, type LiveMode } from "@/lib/realtime/modes";
import { LiveCallScreen } from "./live-call-screen";
import { LiveSetup, LiveUnavailable, type LiveChoice, type LiveTopicOption } from "./live-setup";
import { LiveSummary, type LiveTips } from "./live-summary";
import { primeLiveAudio, type EndedCall } from "./use-live-call";

/** The last summary, for this tab only (survives a reload, gone with the tab). */
export const LIVE_SUMMARY_KEY = "averna_live_summary_v1";
const SUMMARY_TTL_MS = 6 * 3600_000;

interface StoredSummary {
  v: 1;
  at: number;
  mode: LiveMode;
  call: EndedCall;
  tips: LiveTips | null;
}

function readSummary(): StoredSummary | null {
  try {
    const raw = sessionStorage.getItem(LIVE_SUMMARY_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSummary;
    if (s?.v !== 1 || !isLiveMode(s.mode) || !Array.isArray(s.call?.turns) || !s.call?.stats || Date.now() - s.at > SUMMARY_TTL_MS) return null;
    return s;
  } catch {
    return null;
  }
}

function writeSummary(s: StoredSummary | null) {
  try {
    if (s) sessionStorage.setItem(LIVE_SUMMARY_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(LIVE_SUMMARY_KEY);
  } catch {
    /* storage full or blocked: the summary still shows until the tab closes */
  }
}

type View = { kind: "setup" } | { kind: "call"; choice: LiveChoice; key: number } | { kind: "summary"; summary: StoredSummary };

/**
 * Live speaking partner (docs/elegance-roadmap.md, idea 3): setup → call → "How it went".
 * Without an OpenAI key it shows only the "isn't available" card with a link to the
 * AI Examiner.
 */
export function LivePartner({
  available,
  topics,
  limits,
  remainingSec: initialRemaining,
}: {
  available: boolean;
  topics: Record<LiveMode, LiveTopicOption[]>;
  limits: { studentSecondsPerDay: number; maxCallSeconds: number };
  remainingSec: number | null;
}) {
  const [view, setView] = useState<View>({ kind: "setup" });
  const [remaining, setRemaining] = useState<number | null>(initialRemaining);
  const [last, setLast] = useState<LiveChoice | undefined>(undefined);

  useEffect(() => {
    if (!available) return;
    const saved = readSummary();
    if (saved) setView({ kind: "summary", summary: saved });
  }, [available]);

  const start = useCallback((choice: LiveChoice) => {
    primeLiveAudio();
    setLast(choice);
    setView({ kind: "call", choice, key: Date.now() });
  }, []);

  const ended = useCallback(
    (call: EndedCall) => {
      const mode = view.kind === "call" ? view.choice.mode : (last?.mode ?? "casual");
      const summary: StoredSummary = { v: 1, at: Date.now(), mode, call, tips: null };
      writeSummary(summary);
      if (call.server) setRemaining(call.server.remainingSec);
      setView({ kind: "summary", summary });
    },
    [last?.mode, view],
  );

  const onTips = useCallback((tips: LiveTips) => {
    setView((v) => {
      if (v.kind !== "summary") return v;
      const summary = { ...v.summary, tips };
      writeSummary(summary);
      return { kind: "summary", summary };
    });
  }, []);

  if (!available) return <LiveUnavailable />;

  if (view.kind === "call")
    return (
      <LiveCallScreen
        key={view.key}
        mode={view.choice.mode}
        topicId={view.choice.topicId}
        topicLabel={view.choice.topicLabel}
        onEnded={ended}
        onBack={() => setView({ kind: "setup" })}
      />
    );

  if (view.kind === "summary")
    return (
      <LiveSummary
        call={view.summary.call}
        mode={view.summary.mode}
        savedTips={view.summary.tips}
        onTips={onTips}
        canCallAgain={remaining == null || remaining >= MIN_CALL_SECONDS}
        onNewCall={() => {
          writeSummary(null);
          setView({ kind: "setup" });
        }}
      />
    );

  return <LiveSetup topics={topics} limits={limits} remainingSec={remaining} initial={last} onStart={start} />;
}
