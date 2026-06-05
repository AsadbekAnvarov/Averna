"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Volume2, VolumeX, ArrowLeft, Brain, Coffee, Timer } from "lucide-react";

type Mode = "focus" | "short" | "long";

const DURATIONS: Record<Mode, number> = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
};

const MODE_META: Record<Mode, { label: string; icon: typeof Brain; color: string; ring: string }> = {
  focus: { label: "Focus", icon: Brain, color: "text-averna-cyan", ring: "#22d3ee" },
  short: { label: "Short Break", icon: Coffee, color: "text-averna-neon", ring: "#00ff94" },
  long: { label: "Long Break", icon: Coffee, color: "text-averna-purple", ring: "#a855f7" },
};

const TIPS = [
  "Put your phone in another room while you focus.",
  "One task at a time — close every other tab.",
  "Drink some water and sit up straight.",
  "Read the question twice before you answer.",
  "After this session, reward yourself with a short break.",
];

function fmt(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function FocusPage() {
  const [mode, setMode] = useState<Mode>("focus");
  const [timeLeft, setTimeLeft] = useState(DURATIONS.focus);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [task, setTask] = useState("");
  const [soundOn, setSoundOn] = useState(false);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const total = DURATIONS[mode];
  const progress = 1 - timeLeft / total;

  // Countdown
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, mode]);

  const playChime = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.85);
      osc.onended = () => ctx.close();
    } catch {
      /* ignore */
    }
  }, []);

  // Handle session completion
  useEffect(() => {
    if (timeLeft !== 0 || !running) return;
    setRunning(false);
    playChime();
    if (mode === "focus") {
      const next = completed + 1;
      setCompleted(next);
      const nextMode: Mode = next % 4 === 0 ? "long" : "short";
      setMode(nextMode);
      setTimeLeft(DURATIONS[nextMode]);
    } else {
      setMode("focus");
      setTimeLeft(DURATIONS.focus);
    }
  }, [timeLeft, running, mode, completed, playChime]);

  // Ambient brown-noise generator (no audio assets needed)
  const startNoise = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = audioCtxRef.current ?? new Ctx();
      audioCtxRef.current = ctx;

      const bufferSize = 2 * ctx.sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // brown noise: integrate white noise for a softer, rain-like sound
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1000;

      const gain = ctx.createGain();
      gain.gain.value = 0.18;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();

      noiseNodeRef.current = src;
      gainRef.current = gain;
    } catch {
      /* ignore */
    }
  }, []);

  const stopNoise = useCallback(() => {
    try {
      noiseNodeRef.current?.stop();
      noiseNodeRef.current?.disconnect();
      noiseNodeRef.current = null;
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSound = () => {
    if (soundOn) {
      stopNoise();
      setSoundOn(false);
    } else {
      startNoise();
      setSoundOn(true);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopNoise();
      audioCtxRef.current?.close().catch(() => {});
    };
  }, [stopNoise]);

  const switchMode = (m: Mode) => {
    setRunning(false);
    setMode(m);
    setTimeLeft(DURATIONS[m]);
  };

  const reset = () => {
    setRunning(false);
    setTimeLeft(DURATIONS[mode]);
  };

  const meta = MODE_META[mode];
  const R = 130;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - progress);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Timer className="h-8 w-8 text-averna-cyan" />
          Focus <span className="neon-text-cyan">Mode</span>
        </h1>
        <p className="text-gray-400 mb-8">
          Study in calm, distraction-free sprints. Work 25 minutes, then take a short break.
        </p>

        {/* Mode switcher */}
        <div className="flex justify-center gap-2 mb-8">
          {(Object.keys(MODE_META) as Mode[]).map((m) => {
            const Icon = MODE_META[m].icon;
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${
                  active
                    ? "bg-white/10 border-averna-cyan/50 text-white"
                    : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" /> {MODE_META[m].label}
              </button>
            );
          })}
        </div>

        {/* Timer ring */}
        <div className="flex flex-col items-center">
          <div className="relative h-72 w-72">
            <svg viewBox="0 0 300 300" className="h-full w-full -rotate-90">
              <circle cx="150" cy="150" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
              <circle
                cx="150"
                cy="150"
                r={R}
                fill="none"
                stroke={meta.ring}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-6xl font-bold tabular-nums ${meta.color}`}>{fmt(timeLeft)}</span>
              <span className="text-sm text-gray-400 mt-2">{meta.label} session</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 mt-8">
            <Button
              onClick={() => setRunning((r) => !r)}
              className="neon-button bg-averna-primary hover:bg-averna-light px-8"
              size="lg"
            >
              {running ? <Pause className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />}
              {running ? "Pause" : "Start"}
            </Button>
            <Button onClick={reset} variant="outline" size="lg" className="border-white/20">
              <RotateCcw className="h-5 w-5" />
            </Button>
            <Button
              onClick={toggleSound}
              variant="outline"
              size="lg"
              className={soundOn ? "border-averna-cyan/50 text-averna-cyan" : "border-white/20"}
              title="Ambient sound"
            >
              {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </Button>
          </div>

          {/* Session counter */}
          <div className="flex items-center gap-2 mt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full ${
                  i < completed % 4 || (completed > 0 && completed % 4 === 0)
                    ? "bg-averna-neon"
                    : "bg-white/15"
                }`}
              />
            ))}
            <span className="text-sm text-gray-400 ml-2">{completed} focus sessions done</span>
          </div>
        </div>

        {/* Task + tip */}
        <div className="mt-10 space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">What are you focusing on?</label>
            <input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="e.g. Reading Test 3, Writing Task 2…"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-cyan"
            />
          </div>
          <div className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-averna-purple/10 to-averna-cyan/10 border border-averna-purple/20">
            <Brain className="h-5 w-5 text-averna-purple shrink-0 mt-0.5" />
            <p className="text-sm text-gray-300">
              <span className="font-semibold text-averna-cyan">Tip:</span> {tip}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
