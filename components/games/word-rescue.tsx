"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { FOCUS_RING, GameFooter, GameStat } from "@/components/games/game-ui";
import { fireConfetti } from "@/lib/confetti";
import { cn, tashkentDateKey } from "@/lib/utils";
import type { Flashcard } from "@/lib/flashcards-data";
import { dailySeed, randomSeed } from "@/lib/games/rng";
import { blankWord, loadJson, saveJson } from "@/lib/games/words";
import {
  ALPHABET,
  RESCUE_LIVES,
  RESCUE_STORAGE_KEY,
  answerLetters,
  dealRescue,
  guessLetter,
  isRescueLost,
  isRescueOver,
  isRescueWon,
  isRunOver,
  letterSlots,
  newRescue,
  settleWord,
  startRun,
  type LetterSlot,
  type RescueRun,
  type RescueState,
  type RescueStore,
} from "@/lib/games/word-rescue";
import { ArrowRight, Check, Flame, LifeBuoy, PartyPopper, RotateCcw, Sparkles, Star, Trophy, X } from "lucide-react";

const EMPTY_STORE: RescueStore = { bestScore: 0, bestStreak: 0 };
const BALLOON_COLORS = ["bg-averna-pink", "bg-averna-cyan", "bg-amber-400", "bg-averna-purple", "bg-averna-neon", "bg-orange-400"];
const BALLOON_SHAPE = "rounded-[50%_50%_50%_50%/60%_60%_40%_40%]";

type Phase = "idle" | "play" | "end";

function Balloons({ lives, over }: { lives: number; over: boolean }) {
  return (
    <div role="img" aria-label={`${lives} of ${RESCUE_LIVES} balloons left`} className="flex items-end justify-center gap-2 sm:gap-3">
      {BALLOON_COLORS.slice(0, RESCUE_LIVES).map((color, i) => {
        const popped = i >= lives;
        return (
          <span key={i} aria-hidden="true" className="flex w-7 flex-col items-center sm:w-8">
            {popped ? (
              <span className="grid h-9 w-7 place-items-center text-gray-500 duration-300 animate-in fade-in zoom-in-150 motion-reduce:animate-none sm:h-10 sm:w-8">
                <Sparkles className="h-5 w-5" />
              </span>
            ) : (
              <>
                <span
                  className={cn(
                    "block h-9 w-7 shadow-lg sm:h-10 sm:w-8",
                    BALLOON_SHAPE,
                    color,
                    lives === 1 && !over && "motion-safe:animate-pulse",
                  )}
                />
                <span className={cn("-mt-1 h-1.5 w-1.5 rotate-45", color)} />
              </>
            )}
            <span className={cn("h-4 w-px", popped ? "bg-white/10" : "bg-white/30")} />
          </span>
        );
      })}
    </div>
  );
}

function slotGroups(slots: LetterSlot[]): LetterSlot[][] {
  const groups: LetterSlot[][] = [[]];
  for (const s of slots) {
    if (s.char === " ") groups.push([]);
    else groups[groups.length - 1].push(s);
  }
  return groups.filter((g) => g.length > 0);
}

/**
 * Word Rescue — guess the word from its meaning before the balloons pop.
 * A non-violent hangman: 6 balloons per word, 5 words a round, an on-screen
 * A–Z keyboard plus the physical keyboard. Best score lives in localStorage.
 * Practice only: no XP, no API.
 */
export function WordRescue({ seed }: { seed?: number }) {
  const today = tashkentDateKey();
  const [phase, setPhase] = useState<Phase>("idle");
  const [run, setRun] = useState<RescueRun | null>(null);
  const [card, setCard] = useState<Flashcard | null>(null);
  const [round, setRound] = useState<RescueState | null>(null);
  const [store, setStore] = useState<RescueStore>(EMPTY_STORE);
  const [isNewBest, setIsNewBest] = useState(false);
  const [status, setStatus] = useState("");

  const plays = useRef(0);
  const clueRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLHeadingElement>(null);
  const focusClue = useRef(false);
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});

  const over = !!round && isRescueOver(round);
  const won = !!round && isRescueWon(round);

  useEffect(() => {
    setStore(loadJson(RESCUE_STORAGE_KEY, EMPTY_STORE));
  }, []);

  useEffect(() => {
    if (over) nextRef.current?.focus();
  }, [over]);

  useEffect(() => {
    if (phase === "end") endRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (!focusClue.current) return;
    focusClue.current = false;
    clueRef.current?.focus();
  }, [card]);

  const start = () => {
    const s = plays.current === 0 && seed != null ? seed : plays.current === 0 ? dailySeed(today, "word-rescue") : randomSeed();
    plays.current += 1;
    const words = dealRescue(s);
    if (words.length === 0) return;
    focusClue.current = true;
    setRun(startRun(words));
    setCard(words[0]);
    setRound(newRescue(words[0].word));
    setIsNewBest(false);
    setPhase("play");
    setStatus(`Word 1 of ${words.length}. Read the meaning and pick a letter.`);
  };

  const finish = (done: RescueRun) => {
    const newBest = done.score > store.bestScore;
    const nextStore: RescueStore = {
      bestScore: Math.max(store.bestScore, done.score),
      bestStreak: Math.max(store.bestStreak, done.bestStreak),
    };
    if (nextStore.bestScore !== store.bestScore || nextStore.bestStreak !== store.bestStreak) {
      setStore(nextStore);
      saveJson(RESCUE_STORAGE_KEY, nextStore);
    }
    if ((newBest && done.score > 0) || done.rescued === done.words.length) {
      fireConfetti();
      if (newBest) toast.success("New best score 🎈");
    }
    setIsNewBest(newBest && done.score > 0);
    setPhase("end");
    setStatus(`Round over: ${done.rescued} of ${done.words.length} words rescued, ${done.score} points.`);
  };

  const guess = (letter: string) => {
    if (phase !== "play" || !round || !run || isRescueOver(round)) return;
    const L = letter.toUpperCase();
    const next = guessLetter(round, letter);
    if (next === round) {
      if (round.guessed.includes(letter.toLowerCase())) setStatus(`You already tried ${L}.`);
      return;
    }
    setRound(next);
    const answer = round.answer.toUpperCase();
    if (isRescueWon(next)) {
      const settled = settleWord(run, true, next.lives);
      setRun(settled);
      setStatus(`Rescued! The word is ${answer}. +${settled.score - run.score} points.`);
    } else if (isRescueLost(next)) {
      setRun(settleWord(run, false, 0));
      setStatus(`No ${L}. The last balloon popped. The word was ${answer}.`);
    } else if (next.last?.type === "hit") {
      setStatus(`Yes! ${L} is in the word${next.last.count > 1 ? ` ${next.last.count} times` : ""}.`);
    } else {
      setStatus(`No ${L}. A balloon popped, ${next.lives} left.`);
    }
  };

  const nextWord = () => {
    if (!run || !round || !isRescueOver(round)) return;
    if (isRunOver(run)) {
      finish(run);
      return;
    }
    const c = run.words[run.index];
    focusClue.current = true;
    setCard(c);
    setRound(newRescue(c.word));
    setStatus(`Word ${run.index + 1} of ${run.words.length}. Pick a letter.`);
  };

  // Physical keyboard: letters guess, Enter moves on once a word is over.
  useEffect(() => {
    keyHandler.current = (e: KeyboardEvent) => {
      if (phase !== "play" || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (/^[a-z]$/i.test(e.key)) {
        e.preventDefault();
        guess(e.key);
      } else if (e.key === "Enter" && over && target?.tagName !== "BUTTON") {
        e.preventDefault();
        nextWord();
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
  if (phase === "idle" || !run || !round || !card) {
    return (
      <Card className="glass relative overflow-hidden border-averna-purple/30">
        <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-averna-purple/10 blur-3xl" />
        <CardContent className="relative space-y-4 px-3 py-5 sm:px-5">
          <Balloons lives={RESCUE_LIVES} over />
          <div className="space-y-1 text-center">
            <p className="flex items-center justify-center gap-2 font-semibold text-white">
              <LifeBuoy className="h-5 w-5 text-averna-purple" aria-hidden="true" /> Save the word
            </p>
            <p className="mx-auto max-w-md text-sm text-gray-400">
              Read the meaning, then guess the word one letter at a time. Each wrong letter pops a balloon, and you have{" "}
              {RESCUE_LIVES} per word. Five words a round.
            </p>
            <p className="flex items-center justify-center gap-1 text-xs text-gray-400">
              <Trophy className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
              {store.bestScore > 0 ? `Best score ${store.bestScore} · best streak ${store.bestStreak}` : "No best score yet"}
            </p>
          </div>
          <div className="flex justify-center">
            <Button type="button" onClick={start} className="neon-button bg-averna-purple text-white hover:bg-averna-purple/80">
              <LifeBuoy className="mr-2 h-4 w-4" aria-hidden="true" /> Start rescue
            </Button>
          </div>
          {statusLine}
          <GameFooter />
        </CardContent>
      </Card>
    );
  }

  // ---- End ----
  if (phase === "end") {
    return (
      <Card className={cn("glass relative overflow-hidden", isNewBest ? "border-averna-neon/50" : "border-averna-purple/40")}>
        <CardContent className="relative space-y-4 px-3 py-6 text-center sm:px-5">
          <PartyPopper className="mx-auto h-10 w-10 text-averna-purple" aria-hidden="true" />
          <h2 ref={endRef} tabIndex={-1} className="text-xl font-bold text-white focus:outline-none">
            {run.rescued === run.words.length ? "Every word rescued!" : "Round complete"}
          </h2>
          <div className="mx-auto grid max-w-sm grid-cols-3 gap-2">
            <GameStat label="Rescued" value={`${run.rescued}/${run.words.length}`} />
            <GameStat label="Score" icon={Star} value={run.score} />
            <GameStat label="Streak" icon={Flame} value={run.bestStreak} />
          </div>
          <p className="text-xs text-gray-400">
            {isNewBest ? "New best score!" : `Best score ${store.bestScore} · best streak ${store.bestStreak}`}
          </p>
          <ul className="mx-auto grid max-w-xl gap-1.5 text-left sm:grid-cols-2">
            {run.words.map((w) => (
              <li key={w.word} className="min-w-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
                <span className="font-semibold text-white">{w.word}</span>
                <span className="text-gray-400"> — {w.meaning}</span>
              </li>
            ))}
          </ul>
          <Button type="button" onClick={start} className="neon-button bg-averna-purple text-white hover:bg-averna-purple/80">
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" /> Play again
          </Button>
          {statusLine}
          <GameFooter />
        </CardContent>
      </Card>
    );
  }

  // ---- Play ----
  const slots = letterSlots(round.answer, round.guessed);
  const pattern = slots
    .map((s) => (s.char === " " ? "space" : !s.isLetter ? s.char : s.revealed ? s.char.toUpperCase() : "blank"))
    .join(" ");
  const meaning = blankWord(card.meaning, card.word).text;
  const example = blankWord(card.example, card.word);
  const inWord = answerLetters(round.answer);

  return (
    <Card className="glass relative overflow-hidden border-averna-purple/40">
      <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-averna-purple/10 blur-3xl" />
      <CardContent className="relative space-y-4 px-3 py-4 sm:px-5 sm:py-5">
        <div className="grid grid-cols-3 gap-2">
          <GameStat label="Word" value={`${Math.min(run.index + (over ? 0 : 1), run.words.length)}/${run.words.length}`} />
          <GameStat label="Score" icon={Star} value={run.score} />
          <GameStat label="Streak" icon={Flame} value={run.streak} />
        </div>

        <Balloons lives={round.lives} over={over} />

        <div ref={clueRef} tabIndex={-1} className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 text-center focus:outline-none sm:p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-averna-purple">Meaning</p>
          <p className="text-base text-white">{meaning}</p>
          {example.found && (
            <p className="text-sm italic text-gray-400">
              <span className="sr-only">Example: </span>“{example.text}”
            </p>
          )}
        </div>

        <div role="img" aria-label={`Word: ${pattern}`} className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          {slotGroups(slots).map((group, gi) => (
            <span key={gi} aria-hidden="true" className="flex gap-0.5 sm:gap-1.5">
              {group.map((s, si) =>
                s.isLetter ? (
                  <span
                    key={si}
                    className={cn(
                      "grid h-10 w-[1.15rem] place-items-center border-b-2 font-mono text-lg font-bold uppercase sm:h-11 sm:w-8 sm:text-2xl",
                      s.revealed ? "border-averna-purple/70 text-white" : over ? "border-red-400/60 text-red-400" : "border-white/30 text-transparent",
                    )}
                  >
                    {s.revealed || over ? s.char : "\u00a0"}
                  </span>
                ) : (
                  <span key={si} className="grid h-10 place-items-center font-mono text-lg font-bold text-gray-400 sm:h-11 sm:text-2xl">
                    {s.char}
                  </span>
                ),
              )}
            </span>
          ))}
        </div>

        {over ? (
          <div
            className={cn(
              "space-y-2 rounded-2xl border p-4 text-center duration-300 animate-in fade-in zoom-in-95 motion-reduce:animate-none",
              won ? "border-averna-neon/40 bg-averna-neon/10" : "border-red-400/40 bg-red-400/10",
            )}
          >
            <p className="flex items-center justify-center gap-2 text-lg font-bold text-white">
              {won ? <PartyPopper className="h-5 w-5 text-averna-neon" aria-hidden="true" /> : <X className="h-5 w-5 text-red-400" aria-hidden="true" />}
              {won ? "Rescued!" : "Popped!"}
            </p>
            <p className="text-sm text-gray-300">
              <span className="font-semibold text-white">{card.word}</span> — {card.meaning}
            </p>
            <p className="text-xs text-gray-400">
              <span aria-hidden="true">🇺🇿 </span>
              <span lang="uz">{card.uz}</span>
            </p>
            <Button ref={nextRef} type="button" onClick={nextWord} className="neon-button bg-averna-purple text-white hover:bg-averna-purple/80">
              {isRunOver(run) ? "See results" : "Next word"} <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <div role="group" aria-label="Letter keyboard" className="mx-auto grid max-w-md grid-cols-7 gap-1 sm:gap-1.5">
            {ALPHABET.map((l) => {
              const tried = round.guessed.includes(l);
              const hit = tried && inWord.has(l);
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => guess(l)}
                  aria-disabled={tried || undefined}
                  aria-label={`Letter ${l.toUpperCase()}${tried ? (hit ? ", in the word" : ", not in the word") : ""}`}
                  className={cn(
                    "relative flex h-11 min-w-0 items-center justify-center rounded-lg border text-base font-semibold uppercase transition-colors",
                    FOCUS_RING,
                    !tried && "border-white/15 bg-white/5 text-white hover:border-averna-purple/50 hover:bg-averna-purple/15",
                    hit && "cursor-default border-averna-neon/50 bg-averna-neon/15 text-averna-neon",
                    tried && !hit && "cursor-default border-white/5 bg-transparent text-gray-500 line-through",
                  )}
                >
                  {l}
                  {hit && <Check className="absolute right-0.5 top-0.5 h-3 w-3" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        )}

        {statusLine}
        <GameFooter>
          <span className="hidden sm:inline">Tip: type letters on your keyboard ·</span>
        </GameFooter>
      </CardContent>
    </Card>
  );
}
