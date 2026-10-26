"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Loader2, Radio, Search, ShieldCheck, Users, X } from "lucide-react";
import { MicCheck, type MicState } from "@/components/speaking/mic-check";
import { FORMAT_INFO } from "@/lib/speaking/formats";
import { PEER_FORMATS, type PeerFormat } from "@/lib/speaking/matching";

type Phase = "idle" | "joining" | "waiting";

interface MatchStatus {
  status?: "idle" | "waiting" | "matched";
  roomId?: string;
  waitingSec?: number;
  lookingNow?: number;
  suggestAlternatives?: boolean;
  error?: string;
  code?: string;
}

export interface PeerHubProps {
  /** student: can match; staff: teacher/admin preview with the monitor link; viewer: anyone else. */
  mode: "student" | "staff" | "viewer";
  levelLabel: string | null;
  paused: boolean;
  pausedMessage: string;
  initialLooking: number;
  speakingTimeLive: boolean;
}

const POLL_MS = 3000;
const PRESENCE_MS = 15000;
const visible = () => typeof document === "undefined" || document.visibilityState === "visible";

export function PeerSpeakingHub({ mode, levelLabel, paused, pausedMessage, initialLooking, speakingTimeLive }: PeerHubProps) {
  const router = useRouter();
  const [format, setFormat] = useState<PeerFormat>("conversation");
  const [phase, setPhase] = useState<Phase>("idle");
  const [looking, setLooking] = useState(initialLooking);
  const [waitingSec, setWaitingSec] = useState(0);
  const [suggest, setSuggest] = useState(false);
  const [keepWaiting, setKeepWaiting] = useState(false);
  const [error, setError] = useState(paused ? pausedMessage : "");
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [mic, setMic] = useState<MicState>("unknown");
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  const apply = useCallback(
    (d: MatchStatus, fromWaiting: boolean) => {
      if (typeof d.lookingNow === "number") setLooking(d.lookingNow);
      if (d.status === "matched" && d.roomId) {
        if (fromWaiting) router.push(`/learning/speaking/room/${d.roomId}`);
        else setActiveRoom(d.roomId);
        return;
      }
      if (d.status === "waiting") {
        setPhase("waiting");
        setWaitingSec(d.waitingSec ?? 0);
        setSuggest(!!d.suggestAlternatives);
      } else if (d.status === "idle" && fromWaiting) {
        setPhase("idle");
      }
    },
    [router],
  );

  const poll = useCallback(async () => {
    if (!visible()) return;
    try {
      const res = await fetch("/api/speaking/match", { cache: "no-store" });
      const d: MatchStatus = await res.json();
      if (!res.ok) return;
      apply(d, phaseRef.current === "waiting");
    } catch {
      /* the next poll retries */
    }
  }, [apply]);

  // On open: resume a wait (or offer to rejoin a live room) after a reload.
  useEffect(() => {
    if (mode === "student") void poll();
  }, [mode, poll]);

  // Waiting: heartbeat + match every 3 s, only while the tab is visible. Idle: presence every 15 s.
  useEffect(() => {
    if (mode !== "student") return;
    const id = setInterval(poll, phase === "waiting" ? POLL_MS : PRESENCE_MS);
    const onVisible = () => {
      if (visible()) void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [mode, phase, poll]);

  // Leaving the page while waiting takes the student out of the queue.
  useEffect(() => {
    const leave = () => {
      if (phaseRef.current === "waiting") fetch("/api/speaking/match", { method: "DELETE", keepalive: true }).catch(() => undefined);
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, []);

  const find = async () => {
    setError("");
    setKeepWaiting(false);
    setPhase("joining");
    try {
      const res = await fetch("/api/speaking/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      const d: MatchStatus = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || "Could not start matching. Try again.");
        setPhase("idle");
        return;
      }
      apply(d, true);
    } catch {
      setError("Connection error — check your internet and try again.");
      setPhase("idle");
    }
  };

  const cancel = async () => {
    setPhase("idle");
    setSuggest(false);
    await fetch("/api/speaking/match", { method: "DELETE" }).catch(() => undefined);
  };

  const micBlocked = mic === "denied" || mic === "unsupported" || mic === "error";
  const canFind = mode === "student" && !paused && !micBlocked && phase === "idle";
  const mm = Math.floor(waitingSec / 60);
  const ss = String(waitingSec % 60).padStart(2, "0");

  return (
    <section aria-labelledby="peer-hero-title" className="av-panel rounded-2xl border border-averna-pink/30 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-averna-pink">
          <Users className="h-4 w-4" aria-hidden /> 1-on-1 speaking
        </p>
        {speakingTimeLive && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 text-[11px] font-semibold text-white">
            <Radio className="h-3 w-3" aria-hidden /> Speaking Time is live
          </span>
        )}
        <span className="ml-auto text-xs text-gray-300" aria-live="polite">
          {looking === 1 ? "1 student looking right now" : `${looking} students looking right now`}
        </span>
      </div>
      <h1 id="peer-hero-title" className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
        Speak with a partner
      </h1>
      <p className="mt-1 text-sm text-gray-300">
        Get paired with another Averna student near your level and practise out loud, with clear roles and timers.
      </p>
      {levelLabel && mode === "student" && (
        <p className="mt-2 text-sm text-averna-cyan">
          Matched around <span className="font-semibold">{levelLabel}</span>
        </p>
      )}

      {mode === "staff" && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
          <p>Students find partners here. Teachers and admins can&apos;t join the queue.</p>
          <Link
            href="/teacher/speaking"
            className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-averna-primary px-4 font-semibold text-white"
          >
            Open the peer speaking monitor
          </Link>
        </div>
      )}

      {mode === "student" && (
        <>
          <fieldset className="mt-4" disabled={phase !== "idle"}>
            <legend className="mb-2 text-sm font-medium text-white">Format</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {PEER_FORMATS.map((f) => (
                <label
                  key={f}
                  className={`flex min-h-[44px] cursor-pointer gap-3 rounded-xl border p-3 text-sm transition ${
                    format === f ? "border-averna-pink bg-averna-pink/10" : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="peer-format"
                    value={f}
                    checked={format === f}
                    onChange={() => setFormat(f)}
                    className="mt-1 accent-averna-pink"
                  />
                  <span>
                    <span className="block font-semibold text-white">
                      {FORMAT_INFO[f].title} <span className="font-normal text-gray-400">· {FORMAT_INFO[f].minutes}</span>
                    </span>
                    <span className="block text-xs text-gray-400">{FORMAT_INFO[f].text}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-4">
            <MicCheck onChange={setMic} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {phase === "idle" || phase === "joining" ? (
              <button
                type="button"
                onClick={find}
                disabled={!canFind}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-averna-pink px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {phase === "joining" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
                Find a partner
              </button>
            ) : (
              <>
                <span className="flex items-center gap-2 text-sm text-averna-pink" role="status" aria-live="polite">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Looking for a partner… {mm}:{ss}
                </span>
                <button
                  type="button"
                  onClick={cancel}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-white/20 px-4 text-sm text-white"
                >
                  <X className="h-4 w-4" aria-hidden /> Cancel
                </button>
              </>
            )}
            {activeRoom && phase === "idle" && (
              <Link href={`/learning/speaking/room/${activeRoom}`} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-averna-cyan underline">
                Rejoin your session
              </Link>
            )}
          </div>
          {micBlocked && !paused && <p className="mt-2 text-xs text-yellow-300">Sessions are voice only, so a working microphone is needed.</p>}
          {error && (
            <p className="mt-2 text-sm text-red-300" role="alert">
              {error}
            </p>
          )}

          {phase === "waiting" && suggest && !keepWaiting && (
            <div className="mt-4 rounded-xl border border-averna-cyan/30 bg-averna-cyan/5 p-4" role="status">
              <p className="text-sm text-white">No partner yet. Want to practise another way while you wait?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/learning/examiner" className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-white/20 px-4 text-sm text-white">
                  <Bot className="h-4 w-4" aria-hidden /> AI Examiner
                </Link>
                <Link href="/learning/speaking/solo" className="inline-flex min-h-[44px] items-center rounded-lg border border-white/20 px-4 text-sm text-white">
                  Practise alone
                </Link>
                <button type="button" onClick={() => setKeepWaiting(true)} className="inline-flex min-h-[44px] items-center rounded-lg px-4 text-sm text-averna-cyan">
                  Keep waiting
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <p className="mt-4 flex items-start gap-2 text-xs text-gray-400">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
        Voice only. Your partner sees just your first name and level. Nothing is recorded.
      </p>
    </section>
  );
}
