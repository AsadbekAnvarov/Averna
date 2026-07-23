"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { DECKS, type Flashcard } from "@/lib/flashcards-data";
import { fireConfetti } from "@/lib/confetti";
import { Gauge, Trophy, RotateCcw, Target } from "lucide-react";

const STORAGE_KEY = "averna_confidence_v1";
const N_QUESTIONS = 8;

type LevelKey = "guess" | "fair" | "certain";

const LEVELS: { key: LevelKey; label: string; emoji: string; stake: number; ring: string; text: string }[] = [
  { key: "guess", label: "Just guessing", emoji: "😬", stake: 10, ring: "border-gray-500/50 hover:bg-gray-500/10", text: "text-gray-300" },
  { key: "fair", label: "Fairly sure", emoji: "🤔", stake: 20, ring: "border-averna-cyan/50 hover:bg-averna-cyan/10", text: "text-averna-cyan" },
  { key: "certain", label: "Certain", emoji: "🎯", stake: 30, ring: "border-amber-500/50 hover:bg-amber-500/10", text: "text-amber-400" },
];

interface Bucket {
  c: number; // correct
  t: number; // total
}
type Buckets = Record<LevelKey, Bucket>;

interface Store {
  bestScore: number;
  lifetime: Buckets;
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

const emptyBuckets = (): Buckets => ({ guess: { c: 0, t: 0 }, fair: { c: 0, t: 0 }, certain: { c: 0, t: 0 } });

function calibrationInsight(b: Buckets): { tone: "over" | "under" | "good"; text: string } {
  const certAcc = b.certain.t ? b.certain.c / b.certain.t : null;
  const guessAcc = b.guess.t ? b.guess.c / b.guess.t : null;
  if (certAcc != null && b.certain.t >= 2 && certAcc < 0.6) {
    return { tone: "over", text: "Overconfident — you felt certain but were often wrong. Ease off the 🎯 until you're truly sure." };
  }
  if (guessAcc != null && b.guess.t >= 2 && guessAcc > 0.7) {
    return { tone: "under", text: "Underconfident — you knew far more than you claimed. Trust your instincts!" };
  }
  return { tone: "good", text: "Well-calibrated — your confidence matched your results. That's exam gold. 🎯" };
}

/**
 * Confidence Meter — a metacognition trainer. For each vocabulary question the
 * student picks an answer, then wagers a confidence level (guess / fairly sure
 * / certain). Correct answers earn the stake; wrong ones lose it — so honest,
 * accurate self-assessment scores best. Afterwards it reveals the student's
 * *calibration*: how well their felt confidence matched reality (over- vs
 * under-confident), a skill that directly improves real IELTS performance.
 *
 * Fully client-side: reuses vocabulary from lib/flashcards-data.ts and stores
 * lifetime calibration + best score in localStorage.
 */
export function ConfidenceMeter() {
  const [loaded, setLoaded] = useState(false);
  const [store, setStore] = useState<Store>({ bestScore: 0, lifetime: emptyBuckets() });

  const [phase, setPhase] = useState<Phase>("idle");
  const [q, setQ] = useState<Question | null>(null);
  const [answered, setAnswered] = useState(0);
  const [score, setScore] = useState(0);
  const [buckets, setBuckets] = useState<Buckets>(emptyBuckets());
  const [selected, setSelected] = useState<string | null>(null);
  const [graded, setGraded] = useState<{ correct: boolean; delta: number } | null>(null);
  const [locked, setLocked] = useState(false);

  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setStore({ bestScore: parsed.bestScore ?? 0, lifetime: { ...emptyBuckets(), ...parsed.lifetime } });
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const buildQuestion = useCallback((prevWord?: string): Question => {
    const candidates = prevWord ? ALL_CARDS.filter((c) => c.word !== prevWord) : ALL_CARDS;
    const card = candidates[Math.floor(Math.random() * candidates.length)];
    const distractors = shuffle(ALL_CARDS.filter((c) => c.word !== card.word)).slice(0, 3).map((c) => c.word);
    return { card, options: shuffle([card.word, ...distractors]) };
  }, []);

  const startPlay = useCallback(() => {
    setAnswered(0);
    setScore(0);
    setBuckets(emptyBuckets());
    setSelected(null);
    setGraded(null);
    setLocked(false);
    setQ(buildQuestion());
    setPhase("play");
  }, [buildQuestion]);

  const finish = useCallback(
    (finalScore: number, finalBuckets: Buckets) => {
      const merged: Buckets = {
        guess: { c: store.lifetime.guess.c + finalBuckets.guess.c, t: store.lifetime.guess.t + finalBuckets.guess.t },
        fair: { c: store.lifetime.fair.c + finalBuckets.fair.c, t: store.lifetime.fair.t + finalBuckets.fair.t },
        certain: { c: store.lifetime.certain.c + finalBuckets.certain.c, t: store.lifetime.certain.t + finalBuckets.certain.t },
      };
      const best = Math.max(store.bestScore, finalScore);
      const next: Store = { bestScore: best, lifetime: merged };
      setStore(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      if (finalScore > 0 && finalScore >= store.bestScore) {
        fireConfetti();
        toast.success(`New best — ${finalScore} confidence points! 🎯`);
      }
      setPhase("done");
    },
    [store],
  );

  const commit = (level: LevelKey) => {
    if (locked || !selected || !q) return;
    setLocked(true);
    const stake = LEVELS.find((l) => l.key === level)!.stake;
    const correct = selected === q.card.word;
    const delta = correct ? stake : -stake;
    const newScore = score + delta;
    const newBuckets: Buckets = {
      ...buckets,
      [level]: { c: buckets[level].c + (correct ? 1 : 0), t: buckets[level].t + 1 },
    };
    setScore(newScore);
    setBuckets(newBuckets);
    setGraded({ correct, delta });

    timer.current = setTimeout(() => {
      if (!mounted.current) return;
      const nextAnswered = answered + 1;
      setAnswered(nextAnswered);
      if (nextAnswered >= N_QUESTIONS) {
        finish(newScore, newBuckets);
      } else {
        setSelected(null);
        setGraded(null);
        setQ((prev) => buildQuestion(prev?.card.word));
        setLocked(false);
      }
    }, 950);
  };

  const totalCorrect = buckets.guess.c + buckets.fair.c + buckets.certain.c;
  const totalAnswered = buckets.guess.t + buckets.fair.t + buckets.certain.t;
  const accuracy = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  const fmtPct = (b: Bucket) => (b.t ? `${Math.round((b.c / b.t) * 100)}%` : "—");

  if (!loaded) {
    return (
      <Card className="glass border-amber-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-400">
            <Gauge className="h-5 w-5" /> Confidence Meter
          </CardTitle>
        </CardHeader>
        <CardContent className="h-24" />
      </Card>
    );
  }

  // ---- Idle ----
  if (phase === "idle") {
    const lt = store.lifetime;
    const hasHistory = lt.guess.t + lt.fair.t + lt.certain.t > 0;
    return (
      <Card className="glass border-amber-500/30 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-amber-400">
            <span className="flex items-center gap-2">
              <Gauge className="h-5 w-5" /> Confidence Meter
            </span>
            {store.bestScore > 0 && (
              <span className="flex items-center gap-1 text-xs font-normal text-gray-400">
                <Trophy className="h-3.5 w-3.5 text-amber-400" /> Best {store.bestScore}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-400">
            Answer, then <span className="text-amber-400 font-semibold">wager your confidence</span>. Right + certain
            scores big; wrong + certain costs you. Learn to tell what you really know — a skill that wins exams.
          </p>

          {hasHistory && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {LEVELS.map((l) => (
                <div key={l.key} className="rounded-lg bg-white/5 border border-white/10 py-2">
                  <div className="text-lg">{l.emoji}</div>
                  <div className={`text-sm font-bold ${l.text}`}>{fmtPct(lt[l.key])}</div>
                  <div className="text-[10px] text-gray-500">when {l.label.toLowerCase()}</div>
                </div>
              ))}
            </div>
          )}

          <Button onClick={startPlay} className="w-full neon-button bg-amber-500 hover:bg-amber-500/80 text-black">
            <Target className="mr-2 h-4 w-4" /> Test my confidence
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ---- Done ----
  if (phase === "done") {
    const ins = calibrationInsight(buckets);
    const toneCls =
      ins.tone === "over" ? "border-red-500/40 text-red-300" : ins.tone === "under" ? "border-averna-cyan/40 text-averna-cyan" : "border-averna-neon/40 text-averna-neon";
    return (
      <Card className="glass border-amber-500/40">
        <CardContent className="py-7 space-y-5">
          <div className="text-center">
            <div className="text-5xl mb-1 select-none">🎯</div>
            <p className="text-sm text-gray-400">Confidence score</p>
            <p className={`text-3xl font-extrabold ${score >= 0 ? "text-amber-400" : "text-red-300"}`}>{score}</p>
            <p className="text-xs text-gray-500 mt-1">
              {totalCorrect}/{totalAnswered} correct · {accuracy}% accuracy
            </p>
          </div>

          {/* Calibration breakdown */}
          <div className="space-y-2">
            {LEVELS.map((l) => {
              const b = buckets[l.key];
              const pct = b.t ? Math.round((b.c / b.t) * 100) : 0;
              return (
                <div key={l.key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={l.text}>
                      {l.emoji} {l.label}
                    </span>
                    <span className="text-gray-400">{b.t ? `${b.c}/${b.t} (${pct}%)` : "not used"}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-averna-neon transition-all duration-500"
                      style={{ width: `${b.t ? pct : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`rounded-xl border bg-white/5 px-4 py-3 text-sm text-center ${toneCls}`}>{ins.text}</div>

          <div className="flex items-center justify-center gap-3">
            <Button onClick={startPlay} className="neon-button bg-amber-500 hover:bg-amber-500/80 text-black">
              <RotateCcw className="mr-2 h-4 w-4" /> Again
            </Button>
            <Button onClick={() => setPhase("idle")} variant="outline" className="border-white/20">
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Play ----
  return (
    <Card className="glass border-amber-500/40 relative overflow-hidden">
      <CardContent className="py-5 space-y-4">
        {/* Meter */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400 text-xs">
            Question {answered + 1}/{N_QUESTIONS}
          </span>
          <span className={`font-bold ${score >= 0 ? "text-amber-400" : "text-red-300"}`}>{score} pts</span>
        </div>
        <div className="relative h-2.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-averna-neon transition-all duration-500"
            style={{ width: `${totalAnswered ? accuracy : 0}%` }}
          />
        </div>

        {/* Question */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
          <p className="text-[11px] uppercase tracking-wider text-amber-400 mb-1">Which word means…</p>
          <p className="text-base text-white">{q?.card.meaning}</p>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-2">
          {q?.options.map((opt) => {
            const isAnswer = opt === q.card.word;
            let cls = "border-white/10 bg-white/5 hover:bg-white/10 text-gray-200";
            if (graded) {
              if (isAnswer) cls = "border-averna-neon/60 bg-averna-neon/15 text-averna-neon";
              else if (opt === selected) cls = "border-red-500/60 bg-red-500/15 text-red-300";
              else cls = "border-white/10 bg-white/5 text-gray-500 opacity-60";
            } else if (opt === selected) {
              cls = "border-amber-400/70 bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40";
            }
            return (
              <button
                key={opt}
                disabled={locked}
                onClick={() => !graded && setSelected(opt)}
                className={`text-sm font-medium rounded-lg border px-3 py-2.5 transition-all disabled:cursor-not-allowed ${cls}`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {/* Confidence wager */}
        <div className="min-h-[4.5rem]">
          {graded ? (
            <div className={`text-center py-3 rounded-lg animate-fade-in ${graded.correct ? "text-averna-neon" : "text-red-300"}`}>
              <span className="font-bold text-lg">
                {graded.correct ? "Correct" : "Wrong"} {graded.delta >= 0 ? `+${graded.delta}` : graded.delta}
              </span>
              {!graded.correct && q && <p className="text-xs text-gray-400 mt-0.5">Answer: {q.card.word}</p>}
            </div>
          ) : (
            <>
              <p className="text-center text-xs text-gray-400 mb-2">
                {selected ? "How confident are you?" : "Pick an answer first ☝️"}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {LEVELS.map((l) => (
                  <button
                    key={l.key}
                    disabled={!selected || locked}
                    onClick={() => commit(l.key)}
                    className={`flex flex-col items-center gap-0.5 py-2 rounded-lg border bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${l.ring}`}
                  >
                    <span className="text-base">{l.emoji}</span>
                    <span className={`text-[11px] font-medium ${l.text}`}>{l.label}</span>
                    <span className="text-[10px] text-gray-500">±{l.stake}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
