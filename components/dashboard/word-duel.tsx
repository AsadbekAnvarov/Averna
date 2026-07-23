"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { DECKS, type Flashcard } from "@/lib/flashcards-data";
import { tashkentDateKey } from "@/lib/utils";
import { fireConfetti } from "@/lib/confetti";
import { Swords, Ghost, Timer, Flame, Trophy, RotateCcw, CalendarDays } from "lucide-react";

const STORAGE_KEY = "averna_wordduel_v1";
const DUEL_LEN = 10;

interface DayRecord {
  bestCorrect: number;
  bestMs: number;
  splits: number[];
  attempts: number;
}
interface DuelStore {
  byDay: Record<string, DayRecord>;
  streak: number;
  lastDate: string;
}

interface Question {
  card: Flashcard;
  options: string[];
}

type Phase = "idle" | "play" | "done";

const ALL_CARDS: Flashcard[] = DECKS.flatMap((d) => d.cards);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Seeded RNG so everyone gets the same word set on a given day.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dailyCards(dateKey: string): Flashcard[] {
  const seed = Number(dateKey.replaceAll("-", "")) || 1;
  const rnd = mulberry32(seed);
  const idxs = ALL_CARDS.map((_, i) => i);
  // seeded Fisher-Yates
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  return idxs.slice(0, DUEL_LEN).map((i) => ALL_CARDS[i]);
}

function daysBetween(a: string, b: string) {
  const da = new Date(`${a}T00:00:00+05:00`).getTime();
  const db = new Date(`${b}T00:00:00+05:00`).getTime();
  return Math.round((db - da) / 86_400_000);
}

/**
 * Word Duel vs Ghost of the Day — a daily challenge. Everyone gets the same
 * deterministic set of 10 words for the day (seeded by the date). You duel a
 * translucent "ghost" that replays the pace of your best attempt today; beat it
 * to set a new daily record. Builds a daily-challenge streak. Fully client-side;
 * reuses the DECKS vocabulary and stores per-day records in localStorage.
 */
export function WordDuel() {
  const [loaded, setLoaded] = useState(false);
  const [store, setStore] = useState<DuelStore>({ byDay: {}, streak: 0, lastDate: "" });
  const [phase, setPhase] = useState<Phase>("idle");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<{ correct: number; ms: number; isNewBest: boolean } | null>(null);

  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const splitsRef = useRef<number[]>([]);
  const mounted = useRef(true);

  const today = tashkentDateKey();
  const todayRec = store.byDay[today];

  useEffect(() => {
    mounted.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setStore(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setLoaded(true);
    return () => {
      mounted.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const buildQuestions = useCallback((): Question[] => {
    const cards = dailyCards(today);
    return cards.map((card) => {
      const distractors = shuffle(ALL_CARDS.filter((c) => c.word !== card.word)).slice(0, 3).map((c) => c.word);
      return { card, options: shuffle([card.word, ...distractors]) };
    });
  }, [today]);

  const loop = useCallback(() => {
    if (!mounted.current) return;
    setElapsed(performance.now() - startRef.current);
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const start = () => {
    splitsRef.current = [];
    setQuestions(buildQuestions());
    setIdx(0);
    setCorrect(0);
    setPicked(null);
    setLocked(false);
    setElapsed(0);
    setResult(null);
    setPhase("play");
    startRef.current = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
  };

  const finish = useCallback(
    (finalCorrect: number, ms: number, splits: number[]) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const prev = store.byDay[today];
      const isNewBest =
        !prev || finalCorrect > prev.bestCorrect || (finalCorrect === prev.bestCorrect && ms < prev.bestMs);

      const dayRec: DayRecord = {
        bestCorrect: prev ? Math.max(prev.bestCorrect, finalCorrect) : finalCorrect,
        bestMs: isNewBest ? ms : prev!.bestMs,
        splits: isNewBest ? splits : prev!.splits,
        attempts: (prev?.attempts ?? 0) + 1,
      };

      // daily streak (counts one completion per day)
      let streak = store.streak;
      let lastDate = store.lastDate;
      if (store.lastDate !== today) {
        const gap = store.lastDate ? daysBetween(store.lastDate, today) : 999;
        streak = gap === 1 ? store.streak + 1 : 1;
        lastDate = today;
      }

      // prune to the most recent 30 days
      const byDay = { ...store.byDay, [today]: dayRec };
      const keys = Object.keys(byDay).sort();
      while (keys.length > 30) delete byDay[keys.shift()!];

      const next: DuelStore = { byDay, streak, lastDate };
      setStore(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }

      if (isNewBest) {
        fireConfetti();
        toast.success(prev ? "New daily record! 👻⚡" : "Daily ghost set — beat it! 👻");
      }
      setResult({ correct: finalCorrect, ms, isNewBest });
      setPhase("done");
    },
    [store, today],
  );

  const choose = (opt: string) => {
    if (locked) return;
    setLocked(true);
    setPicked(opt);
    const q = questions[idx];
    const isRight = opt === q.card.word;
    let nextCorrect = correct;
    if (isRight) {
      nextCorrect = correct + 1;
      splitsRef.current = [...splitsRef.current, performance.now() - startRef.current];
      setCorrect(nextCorrect);
    }
    timer.current = setTimeout(() => {
      if (!mounted.current) return;
      if (idx + 1 >= questions.length) {
        finish(nextCorrect, performance.now() - startRef.current, splitsRef.current);
      } else {
        setIdx((i) => i + 1);
        setPicked(null);
        setLocked(false);
      }
    }, 480);
  };

  const ghostSplits = todayRec?.splits ?? null;
  const ghostCorrect = ghostSplits ? ghostSplits.filter((s) => s <= elapsed).length : 0;
  const youPos = idx / DUEL_LEN;
  const ghostPos = ghostSplits ? Math.min(DUEL_LEN, ghostCorrect) / DUEL_LEN : 0;
  const fmt = (ms?: number) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)}s`);

  if (!loaded) {
    return (
      <Card className="glass border-averna-purple/30">
        <CardContent className="h-24" />
      </Card>
    );
  }

  // ---- Play ----
  if (phase === "play") {
    const q = questions[idx];
    return (
      <Card className="glass border-averna-purple/40">
        <CardContent className="py-5 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-averna-purple font-mono">
              <Timer className="h-4 w-4" /> {fmt(elapsed)}
            </span>
            <span className="text-xs text-gray-400">
              {idx + 1}/{DUEL_LEN} · {correct} correct
            </span>
          </div>

          {/* Duel track */}
          <div className="space-y-1.5">
            <div className="relative h-6 rounded-full bg-white/5 border border-white/10 overflow-hidden">
              <div className="absolute top-1/2 -translate-y-1/2 text-lg transition-all duration-300" style={{ left: `calc(${youPos * 88}% + 4px)` }}>
                🤺
              </div>
            </div>
            {ghostSplits ? (
              <div className="relative h-6 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                <div className="absolute top-1/2 -translate-y-1/2 text-lg opacity-60 transition-all duration-300" style={{ left: `calc(${ghostPos * 88}% + 4px)` }}>
                  👻
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-gray-500 text-center">First attempt today — set the ghost!</p>
            )}
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
            <p className="text-[11px] uppercase tracking-wider text-averna-purple mb-1">Which word means…</p>
            <p className="text-base text-white">{q.card.meaning}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {q.options.map((opt) => {
              const isAnswer = opt === q.card.word;
              let cls = "border-white/10 bg-white/5 hover:bg-white/10 text-gray-200";
              if (picked) {
                if (isAnswer) cls = "border-averna-neon/60 bg-averna-neon/15 text-averna-neon";
                else if (opt === picked) cls = "border-red-500/60 bg-red-500/15 text-red-300";
                else cls = "border-white/10 bg-white/5 text-gray-500 opacity-60";
              }
              return (
                <button
                  key={opt}
                  disabled={locked}
                  onClick={() => choose(opt)}
                  className={`text-sm font-medium rounded-lg border px-3 py-2.5 transition-all disabled:cursor-not-allowed ${cls}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Done ----
  if (phase === "done" && result) {
    return (
      <Card className={`glass ${result.isNewBest ? "border-averna-neon/50" : "border-averna-purple/40"}`}>
        <CardContent className="py-7 text-center space-y-2">
          <div className="text-5xl select-none">{result.isNewBest ? "🏆" : "👻"}</div>
          <p className={`text-2xl font-bold ${result.isNewBest ? "text-averna-neon" : "text-averna-purple"}`}>
            {result.isNewBest ? "New Daily Record!" : "Ghost held on"}
          </p>
          <p className="text-sm text-gray-300">
            {result.correct}/{DUEL_LEN} correct in {fmt(result.ms)}
          </p>
          <p className="text-xs text-gray-500">
            Today&apos;s best: {todayRec?.bestCorrect ?? result.correct}/{DUEL_LEN} · {fmt(todayRec?.bestMs ?? result.ms)} ·{" "}
            <span className="text-orange-400">{store.streak}-day streak 🔥</span>
          </p>
          <div className="flex items-center justify-center gap-3 pt-3">
            <Button onClick={start} className="neon-button bg-averna-purple hover:bg-averna-purple/80 text-white">
              <RotateCcw className="mr-2 h-4 w-4" /> Beat the ghost
            </Button>
            <Button onClick={() => setPhase("idle")} variant="outline" className="border-white/20">
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Idle ----
  return (
    <Card className="glass border-averna-purple/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-averna-purple/10 blur-3xl" />
      <CardContent className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold text-white">
            <Swords className="h-5 w-5 text-averna-purple" /> Word Duel · Ghost of the Day
          </p>
          <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> Today&apos;s {DUEL_LEN} words — same set for everyone. Beat your own ghost.
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-xs">
            {todayRec ? (
              <span className="flex items-center gap-1 text-averna-purple">
                <Trophy className="h-3.5 w-3.5 text-amber-400" /> Best {todayRec.bestCorrect}/{DUEL_LEN} · {fmt(todayRec.bestMs)}
              </span>
            ) : (
              <span className="text-gray-500">Not played today</span>
            )}
            {store.streak > 0 && (
              <span className="flex items-center gap-1 text-orange-400">
                <Flame className="h-3.5 w-3.5" /> {store.streak}-day
              </span>
            )}
          </div>
        </div>
        <Button onClick={start} className="shrink-0 neon-button bg-averna-purple hover:bg-averna-purple/80 text-white">
          <Swords className="mr-2 h-4 w-4" /> {todayRec ? "Duel again" : "Start duel"}
        </Button>
      </CardContent>
    </Card>
  );
}
