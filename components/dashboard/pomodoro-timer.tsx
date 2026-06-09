"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, RotateCcw, Timer, Coffee } from "lucide-react";

type Mode = "focus" | "break";
const DURATIONS: Record<Mode, number> = { focus: 25 * 60, break: 5 * 60 };

/**
 * A self-contained Pomodoro focus timer right on the dashboard — 25 min focus
 * / 5 min break — to make study sessions calm and structured.
 */
export function PomodoroTimer() {
  const [mode, setMode] = useState<Mode>("focus");
  const [remaining, setRemaining] = useState(DURATIONS.focus);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          // session finished — switch mode
          const nextMode: Mode = mode === "focus" ? "break" : "focus";
          if (mode === "focus") setSessions((s) => s + 1);
          setMode(nextMode);
          setRunning(false);
          try {
            // gentle cue (no external asset)
            if (typeof window !== "undefined" && "AudioContext" in window) {
              const ctx = new AudioContext();
              const o = ctx.createOscillator();
              o.connect(ctx.destination);
              o.frequency.value = 660;
              o.start();
              setTimeout(() => { o.stop(); ctx.close(); }, 180);
            }
          } catch {}
          return DURATIONS[nextMode];
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, mode]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setRemaining(DURATIONS[m]);
    setRunning(false);
  };

  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");
  const pct = 100 - Math.round((remaining / DURATIONS[mode]) * 100);

  return (
    <Card className="glass border-averna-purple/30">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <Timer className="h-4 w-4 text-averna-purple" /> Focus Timer
          </p>
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => switchMode("focus")}
              className={`px-2 py-1 rounded-md ${mode === "focus" ? "bg-averna-purple/20 text-averna-purple" : "text-gray-400 hover:text-white"}`}
            >
              Focus
            </button>
            <button
              onClick={() => switchMode("break")}
              className={`px-2 py-1 rounded-md flex items-center gap-1 ${mode === "break" ? "bg-averna-cyan/20 text-averna-cyan" : "text-gray-400 hover:text-white"}`}
            >
              <Coffee className="h-3 w-3" /> Break
            </button>
          </div>
        </div>

        <div className="text-center">
          <p className="text-5xl font-bold text-white tabular-nums tracking-tight">
            {mm}:{ss}
          </p>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-3">
            <div
              className={`h-full rounded-full ${mode === "focus" ? "bg-averna-purple" : "bg-averna-cyan"}`}
              style={{ width: `${pct}%`, transition: "width 1s linear" }}
            />
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setRunning((r) => !r)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-averna-primary/80 hover:bg-averna-primary text-white text-sm font-medium transition-colors"
          >
            {running ? <><Pause className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4" /> Start</>}
          </button>
          <button
            onClick={() => { switchMode(mode); }}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-white/10 bg-white/5 text-gray-300 hover:text-white transition-colors"
            aria-label="Reset"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
        {sessions > 0 && (
          <p className="text-center text-[11px] text-gray-500 mt-3">
            🍅 {sessions} focus session{sessions === 1 ? "" : "s"} done today
          </p>
        )}
      </CardContent>
    </Card>
  );
}
