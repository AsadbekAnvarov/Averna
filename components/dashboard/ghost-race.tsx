"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { DECKS, type Flashcard } from "@/lib/flashcards-data";
import { fireConfetti } from "@/lib/confetti";
import { Flag, Ghost, Timer, Trophy, Zap, RotateCcw } from "lucide-react";

const STORAGE_KEY = "averna_ghost_v1";
const RACE_LEN = 10; // correct answers needed to finish a lap

type GhostStore = Record<string, { bestMs: number; splits: number[] }>;

interface Question {
  card: Flashcard;
  options: string[]; // words
}

type Phase = "idle" | "race" | "done";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ALL_CARDS: Flashcard[] = DECKS.flatMap((d) => d.cards);

interface DeckChoice {
  id: string;
  name: string;
  emoji: string;
  cards: Flashcard[];
}

const DECK_CHOICES: DeckChoice[] = [
  { id: "all", name: "All words", emoji: "🌐", cards: ALL_CARDS },
  ...DECKS.map((d) => ({ id: d.id, name: d.name, emoji: d.emoji, cards: d.cards })),
];

/**
 * Ghost Race — a timed vocabulary sprint where you race the "ghost" of your own
 * previous best run. Answer definitions correctly to sprint down the track; a
 * translucent ghost replays the exact pace of your record so you can see, in
 * real time, whether you're ahead or behind your past self. Beat the ghost to
 * set a new record.
 *
 * Fully client-side: reuses the vocabulary in lib/flashcards-data.ts and stores
 * best-run splits in localStorage. No backend, no test-runner changes.
 */
export function GhostRace() {
  const [loaded, setLoaded] = useState(false);
  const [store, setStore] = useState<GhostStore>({});
  const [deckId, setDeckId] = useState("all");

  const [phase, setPhase] = useState<Phase>("idle");
  const [q, setQ] = useState<Question | null>(null);
  const [correct, setCorrect] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [result, setResult] = useState<{ ms: number; prevMs?: number; beat: boolean } | null>(null);

  const startRef = useRef(0);
  const splitsRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const mounted = useRef(true);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deck = useMemo(() => DECK_CHOICES.find((d) => d.id === deckId) ?? DECK_CHOICES[0], [deckId]);
  const ghostSplits = store[deckId]?.splits ?? null;
  const bestMs = store[deckId]?.bestMs;

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
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  const buildQuestion = useCallback(
    (prevWord?: string): Question => {
      const pool = deck.cards;
      const candidates = pool.length > 1 && prevWord ? pool.filter((c) => c.word !== prevWord) : pool;
      const card = candidates[Math.floor(Math.random() * candidates.length)];
      const distractors = shuffle(pool.filter((c) => c.word !== card.word))
        .slice(0, 3)
        .map((c) => c.word);
      const options = shuffle([card.word, ...distractors]);
      return { card, options };
    },
    [deck],
  );

  const stopLoop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const loop = useCallback(() => {
    if (!mounted.current) return;
    setElapsed(performance.now() - startRef.current);
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const startRace = useCallback(() => {
    splitsRef.current = [];
    setCorrect(0);
    setElapsed(0);
    setPicked(null);
    setLocked(false);
    setResult(null);
    setQ(buildQuestion());
    setPhase("race");
    startRef.current = performance.now();
    stopLoop();
    rafRef.current = requestAnimationFrame(loop);
  }, [buildQuestion, loop]);

  const finish = useCallback(
    (ms: number, splits: number[]) => {
      stopLoop();
      const prev = store[deckId];
      const beat = !prev || ms < prev.bestMs;
      if (beat) {
        const next: GhostStore = { ...store, [deckId]: { bestMs: ms, splits } };
        setStore(next);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        fireConfetti();
        toast.success(prev ? "New record! You beat your ghost 👻⚡" : "Ghost set! Beat it next time 👻");
      } else {
        toast.error("The ghost held on this time — go again!");
      }
      setResult({ ms, prevMs: prev?.bestMs, beat });
      setPhase("done");
    },
    [store, deckId],
  );

  const choose = (word: string) => {
    if (locked || !q) return;
    setLocked(true);
    setPicked(word);
    const isRight = word === q.card.word;

    if (isRight) {
      const now = performance.now() - startRef.current;
      splitsRef.current = [...splitsRef.current, now];
      const nextCorrect = correct + 1;
      setCorrect(nextCorrect);
      if (nextCorrect >= RACE_LEN) {
        finish(now, splitsRef.current);
        return;
      }
      feedbackTimer.current = setTimeout(() => {
        if (!mounted.current) return;
        setPicked(null);
        setQ((prev) => buildQuestion(prev?.card.word));
        setLocked(false);
      }, 320);
    } else {
      feedbackTimer.current = setTimeout(() => {
        if (!mounted.current) return;
        setPicked(null);
        setQ((prev) => buildQuestion(prev?.card.word));
        setLocked(false);
      }, 620);
    }
  };

  // Positions on the track (0..1)
  const youPos = correct / RACE_LEN;
  const ghostCorrect = ghostSplits ? ghostSplits.filter((s) => s <= elapsed).length : 0;
  const ghostPos = ghostSplits ? Math.min(RACE_LEN, ghostCorrect) / RACE_LEN : 0;
  const lead = ghostSplits ? correct - ghostCorrect : 0;

  const fmt = (ms?: number) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)}s`);

  if (!loaded) {
    return (
      <Card className="glass border-averna-purple/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-averna-purple">
            <Ghost className="h-5 w-5" /> Ghost Race
          </CardTitle>
        </CardHeader>
        <CardContent className="h-24" />
      </Card>
    );
  }

  // ---- Idle ----
  if (phase === "idle") {
    return (
      <Card className="glass border-averna-purple/30 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-10 -left-10 h-40 w-40 rounded-full bg-averna-purple/10 blur-3xl" />
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-averna-purple">
            <span className="flex items-center gap-2">
              <Ghost className="h-5 w-5" /> Ghost Race
            </span>
            {bestMs != null && (
              <span className="flex items-center gap-1 text-xs font-normal text-gray-400">
                <Trophy className="h-3.5 w-3.5 text-amber-400" /> Best {fmt(bestMs)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-400">
            Match <span className="text-averna-purple font-semibold">{RACE_LEN}</span> definitions to their word as
            fast as you can — while a ghost replays the pace of your best run. Beat the ghost to set a record.
          </p>

          {/* Deck picker */}
          <div className="flex flex-wrap gap-1.5">
            {DECK_CHOICES.map((d) => (
              <button
                key={d.id}
                onClick={() => setDeckId(d.id)}
                className={`px-2.5 py-1 rounded-full text-xs border transition ${
                  deckId === d.id
                    ? "border-averna-purple/60 bg-averna-purple/20 text-averna-purple"
                    : "border-white/10 bg-white/5 text-gray-400 hover:text-white"
                }`}
              >
                <span className="mr-1">{d.emoji}</span>
                {d.name}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {ghostSplits ? (
                <span className="flex items-center gap-1 text-averna-purple">
                  <Ghost className="h-3.5 w-3.5" /> Ghost ready — {fmt(bestMs)} to beat
                </span>
              ) : (
                "No ghost yet — this run sets your record."
              )}
            </span>
            <Button
              onClick={startRace}
              className="neon-button bg-averna-purple hover:bg-averna-purple/80 text-white"
            >
              <Zap className="mr-2 h-4 w-4" /> Race
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Done ----
  if (phase === "done" && result) {
    const margin = result.prevMs != null ? result.prevMs - result.ms : null;
    return (
      <Card className={`glass relative overflow-hidden ${result.beat ? "border-averna-neon/50" : "border-averna-purple/40"}`}>
        <CardContent className="text-center py-8">
          <div className="text-5xl mb-2 select-none">{result.beat ? "🏆" : "👻"}</div>
          <p className={`text-2xl font-bold ${result.beat ? "text-averna-neon" : "text-averna-purple"}`}>
            {result.beat ? (result.prevMs != null ? "New Record!" : "Ghost Set!") : "Ghost Wins"}
          </p>
          <p className="text-sm text-gray-300 mt-2">
            Your time: <span className="font-semibold text-white">{fmt(result.ms)}</span>
            {result.prevMs != null && (
              <>
                {" · "}
                {margin != null && margin >= 0
                  ? <span className="text-averna-neon">beat ghost by {(margin / 1000).toFixed(1)}s</span>
                  : <span className="text-averna-purple">ghost led by {Math.abs((margin ?? 0) / 1000).toFixed(1)}s</span>}
              </>
            )}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button onClick={startRace} className="neon-button bg-averna-purple hover:bg-averna-purple/80 text-white">
              <RotateCcw className="mr-2 h-4 w-4" /> Race again
            </Button>
            <Button onClick={() => setPhase("idle")} variant="outline" className="border-white/20">
              Change deck
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Race ----
  return (
    <Card className="glass border-averna-purple/40 relative overflow-hidden">
      <CardContent className="py-5 space-y-4">
        {/* HUD */}
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-averna-purple font-mono">
            <Timer className="h-4 w-4" /> {fmt(elapsed)}
          </span>
          {ghostSplits && (
            <span
              className={`text-xs font-semibold ${
                lead > 0 ? "text-averna-neon" : lead < 0 ? "text-red-300" : "text-gray-400"
              }`}
            >
              {lead > 0 ? `+${lead} ahead` : lead < 0 ? `${lead} behind` : "neck and neck"}
            </span>
          )}
          <span className="text-xs text-gray-400">
            {correct}/{RACE_LEN}
          </span>
        </div>

        {/* Track */}
        <div className="space-y-2">
          {/* You */}
          <div className="relative h-8 rounded-full bg-white/5 border border-white/10 overflow-hidden">
            <div className="absolute inset-y-0 right-2 flex items-center text-averna-neon/50">
              <Flag className="h-4 w-4" />
            </div>
            <div
              className="absolute top-1/2 -translate-y-1/2 text-xl transition-all duration-300"
              style={{ left: `calc(${youPos * 88}% + 4px)` }}
            >
              🏃
            </div>
          </div>
          {/* Ghost */}
          {ghostSplits ? (
            <div className="relative h-8 rounded-full bg-white/5 border border-white/10 overflow-hidden">
              <div className="absolute inset-y-0 right-2 flex items-center text-averna-purple/40">
                <Flag className="h-4 w-4" />
              </div>
              <div
                className="absolute top-1/2 -translate-y-1/2 text-xl opacity-60 transition-all duration-300"
                style={{ left: `calc(${ghostPos * 88}% + 4px)` }}
              >
                👻
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-gray-500 text-center">Setting your ghost — race hard!</p>
          )}
        </div>

        {/* Question */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
          <p className="text-[11px] uppercase tracking-wider text-averna-purple mb-1">Which word means…</p>
          <p className="text-base text-white">{q?.card.meaning}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {q?.options.map((opt) => {
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
