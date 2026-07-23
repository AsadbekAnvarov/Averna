"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayCircle, PauseCircle, RotateCcw, Clock, AlertTriangle, Footprints } from "lucide-react";
import type { JourneySession } from "@/lib/admin-journeys";

const STEP_MS = 850;

function fmtTime(ts: number): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" }).format(
    new Date(ts),
  );
}

/**
 * M5 — Journey Replay (player). Steps through a reconstructed session's events
 * in order with timing, highlighting the current action and flagging friction
 * moments the rules detected. Client component; data comes from the server.
 */
export function JourneyReplay({ sessions }: { sessions: JourneySession[] }) {
  const [selected, setSelected] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const session = sessions[selected];
  const total = session?.events.length ?? 0;

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
  };

  const play = () => {
    if (total === 0) return;
    setPlaying(true);
    if (cursor >= total - 1) setCursor(0);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCursor((c) => {
        if (c >= total - 1) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, STEP_MS);
  };

  const pickSession = (i: number) => {
    stop();
    setSelected(i);
    setCursor(0);
  };

  const restart = () => {
    stop();
    setCursor(0);
  };

  return (
    <Card className="glass border-averna-purple/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-purple">
          <Footprints className="h-5 w-5" /> Sessiya Repleyi
        </CardTitle>
        <p className="text-xs text-gray-400">Oʻquvchining soʻnggi sessiyalarini qadamma-qadam koʻring</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Session picker */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sessions.map((s, i) => (
            <button
              key={s.id}
              onClick={() => pickSession(i)}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-left transition-colors ${
                i === selected
                  ? "border-averna-purple/60 bg-averna-purple/15"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <span className="block text-xs font-medium text-white">{s.student}</span>
              <span className="block text-[10px] text-gray-400">
                {fmtTime(s.startTs)} · {s.eventCount} qadam
                {s.frictionCount > 0 && <span className="text-amber-300"> · {s.frictionCount}⚠</span>}
              </span>
            </button>
          ))}
        </div>

        {session && (
          <>
            {/* Controls */}
            <div className="flex items-center gap-3">
              <button onClick={playing ? stop : play} className="text-averna-purple hover:text-averna-neon transition-colors">
                {playing ? <PauseCircle className="h-8 w-8" /> : <PlayCircle className="h-8 w-8" />}
              </button>
              <button onClick={restart} className="text-gray-400 hover:text-white transition-colors" aria-label="Qayta">
                <RotateCcw className="h-5 w-5" />
              </button>
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-averna-purple to-averna-neon transition-all duration-300"
                  style={{ width: `${total ? ((cursor + 1) / total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 tabular-nums shrink-0">
                {cursor + 1}/{total}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {session.durationMin} daqiqa
              </span>
              {session.frictionCount > 0 && (
                <span className="flex items-center gap-1 text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5" /> {session.frictionCount} ta trend nuqtasi
                </span>
              )}
            </div>

            {/* Timeline */}
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {session.events.map((e, i) => {
                const active = i === cursor;
                const past = i < cursor;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-all ${
                      active
                        ? "border-averna-purple/60 bg-averna-purple/15 scale-[1.01]"
                        : past
                          ? "border-white/10 bg-white/5"
                          : "border-white/5 bg-white/[0.02] opacity-50"
                    }`}
                  >
                    <span className="text-[10px] text-gray-500 tabular-nums w-10 shrink-0">{fmtTime(e.ts)}</span>
                    <span className={`h-2 w-2 rounded-full shrink-0 ${active ? "bg-averna-neon" : past ? "bg-averna-purple" : "bg-gray-600"}`} />
                    <span className="text-sm text-white min-w-0 flex-1 truncate">{e.label}</span>
                    {e.gapMin > 0 && <span className="text-[10px] text-gray-500 shrink-0">+{e.gapMin}daq</span>}
                    {e.friction && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-300 shrink-0 whitespace-nowrap">
                        {e.friction}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
