"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DECKS, type Flashcard } from "@/lib/flashcards-data";
import { tashkentDateKey } from "@/lib/utils";
import { Zap, Flame, CheckCircle2, Sparkles, ArrowRight } from "lucide-react";

const STORAGE_KEY = "averna_warmup_v1";
const MISTAKES_KEY = "averna_mistakes_v1";
const N = 5;

interface WarmStore {
  lastDate: string;
  streak: number;
  sessions: number;
}

interface Mistake {
  id: string;
  wrong: string;
  right: string;
  note?: string;
}

interface Q {
  label: string;
  prompt: string;
  strike?: boolean;
  answer: string;
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

function daysBetween(a: string, b: string) {
  const da = new Date(`${a}T00:00:00+05:00`).getTime();
  const db = new Date(`${b}T00:00:00+05:00`).getTime();
  return Math.round((db - da) / 86_400_000);
}

/**
 * 60-Second Warm-Up — a one-tap micro session that lowers the barrier to
 * studying. Five rapid questions mixing the student's own Mistake Bank with
 * vocabulary, then a "word of the day" takeaway. Builds a daily warm-up streak
 * to make starting a habit. Fully client-side; reuses averna_mistakes_v1 and
 * the DECKS vocabulary.
 */
export function WarmUp() {
  const [loaded, setLoaded] = useState(false);
  const [store, setStore] = useState<WarmStore>({ lastDate: "", streak: 0, sessions: 0 });
  const [phase, setPhase] = useState<Phase>("idle");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

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

  const today = tashkentDateKey();
  const warmedToday = store.lastDate === today;

  // Deterministic word of the day
  const wotd = ALL_CARDS[Number(today.replaceAll("-", "")) % ALL_CARDS.length];

  const buildQuestions = useCallback((): Q[] => {
    let mistakes: Mistake[] = [];
    try {
      const raw = localStorage.getItem(MISTAKES_KEY);
      if (raw) mistakes = JSON.parse(raw);
    } catch {
      /* ignore */
    }

    const out: Q[] = [];

    // Up to 2 mistake questions (need >=4 mistakes for clean distractors)
    if (mistakes.length >= 4) {
      const rights = Array.from(new Set(mistakes.map((m) => m.right)));
      for (const m of shuffle(mistakes).slice(0, 2)) {
        const distractors = shuffle(rights.filter((r) => r !== m.right)).slice(0, 3);
        out.push({
          label: "Fix your mistake",
          prompt: m.wrong,
          strike: true,
          answer: m.right,
          options: shuffle([m.right, ...distractors]),
        });
      }
    }

    // Fill the rest with vocabulary (definition -> word)
    const usedWords = new Set<string>();
    const vocabPool = shuffle(ALL_CARDS);
    for (const card of vocabPool) {
      if (out.length >= N) break;
      if (usedWords.has(card.word)) continue;
      usedWords.add(card.word);
      const distractors = shuffle(ALL_CARDS.filter((c) => c.word !== card.word)).slice(0, 3).map((c) => c.word);
      out.push({
        label: "Vocabulary",
        prompt: card.meaning,
        answer: card.word,
        options: shuffle([card.word, ...distractors]),
      });
    }

    return shuffle(out).slice(0, N);
  }, []);

  const loop = useCallback(() => {
    if (!mounted.current) return;
    setElapsed(performance.now() - startRef.current);
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const start = () => {
    setQuestions(buildQuestions());
    setIdx(0);
    setCorrect(0);
    setPicked(null);
    setLocked(false);
    setElapsed(0);
    setPhase("play");
    startRef.current = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
  };

  const finish = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setStore((prev) => {
      let { streak, sessions, lastDate } = prev;
      sessions += 1;
      if (prev.lastDate !== today) {
        const gap = prev.lastDate ? daysBetween(prev.lastDate, today) : 999;
        streak = gap === 1 ? prev.streak + 1 : 1;
        lastDate = today;
      }
      const next = { streak, sessions, lastDate };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    setPhase("done");
  }, [today]);

  const choose = (opt: string) => {
    if (locked) return;
    setLocked(true);
    setPicked(opt);
    const q = questions[idx];
    if (opt === q.answer) setCorrect((c) => c + 1);
    timer.current = setTimeout(() => {
      if (!mounted.current) return;
      if (idx + 1 >= questions.length) {
        finish();
      } else {
        setIdx((i) => i + 1);
        setPicked(null);
        setLocked(false);
      }
    }, 550);
  };

  if (!loaded) {
    return (
      <Card className="glass border-averna-pink/30">
        <CardContent className="h-20" />
      </Card>
    );
  }

  // ---- Play ----
  if (phase === "play") {
    const q = questions[idx];
    return (
      <Card className="glass border-averna-pink/40">
        <CardContent className="py-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-averna-pink font-medium">{q.label}</span>
            <span className="font-mono text-gray-400">{(elapsed / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${i < idx ? "bg-averna-pink" : i === idx ? "bg-averna-pink/50" : "bg-white/10"}`}
              />
            ))}
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
            <p className={`text-base ${q.strike ? "text-red-300 line-through" : "text-white"}`}>{q.prompt}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {q.options.map((opt) => {
              const isAnswer = opt === q.answer;
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
  if (phase === "done") {
    return (
      <Card className="glass border-averna-neon/40">
        <CardContent className="py-6 text-center space-y-3">
          <CheckCircle2 className="h-10 w-10 text-averna-neon mx-auto" />
          <p className="text-xl font-bold text-white">Warmed up! 🔥</p>
          <p className="text-sm text-gray-300">
            {correct}/{questions.length} correct in {(elapsed / 1000).toFixed(1)}s ·{" "}
            <span className="text-orange-400 font-semibold">{store.streak}-day streak</span>
          </p>

          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-left">
            <p className="text-[11px] uppercase tracking-wider text-averna-pink flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Word of the day
            </p>
            <p className="text-white font-semibold mt-1">{wotd.word}</p>
            <p className="text-xs text-gray-400">{wotd.meaning}</p>
          </div>

          <Button onClick={() => setPhase("idle")} className="neon-button bg-averna-pink hover:bg-averna-pink/80 text-white">
            Start studying <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ---- Idle ----
  return (
    <Card className="glass border-averna-pink/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-averna-pink/10 blur-3xl" />
      <CardContent className="py-5 flex items-center justify-between gap-4 relative">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold text-white">
            <Zap className="h-5 w-5 text-averna-pink" /> 60-Second Warm-Up
          </p>
          <p className="text-sm text-gray-400 mt-0.5">
            {warmedToday
              ? "Done today — go again anytime to stay sharp."
              : "Five rapid questions to get your brain in gear before you study."}
          </p>
          {store.streak > 0 && (
            <p className="text-xs text-orange-400 mt-1 flex items-center gap-1">
              <Flame className="h-3.5 w-3.5" /> {store.streak}-day warm-up streak{warmedToday ? " · kept today" : ""}
            </p>
          )}
        </div>
        <Button onClick={start} className="shrink-0 neon-button bg-averna-pink hover:bg-averna-pink/80 text-white">
          <Zap className="mr-2 h-4 w-4" /> {warmedToday ? "Again" : "Warm up"}
        </Button>
      </CardContent>
    </Card>
  );
}
