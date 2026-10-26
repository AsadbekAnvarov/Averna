"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { FOCUS_RING, GameFooter, GameStat, formatClock } from "@/components/games/game-ui";
import { fireConfetti } from "@/lib/confetti";
import { cn, tashkentDateKey } from "@/lib/utils";
import type { Flashcard } from "@/lib/flashcards-data";
import { dailySeed, mulberry32, randomSeed, type Rng } from "@/lib/games/rng";
import { loadJson, saveJson } from "@/lib/games/words";
import {
  SCRAMBLE_HINT_POINTS,
  SCRAMBLE_SECONDS,
  SCRAMBLE_STORAGE_KEY,
  applyHint,
  backspace,
  builtWord,
  dealScramble,
  hintsLeft,
  isFull,
  isSolved,
  newScramble,
  placeTile,
  reshuffle,
  returnTile,
  scramblePoints,
  tileById,
  typeLetter,
  type ScrambleState,
  type ScrambleStore,
} from "@/lib/games/word-scramble";
import { Check, Lightbulb, Lock, RotateCcw, Shuffle, SkipForward, Star, Timer, Trophy, X, Zap } from "lucide-react";

const EMPTY_STORE: ScrambleStore = { bestScore: 0, bestSolved: 0 };
const SPRINT_MS = SCRAMBLE_SECONDS * 1000;
const TILE = "grid h-11 w-11 shrink-0 place-items-center rounded-xl border font-mono text-lg font-bold uppercase transition-colors";
/** Shuffle / Hint / Skip: icon over label on phones (fits 3 across at 320 px), inline from sm. */
const CONTROL =
  "h-auto min-h-11 flex-col gap-0.5 border-white/20 bg-transparent px-1 py-1 text-xs sm:min-h-10 sm:flex-row sm:gap-1.5 sm:px-3 sm:text-sm";

type Phase = "idle" | "play" | "end";

/**
 * Word Scramble — a 60-second sprint. Unscramble the letters of the word that
 * matches the definition: tap or type tiles, send a tile back with a tap,
 * shuffle, skip or take a hint (−2 points). Best score in localStorage.
 * Practice only: no XP, no API.
 */
export function WordScramble({ seed }: { seed?: number }) {
  const today = tashkentDateKey();
  const [phase, setPhase] = useState<Phase>("idle");
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [idx, setIdx] = useState(0);
  const [game, setGame] = useState<ScrambleState | null>(null);
  const [score, setScore] = useState(0);
  const [solved, setSolved] = useState<{ card: Flashcard; points: number }[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [store, setStore] = useState<ScrambleStore>(EMPTY_STORE);
  const [isNewBest, setIsNewBest] = useState(false);
  const [status, setStatus] = useState("");

  const plays = useRef(0);
  const rng = useRef<Rng>(mulberry32(1));
  const endRef = useRef<HTMLHeadingElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const focusTray = useRef(false);
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  const tick = useRef<() => void>(() => {});

  const card = queue[idx];
  const remaining = deadline == null ? SPRINT_MS : Math.max(0, deadline - now);

  useEffect(() => {
    setStore(loadJson(SCRAMBLE_STORAGE_KEY, EMPTY_STORE));
  }, []);

  useEffect(() => {
    if (phase === "end") endRef.current?.focus();
    if (phase === "play" && focusTray.current) {
      focusTray.current = false;
      trayRef.current?.querySelector<HTMLButtonElement>("button:not([aria-disabled])")?.focus();
    }
  }, [phase]);

  const start = () => {
    const s = plays.current === 0 && seed != null ? seed : plays.current === 0 ? dailySeed(today, "word-scramble") : randomSeed();
    plays.current += 1;
    const words = dealScramble(s);
    if (words.length === 0) return;
    rng.current = mulberry32(s ^ 0x9e3779b9);
    const t = Date.now();
    setQueue(words);
    setIdx(0);
    setGame(newScramble(words[0].word, rng.current));
    setScore(0);
    setSolved([]);
    setSkipped(0);
    setIsNewBest(false);
    setDeadline(t + SPRINT_MS);
    setNow(t);
    setPhase("play");
    setStatus(`Go! ${SCRAMBLE_SECONDS} seconds. Build the word that matches the meaning.`);
    focusTray.current = true;
  };

  const finish = () => {
    const newBest = score > store.bestScore;
    const nextStore: ScrambleStore = { bestScore: Math.max(store.bestScore, score), bestSolved: Math.max(store.bestSolved, solved.length) };
    if (nextStore.bestScore !== store.bestScore || nextStore.bestSolved !== store.bestSolved) {
      setStore(nextStore);
      saveJson(SCRAMBLE_STORAGE_KEY, nextStore);
    }
    if (newBest && score > 0) {
      fireConfetti();
      toast.success("New best sprint ⚡");
    }
    setIsNewBest(newBest && score > 0);
    setPhase("end");
    setStatus(`Time! ${solved.length} ${solved.length === 1 ? "word" : "words"} solved, ${score} points.`);
  };

  // The countdown: one interval while playing; the tick reads fresh state via a ref.
  useEffect(() => {
    tick.current = () => {
      const t = Date.now();
      setNow(t);
      if (phase === "play" && deadline != null && t >= deadline) finish();
    };
  });
  useEffect(() => {
    if (phase !== "play") return;
    const id = setInterval(() => tick.current(), 200);
    return () => clearInterval(id);
  }, [phase]);

  const moveOn = () => {
    if (queue.length === 0) return;
    const i = (idx + 1) % queue.length;
    setIdx(i);
    setGame(newScramble(queue[i].word, rng.current));
  };

  const apply = (next: ScrambleState, message: string) => {
    if (!game || !card) return;
    if (isSolved(next)) {
      const points = scramblePoints(next.hintsUsed);
      setScore((s) => s + points);
      setSolved((list) => [...list, { card, points }]);
      setStatus(`Correct! ${next.answer} +${points}. Next word.`);
      moveOn();
      return;
    }
    setGame(next);
    setStatus(isFull(next) ? `Not quite: ${builtWord(next)} isn't it. Tap a letter to send it back.` : message);
  };

  const live = phase === "play" && !!game && remaining > 0;

  const tapTray = (id: number) => {
    if (!live || !game) return;
    const next = placeTile(game, id);
    if (next === game) return;
    apply(next, `Added ${tileById(game, id)?.letter}: ${builtWord(next)}`);
  };

  const tapPlaced = (id: number) => {
    if (!live || !game) return;
    const next = returnTile(game, id);
    if (next === game) {
      if (game.placed.includes(id)) setStatus("That letter is locked in by a hint.");
      return;
    }
    apply(next, `Sent ${tileById(game, id)?.letter} back.`);
  };

  const onShuffle = () => {
    if (!live || !game) return;
    setGame(reshuffle(game, rng.current));
    setStatus("Letters shuffled.");
  };

  const onHint = () => {
    if (!live || !game) return;
    const next = applyHint(game);
    if (next === game) {
      setStatus("No hints left for this word.");
      return;
    }
    apply(next, `Hint: letter ${next.locked} is ${next.answer[next.locked - 1]}. −${SCRAMBLE_HINT_POINTS} points for this word.`);
  };

  const onSkip = () => {
    if (!live || !game) return;
    setSkipped((n) => n + 1);
    setStatus(`Skipped. The word was ${game.answer}.`);
    moveOn();
  };

  // Typing: letters place a tile, Backspace sends the last one back.
  useEffect(() => {
    keyHandler.current = (e: KeyboardEvent) => {
      if (!live || !game || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (/^[a-z]$/i.test(e.key)) {
        e.preventDefault();
        const next = typeLetter(game, e.key);
        if (next === game) setStatus(isFull(game) ? "The row is full. Press Backspace to send a letter back." : `No ${e.key.toUpperCase()} left to place.`);
        else apply(next, `Added ${e.key.toUpperCase()}: ${builtWord(next)}`);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        const next = backspace(game);
        if (next !== game) apply(next, `Sent ${tileById(game, game.placed[game.placed.length - 1])?.letter} back.`);
      }
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const statusLine = (
    <p role="status" aria-live="polite" className="min-h-[1.25rem] text-center text-sm text-gray-300">
      {status}
    </p>
  );

  // ---- Idle ----
  if (phase === "idle" || !game || !card) {
    return (
      <Card className="glass relative overflow-hidden border-orange-400/30">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-orange-400/10 blur-3xl" />
        <CardContent className="relative space-y-4 px-3 py-5 text-center sm:px-5">
          <div aria-hidden="true" className="flex justify-center gap-1 sm:gap-1.5">
            {"SCRAMBLE".split("").map((l, i) => (
              <span
                key={i}
                className={cn(TILE, "h-7 w-7 rounded-lg border-orange-400/40 bg-orange-400/15 text-sm text-white sm:h-11 sm:w-11 sm:rounded-xl sm:text-lg", i % 2 ? "rotate-6" : "-rotate-6")}
              >
                {l}
              </span>
            ))}
          </div>
          <p className="flex items-center justify-center gap-2 font-semibold text-white">
            <Zap className="h-5 w-5 text-orange-400" aria-hidden="true" /> {SCRAMBLE_SECONDS}-second sprint
          </p>
          <p className="mx-auto max-w-md text-sm text-gray-400">
            Read the meaning and rebuild the word from its shuffled letters. Tap or type the tiles. Each word is worth 10 points, plus{" "}
            {SCRAMBLE_HINT_POINTS} for every hint you don&apos;t use.
          </p>
          <p className="flex items-center justify-center gap-1 text-xs text-gray-400">
            <Trophy className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            {store.bestScore > 0 ? `Best ${store.bestScore} points · ${store.bestSolved} words` : "No best sprint yet"}
          </p>
          <Button type="button" onClick={start} className="bg-orange-500 text-gray-950 hover:bg-orange-500/85">
            <Zap className="mr-2 h-4 w-4" aria-hidden="true" /> Start sprint
          </Button>
          {statusLine}
          <GameFooter />
        </CardContent>
      </Card>
    );
  }

  // ---- End ----
  if (phase === "end") {
    return (
      <Card className={cn("glass relative overflow-hidden", isNewBest ? "border-averna-neon/50" : "border-orange-400/40")}>
        <CardContent className="relative space-y-4 px-3 py-6 text-center sm:px-5">
          <Timer className="mx-auto h-10 w-10 text-orange-400" aria-hidden="true" />
          <h2 ref={endRef} tabIndex={-1} className="text-xl font-bold text-white focus:outline-none">
            Time!
          </h2>
          <div className="mx-auto grid max-w-sm grid-cols-3 gap-2">
            <GameStat label="Solved" value={solved.length} />
            <GameStat label="Score" icon={Star} value={score} />
            <GameStat label="Skipped" value={skipped} />
          </div>
          <p className="text-xs text-gray-400">
            {isNewBest ? "New best sprint!" : `Best ${store.bestScore} points · ${store.bestSolved} words`}
          </p>
          {solved.length > 0 && (
            <ul className="mx-auto grid max-w-xl gap-1.5 text-left sm:grid-cols-2">
              {solved.map(({ card: c, points }, i) => (
                <li key={`${c.word}-${i}`} className="min-w-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
                  <span className="font-semibold text-white">{c.word}</span>
                  <span className="text-gray-400"> — {c.meaning}</span>
                  <span className="text-orange-400"> +{points}</span>
                </li>
              ))}
            </ul>
          )}
          <Button type="button" onClick={start} className="bg-orange-500 text-gray-950 hover:bg-orange-500/85">
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" /> Play again
          </Button>
          {statusLine}
          <GameFooter />
        </CardContent>
      </Card>
    );
  }

  // ---- Play ----
  const full = isFull(game);
  const wrong = full && !isSolved(game);
  const left = hintsLeft(game);
  const pct = (remaining / SPRINT_MS) * 100;

  return (
    <Card className="glass relative overflow-hidden border-orange-400/40">
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-orange-400/10 blur-3xl" />
      <CardContent className="relative space-y-4 px-3 py-4 sm:px-5 sm:py-5">
        <div className="grid grid-cols-3 gap-2">
          <GameStat label="Time" icon={Timer} value={formatClock(remaining + 999)} className={remaining <= 10_000 ? "border-red-400/50" : undefined} />
          <GameStat label="Score" icon={Star} value={score} />
          <GameStat label="Solved" icon={Check} value={solved.length} />
        </div>
        <div
          role="progressbar"
          aria-label="Time left"
          aria-valuemin={0}
          aria-valuemax={SCRAMBLE_SECONDS}
          aria-valuenow={Math.ceil(remaining / 1000)}
          className="h-1.5 overflow-hidden rounded-full bg-white/10"
        >
          <div
            className={cn("h-full rounded-full transition-[width] duration-200 ease-linear motion-reduce:transition-none", remaining <= 10_000 ? "bg-red-400" : "bg-orange-400")}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="space-y-1 rounded-xl border border-white/10 bg-white/5 p-3 text-center sm:p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">Meaning · {game.answer.length} letters</p>
          <p className="text-base text-white">{card.meaning}</p>
        </div>

        {/* Answer row */}
        <div role="group" aria-label="Your answer" className="flex flex-wrap justify-center gap-1.5">
          {Array.from({ length: game.answer.length }, (_, pos) => {
            const id = game.placed[pos];
            const tile = id == null ? undefined : tileById(game, id);
            const locked = tile != null && pos < game.locked;
            return (
              <button
                key={pos}
                type="button"
                onClick={() => id != null && tapPlaced(id)}
                aria-disabled={!tile || locked || undefined}
                aria-label={
                  tile ? `Position ${pos + 1}: ${tile.letter}${locked ? ", locked by a hint" : ", tap to send back"}` : `Position ${pos + 1}, empty`
                }
                className={cn(
                  TILE,
                  FOCUS_RING,
                  "relative",
                  !tile && "border-dashed border-white/20 bg-transparent text-transparent",
                  tile && locked && "cursor-default border-amber-400/60 bg-amber-400/15 text-white",
                  tile && !locked && (wrong ? "border-red-400/60 bg-red-400/10 text-white" : "border-averna-cyan/50 bg-averna-cyan/10 text-white hover:bg-averna-cyan/20"),
                  tile && "duration-150 animate-in zoom-in-90 motion-reduce:animate-none",
                )}
              >
                {tile?.letter ?? "\u00a0"}
                {locked && <Lock className="absolute right-0.5 top-0.5 h-3 w-3 text-amber-400" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        {wrong && (
          <p className="flex items-center justify-center gap-1 text-xs text-red-400">
            <X className="h-3.5 w-3.5" aria-hidden="true" /> Not quite. Tap a letter to send it back.
          </p>
        )}

        {/* Tray */}
        <div ref={trayRef} role="group" aria-label="Letter tiles" className="flex flex-wrap justify-center gap-1.5">
          {game.tiles.map((t) => {
            const used = game.placed.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => tapTray(t.id)}
                aria-disabled={used || undefined}
                aria-label={used ? "Empty tray spot" : `Letter ${t.letter}`}
                className={cn(
                  TILE,
                  FOCUS_RING,
                  used
                    ? "cursor-default border-dashed border-white/10 bg-transparent text-transparent"
                    : "border-orange-400/50 bg-orange-400/15 text-white hover:-translate-y-0.5 hover:bg-orange-400/25 motion-reduce:hover:translate-y-0",
                )}
              >
                {used ? "\u00a0" : t.letter}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant="outline" onClick={onShuffle} className={CONTROL}>
            <Shuffle className="h-4 w-4 shrink-0" aria-hidden="true" /> Shuffle
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onHint}
            aria-label={`Hint, ${left} left, costs ${SCRAMBLE_HINT_POINTS} points`}
            aria-disabled={left === 0 || undefined}
            className={cn(CONTROL, left === 0 && "opacity-50")}
          >
            <Lightbulb className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" /> Hint · {left}
          </Button>
          <Button type="button" variant="outline" onClick={onSkip} className={CONTROL}>
            <SkipForward className="h-4 w-4 shrink-0" aria-hidden="true" /> Skip
          </Button>
        </div>

        {statusLine}
        <GameFooter>
          <span className="hidden sm:inline">Tip: type letters, Backspace to undo ·</span>
        </GameFooter>
      </CardContent>
    </Card>
  );
}
