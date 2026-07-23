"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { fireConfetti } from "@/lib/confetti";
import { Lock, Unlock, ShieldAlert, Timer, Trophy, Flame, X } from "lucide-react";

const STORAGE_KEY = "averna_focus_v1";
const GRACE_MS = 4000; // leaving the tab longer than this breaks the vault

interface FocusStore {
  totalMs: number;
  sessions: number;
  bestSessionMs: number;
}

type Phase = "idle" | "running" | "success" | "broken";

const DURATIONS = [10, 25, 50];

const RANKS = [
  { name: "Bronze Focus", hours: 0, emoji: "🥉", color: "text-amber-600" },
  { name: "Silver Focus", hours: 2, emoji: "🥈", color: "text-gray-300" },
  { name: "Gold Focus", hours: 5, emoji: "🥇", color: "text-amber-400" },
  { name: "Platinum Focus", hours: 12, emoji: "💠", color: "text-cyan-300" },
  { name: "Diamond Focus", hours: 25, emoji: "💎", color: "text-averna-cyan" },
];

function rankFor(hours: number) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (hours >= RANKS[i].hours) idx = i;
  return { current: RANKS[idx], next: RANKS[idx + 1] ?? null, idx };
}

/**
 * Focus Vault — a deep-focus timer built on loss aversion. Lock in a session;
 * if you leave the tab for more than a few seconds the vault "cracks" and the
 * session is lost. Completed sessions bank deep-focus hours that climb through
 * ranks (Bronze → Diamond Focus). Fully client-side (localStorage) and uses the
 * Page Visibility API to detect leaving.
 */
export function FocusVault() {
  const [loaded, setLoaded] = useState(false);
  const [store, setStore] = useState<FocusStore>({ totalMs: 0, sessions: 0, bestSessionMs: 0 });
  const [phase, setPhase] = useState<Phase>("idle");
  const [selectedMin, setSelectedMin] = useState(25);
  const [remaining, setRemaining] = useState(0);

  const endRef = useRef(0);
  const runMsRef = useRef(0);
  const hiddenAtRef = useRef(0);
  const storeRef = useRef(store);

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setStore(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  const persist = (next: FocusStore) => {
    setStore(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const startFocus = (min: number) => {
    runMsRef.current = min * 60_000;
    endRef.current = Date.now() + runMsRef.current;
    hiddenAtRef.current = 0;
    setSelectedMin(min);
    setRemaining(runMsRef.current);
    setPhase("running");
  };

  // Running loop + tab-leave detection
  useEffect(() => {
    if (phase !== "running") return;

    const complete = () => {
      const prev = storeRef.current;
      const next: FocusStore = {
        totalMs: prev.totalMs + runMsRef.current,
        sessions: prev.sessions + 1,
        bestSessionMs: Math.max(prev.bestSessionMs, runMsRef.current),
      };
      persist(next);
      fireConfetti();
      toast.success("Vault sealed! Deep-focus time banked 🔒");
      setPhase("success");
    };

    const breakVault = () => {
      toast.error("Vault cracked — you left the page. Session lost.");
      setPhase("broken");
    };

    const tick = () => {
      const rem = endRef.current - Date.now();
      if (rem <= 0) complete();
      else setRemaining(rem);
    };

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
      } else if (hiddenAtRef.current) {
        const away = Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = 0;
        if (away > GRACE_MS) breakVault();
      }
    };

    const iv = setInterval(tick, 250);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [phase]);

  const hours = store.totalMs / 3_600_000;
  const { current, next, idx } = useMemo(() => rankFor(hours), [hours]);
  const rankProgress = next
    ? Math.min(100, Math.round(((hours - current.hours) / (next.hours - current.hours)) * 100))
    : 100;

  const mmss = (ms: number) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };

  const totalLabel = hours >= 1 ? `${hours.toFixed(1)}h` : `${Math.round(store.totalMs / 60000)}m`;

  if (!loaded) {
    return (
      <Card className="glass border-indigo-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-300">
            <Lock className="h-5 w-5" /> Focus Vault
          </CardTitle>
        </CardHeader>
        <CardContent className="h-24" />
      </Card>
    );
  }

  // ---- Running ----
  if (phase === "running") {
    const pct = 100 - Math.round((remaining / runMsRef.current) * 100);
    return (
      <Card className="glass border-indigo-500/50 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-indigo-500/5" />
        <CardContent className="py-8 text-center relative">
          <div className="text-5xl mb-2 select-none animate-pulse">🔒</div>
          <p className="text-4xl font-bold font-mono text-indigo-200 tabular-nums">{mmss(remaining)}</p>
          <p className="text-xs text-gray-400 mt-2">Stay on this page — leaving cracks the vault.</p>

          <div className="mt-4 mx-auto max-w-xs h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-averna-cyan transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>

          <Button
            onClick={() => setPhase("broken")}
            variant="outline"
            className="mt-5 border-white/20 text-gray-400 hover:text-red-300"
          >
            <X className="mr-2 h-4 w-4" /> Give up
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ---- Success ----
  if (phase === "success") {
    return (
      <Card className="glass border-averna-neon/50">
        <CardContent className="py-8 text-center">
          <div className="text-5xl mb-2 select-none">🔐</div>
          <p className="text-2xl font-bold text-averna-neon">Vault Sealed!</p>
          <p className="text-sm text-gray-300 mt-1">
            +{selectedMin} min of deep focus banked · {totalLabel} total
          </p>
          <p className={`mt-3 text-sm font-semibold ${current.color}`}>
            {current.emoji} {current.name}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Button onClick={() => setPhase("idle")} className="neon-button bg-indigo-500 hover:bg-indigo-500/80 text-white">
              <Lock className="mr-2 h-4 w-4" /> New session
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Broken ----
  if (phase === "broken") {
    return (
      <Card className="glass border-red-500/50">
        <CardContent className="py-8 text-center">
          <div className="text-5xl mb-2 select-none">💥</div>
          <p className="text-2xl font-bold text-red-300 flex items-center justify-center gap-2">
            <ShieldAlert className="h-6 w-6" /> Vault Cracked
          </p>
          <p className="text-sm text-gray-300 mt-1">The session didn&apos;t count. Focus is a muscle — try again.</p>
          <Button
            onClick={() => setPhase("idle")}
            className="mt-5 neon-button bg-indigo-500 hover:bg-indigo-500/80 text-white"
          >
            <Unlock className="mr-2 h-4 w-4" /> Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ---- Idle ----
  return (
    <Card className="glass border-indigo-500/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-indigo-300">
          <span className="flex items-center gap-2">
            <Lock className="h-5 w-5" /> Focus Vault
          </span>
          <span className="flex items-center gap-3 text-xs font-normal text-gray-400">
            <span className="flex items-center gap-1">
              <Flame className="h-3.5 w-3.5 text-orange-400" /> {totalLabel}
            </span>
            {store.bestSessionMs > 0 && (
              <span className="flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5 text-amber-400" /> {Math.round(store.bestSessionMs / 60000)}m
              </span>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rank */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className={`font-semibold ${current.color}`}>
              {current.emoji} {current.name}
            </span>
            {next ? (
              <span className="text-[11px] text-gray-400">
                {(next.hours - hours).toFixed(1)}h to {next.emoji} {next.name}
              </span>
            ) : (
              <span className="text-[11px] text-averna-cyan">Max rank 💎</span>
            )}
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-averna-cyan transition-all duration-500"
              style={{ width: `${rankProgress}%` }}
            />
          </div>
        </div>

        <p className="text-sm text-gray-400">
          Lock in a focus session. Leave the page for more than a few seconds and the vault cracks — no credit. Finish
          to bank the time.
        </p>

        <div className="grid grid-cols-3 gap-2">
          {DURATIONS.map((m) => (
            <button
              key={m}
              onClick={() => startFocus(m)}
              className="flex flex-col items-center gap-0.5 py-3 rounded-lg border border-indigo-500/40 bg-white/5 hover:bg-indigo-500/10 transition-colors"
            >
              <Timer className="h-4 w-4 text-indigo-300" />
              <span className="text-sm font-semibold text-white">{m}m</span>
            </button>
          ))}
        </div>

        {store.sessions > 0 && (
          <p className="text-center text-[11px] text-gray-500">
            {store.sessions} session{store.sessions === 1 ? "" : "s"} sealed
          </p>
        )}
      </CardContent>
    </Card>
  );
}
