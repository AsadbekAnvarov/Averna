"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Headphones, Play, Pause, Square, Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { tashkentDateKey } from "@/lib/utils";

const CACHE_KEY = "averna_podcast_v1";

interface Episode {
  title: string;
  script: string;
  bullets: string[];
  focusArea: string;
  dateLabel: string;
}

type PlayState = "idle" | "playing" | "paused";

/**
 * Daily AI Podcast — a short, personalised ~90-second English "episode" focused
 * on the student's weakest skill, generated fresh each day. Plays as audio via
 * the browser's SpeechSynthesis API (no audio infra needed) with a readable
 * transcript. A gentle daily reason to come back. Episode text comes from
 * GPT-4o (with a templated fallback) and is cached per day.
 */
export function DailyPodcast() {
  const [loading, setLoading] = useState(false);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [playState, setPlayState] = useState<PlayState>("idle");
  const [supported, setSupported] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const today = tashkentDateKey();

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.date === today && parsed?.data) setEpisode(parsed.data as Episode);
      }
    } catch {
      /* ignore */
    }
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [today]);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/learning/podcast");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setEpisode(data as Episode);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ date: today, data }));
      } catch {
        /* ignore */
      }
    } catch (e: any) {
      toast.error(e.message || "Couldn't generate today's episode.");
    } finally {
      setLoading(false);
    }
  };

  const play = () => {
    if (!episode || !supported) return;
    const synth = window.speechSynthesis;
    if (playState === "paused") {
      synth.resume();
      setPlayState("playing");
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(episode.script);
    u.rate = 1;
    u.pitch = 1;
    const enVoice = synth.getVoices().find((v) => /^en/i.test(v.lang));
    if (enVoice) u.voice = enVoice;
    u.onend = () => setPlayState("idle");
    u.onerror = () => setPlayState("idle");
    synth.speak(u);
    setPlayState("playing");
  };

  const pause = () => {
    if (!supported) return;
    window.speechSynthesis.pause();
    setPlayState("paused");
  };

  const stop = () => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setPlayState("idle");
  };

  return (
    <Card className="glass border-averna-purple/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-averna-purple/10 blur-3xl" />
      <CardContent className="py-5 relative">
        {!episode ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 font-semibold text-white">
                <Headphones className="h-5 w-5 text-averna-purple" /> Averna Daily
              </p>
              <p className="text-sm text-gray-400 mt-0.5">
                Your personal ~90-second episode, focused on your weakest skill today.
              </p>
            </div>
            <Button onClick={generate} disabled={loading} className="shrink-0 neon-button bg-averna-purple hover:bg-averna-purple/80 text-white">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {loading ? "Recording…" : "Play today's episode"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-averna-purple">
                  <Headphones className="h-3.5 w-3.5" /> Averna Daily · {episode.focusArea}
                </p>
                <p className="text-lg font-bold text-white leading-tight mt-0.5">{episode.title}</p>
                <p className="text-[11px] text-gray-500">{episode.dateLabel}</p>
              </div>

              {/* Player controls */}
              {supported ? (
                <div className="flex items-center gap-2 shrink-0">
                  {playState === "playing" ? (
                    <button onClick={pause} aria-label="Pause" className="h-10 w-10 rounded-full bg-averna-purple/20 border border-averna-purple/40 flex items-center justify-center text-averna-purple hover:bg-averna-purple/30">
                      <Pause className="h-5 w-5" />
                    </button>
                  ) : (
                    <button onClick={play} aria-label="Play" className="h-10 w-10 rounded-full bg-averna-purple text-white flex items-center justify-center hover:bg-averna-purple/80">
                      <Play className="h-5 w-5" />
                    </button>
                  )}
                  {playState !== "idle" && (
                    <button onClick={stop} aria-label="Stop" className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white">
                      <Square className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-[11px] text-gray-500 shrink-0 max-w-[40%] text-right">
                  Audio isn&apos;t supported here — read the transcript below.
                </span>
              )}
            </div>

            {/* Takeaways */}
            {episode.bullets.length > 0 && (
              <ul className="space-y-1">
                {episode.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-200">
                    <span className="text-averna-purple mt-0.5">•</span> {b}
                  </li>
                ))}
              </ul>
            )}

            {/* Transcript */}
            <button
              onClick={() => setShowTranscript((s) => !s)}
              className="text-[11px] text-averna-cyan hover:underline inline-flex items-center gap-1"
            >
              {showTranscript ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showTranscript ? "Hide transcript" : "Show transcript"}
            </button>
            {showTranscript && (
              <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed rounded-lg bg-white/5 border border-white/10 p-3">
                {episode.script}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
