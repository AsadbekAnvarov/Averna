"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Check, ArrowRight, Sparkles } from "lucide-react";

const STORAGE_KEY = "averna_missions_v1";

interface Mission {
  id: string;
  title: string;
  detail: string;
  xp: number;
  href: string;
}

/**
 * F6 — AI Missions (client). Shows today's personalised missions with a local
 * daily check-off and XP tally. Resets each day. Completion is a personal
 * tracker (client-side), not a server points mutation.
 */
export function AiMissions({ date, missions }: { date: string; missions: Mission[] }) {
  const [done, setDone] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.date === date && Array.isArray(parsed.done)) setDone(parsed.done);
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, [date]);

  const toggle = (id: string) => {
    setDone((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ date, done: next }));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const completed = done.filter((id) => missions.some((m) => m.id === id));
  const xpEarned = missions.filter((m) => completed.includes(m.id)).reduce((s, m) => s + m.xp, 0);
  const allDone = loaded && completed.length === missions.length && missions.length > 0;

  return (
    <Card className="glass border-averna-neon/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-12 -left-12 h-44 w-44 rounded-full bg-averna-neon/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-averna-neon">
            <Target className="h-5 w-5" /> Today&apos;s Missions
          </span>
          <span className="text-xs font-normal text-gray-400">
            {completed.length}/{missions.length} · {xpEarned} XP
          </span>
        </CardTitle>
        <p className="text-xs text-gray-400">Personalised to your skills — a fresh set every day</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {missions.map((m) => {
          const isDone = completed.includes(m.id);
          return (
            <div
              key={m.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                isDone ? "border-averna-neon/40 bg-averna-neon/5" : "border-white/10 bg-white/5"
              }`}
            >
              <button
                onClick={() => toggle(m.id)}
                aria-label={isDone ? "Mark as not done" : "Mark as done"}
                className={`h-6 w-6 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                  isDone ? "bg-averna-neon border-averna-neon text-black" : "border-white/20 text-transparent hover:border-averna-neon/60"
                }`}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${isDone ? "text-gray-400 line-through" : "text-white"}`}>{m.title}</p>
                <p className="text-[11px] text-gray-500">{m.detail}</p>
              </div>
              <span className="text-[11px] text-averna-neon shrink-0">+{m.xp}</span>
              <Link href={m.href} aria-label="Start" className="text-gray-400 hover:text-averna-neon shrink-0">
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          );
        })}

        {allDone && (
          <p className="text-center text-sm text-averna-neon flex items-center justify-center gap-1 pt-1">
            <Sparkles className="h-4 w-4" /> All missions complete — see you tomorrow!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
