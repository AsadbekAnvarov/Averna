"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Mic, RotateCcw, Square, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnswerRecorder, recorderProblemOf } from "@/lib/ielts/recorder";
import type { PractiseWord } from "@/lib/realtime/pronunciation-map";

const SAY_MS = 2_500;
const BTN =
  "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/20 px-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon disabled:opacity-50";

/** Hear a word with the browser's own English voice (no paid text-to-speech). */
function hear(word: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(word);
  const voices = synth.getVoices();
  const voice = voices.find((v) => v.lang === "en-GB") ?? voices.find((v) => v.lang === "en-US") ?? voices.find((v) => v.lang?.startsWith("en"));
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? "en-GB";
  u.rate = 0.85;
  synth.speak(u);
  return true;
}

type CheckState =
  | { kind: "idle" }
  | { kind: "recording" }
  | { kind: "checking" }
  | { kind: "clear" }
  | { kind: "again"; heard: string }
  | { kind: "error"; text: string };

function WordRow({ item, recorder, busy, setBusy }: { item: PractiseWord; recorder: () => AnswerRecorder; busy: string | null; setBusy: (w: string | null) => void }) {
  const [state, setState] = useState<CheckState>({ kind: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canHear, setCanHear] = useState(true);
  useEffect(() => {
    setCanHear(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const stopAndCheck = async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const rec = recorder();
    setState({ kind: "checking" });
    const take = await rec.stop();
    rec.release();
    if (!take.blob.size) {
      setBusy(null);
      setState({ kind: "error", text: "Nothing was recorded. Try again." });
      return;
    }
    try {
      const res = await fetch(`/api/coach/live/word?word=${encodeURIComponent(item.word)}`, {
        method: "POST",
        headers: { "Content-Type": take.mimeType || "application/octet-stream" },
        body: take.blob,
      });
      const d = (await res.json().catch(() => null)) as { clear?: boolean; heard?: string; error?: string } | null;
      if (!res.ok || !d) setState({ kind: "error", text: d?.error || "The check didn't come through. Try again." });
      else setState(d.clear ? { kind: "clear" } : { kind: "again", heard: d.heard ?? "" });
    } catch {
      setState({ kind: "error", text: "Couldn't reach Averna. Check your connection." });
    } finally {
      setBusy(null);
    }
  };

  const say = async () => {
    if (state.kind === "recording") return void stopAndCheck();
    if (busy) return;
    setBusy(item.word);
    const rec = recorder();
    rec.primeAudio();
    try {
      await rec.open();
    } catch (e) {
      setBusy(null);
      const p = recorderProblemOf(e);
      setState({ kind: "error", text: p === "not-allowed" ? "The microphone is blocked. Allow it in the site settings." : "The microphone isn't available here." });
      return;
    }
    if (!rec.start()) {
      rec.release();
      setBusy(null);
      setState({ kind: "error", text: "Recording couldn't start. Try again." });
      return;
    }
    setState({ kind: "recording" });
    timer.current = setTimeout(() => void stopAndCheck(), SAY_MS);
  };

  const scorePct = item.score != null ? Math.round(item.score * 100) : null;
  return (
    <li className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold text-white">
            {item.word}
            {item.unclear && (
              <span className="ml-2 rounded-full border border-amber-400/40 px-2 py-0.5 align-middle text-[11px] font-medium text-amber-300">
                Unclear{scorePct != null ? ` · heard ${scorePct}%` : ""}
              </span>
            )}
          </p>
          {item.tip && (
            <p className="mt-1 text-sm leading-snug text-gray-300">
              <span className="font-semibold text-averna-cyan">Tip · {item.tip.label}:</span> {item.tip.detail}
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className={BTN} onClick={() => hear(item.word)} disabled={!canHear} aria-label={`Hear “${item.word}”`}>
          <Volume2 aria-hidden className="h-4 w-4" /> Hear it
        </button>
        <button
          type="button"
          className={cn(BTN, state.kind === "recording" && "border-red-400/60 text-red-300")}
          onClick={() => void say()}
          disabled={state.kind === "checking" || (!!busy && busy !== item.word)}
          aria-label={state.kind === "recording" ? `Stop recording “${item.word}”` : `Say “${item.word}”`}
        >
          {state.kind === "recording" ? <Square aria-hidden className="h-4 w-4" /> : state.kind === "checking" ? <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" /> : <Mic aria-hidden className="h-4 w-4" />}
          {state.kind === "recording" ? "Stop" : state.kind === "checking" ? "Checking…" : "Say it"}
        </button>
        <p role="status" aria-live="polite" className="min-w-0 text-sm">
          {state.kind === "clear" && (
            <span className="inline-flex items-center gap-1 font-semibold text-averna-neon">
              <CheckCircle2 aria-hidden className="h-4 w-4" /> Clear ✓
            </span>
          )}
          {state.kind === "again" && (
            <span className="inline-flex flex-wrap items-center gap-1 text-amber-300">
              <RotateCcw aria-hidden className="h-4 w-4" /> Try again{state.heard ? ` — it heard “${state.heard}”` : ""}
            </span>
          )}
          {state.kind === "recording" && <span className="text-gray-300">Say the word now…</span>}
          {state.kind === "error" && <span className="text-gray-300">{state.text}</span>}
        </p>
      </div>
    </li>
  );
}

/** "Words to practise": tap a word to hear it, then say it and get "Clear ✓" / "Try again". */
export function PractiseWords({ items }: { items: PractiseWord[] }) {
  const rec = useRef<AnswerRecorder | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(
    () => () => {
      rec.current?.dispose();
      rec.current = null;
    },
    [],
  );
  const recorder = () => (rec.current ??= new AnswerRecorder());
  if (!items.length) return <p className="text-sm text-gray-400">No words to practise from this call. Talk a little longer next time.</p>;
  return (
    <ul className="grid gap-2 md:grid-cols-2">
      {items.map((w) => (
        <WordRow key={w.word} item={w} recorder={recorder} busy={busy} setBusy={setBusy} />
      ))}
    </ul>
  );
}
