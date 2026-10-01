"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Headphones, Play } from "lucide-react";

/**
 * The result page's small shared player for a Listening test with one real
 * recording (CDI): a native <audio controls> kept in view at the bottom of
 * the answer review, and "Play from here" buttons that start it a moment
 * before the place where a question's answer is spoken. Result pages only —
 * the question times are never sent to the runner.
 */

/** Start this many seconds before the answer is spoken. */
export const PLAY_LEAD_SEC = 2;

interface PlayerApi {
  playFrom: (seconds: number, question: number) => void;
}

const PlayerContext = createContext<PlayerApi | null>(null);

export function RecordingPlayerProvider({ url, children }: { url: string; children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [question, setQuestion] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const playFrom = useCallback((seconds: number, n: number) => {
    const el = audioRef.current;
    if (!el) return;
    const at = Math.max(0, seconds - PLAY_LEAD_SEC);
    setQuestion(n);
    setFailed(false);
    try {
      // Before the metadata is in, this sets where playback will start.
      el.currentTime = at;
    } catch {
      /* applied on loadedmetadata below */
    }
    if (el.readyState < 1) {
      el.addEventListener(
        "loadedmetadata",
        () => {
          if (Math.abs(el.currentTime - at) > 1) el.currentTime = at;
        },
        { once: true }
      );
    }
    // Synchronous play() inside the tap (mobile autoplay rules).
    try {
      const p = el.play();
      if (p && typeof p.catch === "function") {
        p.catch((e: unknown) => {
          if ((e as { name?: unknown } | null)?.name !== "AbortError") setFailed(true);
        });
      }
    } catch {
      setFailed(true);
    }
  }, []);

  const api = useMemo(() => ({ playFrom }), [playFrom]);

  return (
    <PlayerContext.Provider value={api}>
      {children}
      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 mt-4 lg:bottom-4 print:hidden">
        <div role="region" aria-label="Test recording" className="av-panel rounded-2xl border border-white/10 p-3 shadow-lg sm:p-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
            <Headphones className="h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
            Recording
            {question != null && <span className="font-normal normal-case tracking-normal text-gray-300">· from question {question}</span>}
          </p>
          <audio
            ref={audioRef}
            src={url}
            controls
            preload="none"
            className="h-10 w-full"
            data-testid="result-recording"
            onPlaying={() => setFailed(false)}
            onError={(e) => {
              if (e.currentTarget.error?.code !== 1) setFailed(true);
            }}
          >
            Your browser can&apos;t play this recording.
          </audio>
          {failed && (
            <p role="alert" className="mt-2 text-sm text-red-200">
              The recording could not be loaded. Check your connection and try again.
            </p>
          )}
        </div>
      </div>
    </PlayerContext.Provider>
  );
}

/** "Play from here" for one question (nothing outside a RecordingPlayerProvider). */
export function PlayFromHere({ question, seconds }: { question: number; seconds: number }) {
  const api = useContext(PlayerContext);
  if (!api || !Number.isFinite(seconds) || seconds < 0) return null;
  return (
    <button
      type="button"
      onClick={() => api.playFrom(seconds, question)}
      aria-label={`Play the recording from question ${question}`}
      className="glow-hover mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-averna-cyan/30 bg-averna-cyan/[0.06] px-3 text-xs font-semibold text-averna-cyan transition hover:bg-averna-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-cyan/60 print:hidden"
    >
      <Play className="h-3.5 w-3.5" aria-hidden />
      Play from here
    </button>
  );
}
