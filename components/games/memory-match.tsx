"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { FOCUS_RING, GameFooter, GameStat, formatClock } from "@/components/games/game-ui";
import { fireConfetti } from "@/lib/confetti";
import { cn, tashkentDateKey } from "@/lib/utils";
import { dailySeed, randomSeed } from "@/lib/games/rng";
import { loadJson, saveJson, shortMeaning } from "@/lib/games/words";
import {
  MEMORY_FLIP_BACK_MS,
  MEMORY_PAIRS,
  MEMORY_STORAGE_KEY,
  closeOpen,
  dealMemory,
  flipCard,
  initMemory,
  isFaceUp,
  isMatched,
  isMemoryWon,
  memoryBestKey,
  recordMemoryBest,
  type MemoryDeal,
  type MemoryState,
  type MemoryStore,
} from "@/lib/games/memory-match";
import { Brain, Check, LayoutGrid, RotateCcw, Shuffle, Timer, Trophy, X } from "lucide-react";

const EMPTY_STORE: MemoryStore = { best: {} };

/**
 * Memory Match — flip cards and pair each word with its meaning. Today's board
 * (one deck, 6 pairs) is the same for everyone; "New board" deals a random one.
 * Fewest moves per day is kept in localStorage. Practice only: no XP, no API.
 */
export function MemoryMatch({ seed }: { seed?: number }) {
  const today = tashkentDateKey();
  const [deal, setDeal] = useState<MemoryDeal>(() => dealMemory(seed ?? dailySeed(today, "memory-match")));
  const [game, setGame] = useState<MemoryState>(() => initMemory(deal.cards));
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [result, setResult] = useState<{ moves: number; ms: number; isNewBest: boolean } | null>(null);
  const [store, setStore] = useState<MemoryStore>(EMPTY_STORE);
  const [status, setStatus] = useState("Tap any card to start. Pair each word with its meaning.");

  const flipBack = useRef<ReturnType<typeof setTimeout> | null>(null);
  const winHeading = useRef<HTMLHeadingElement>(null);
  const grid = useRef<HTMLUListElement>(null);
  const focusBoard = useRef(false);

  const pairs = deal.pairs.length || MEMORY_PAIRS;
  const bestKey = memoryBestKey(today, pairs);
  const best = store.best?.[bestKey];

  useEffect(() => {
    setStore(loadJson(MEMORY_STORAGE_KEY, EMPTY_STORE));
    return () => {
      if (flipBack.current) clearTimeout(flipBack.current);
    };
  }, []);

  // The clock ticks from the first flip until the board is cleared.
  useEffect(() => {
    if (startedAt == null || result) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedAt, result]);

  useEffect(() => {
    if (result) winHeading.current?.focus();
  }, [result]);

  useEffect(() => {
    if (!focusBoard.current) return;
    focusBoard.current = false;
    grid.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [deal]);

  const elapsed = result ? result.ms : startedAt == null ? 0 : Math.max(0, now - startedAt);

  const newBoard = (focus = false) => {
    if (flipBack.current) clearTimeout(flipBack.current);
    const next = dealMemory(randomSeed());
    focusBoard.current = focus;
    setDeal(next);
    setGame(initMemory(next.cards));
    setStartedAt(null);
    setNow(0);
    setResult(null);
    setStatus(`New board: ${next.deck.name}. Tap any card to start.`);
  };

  const finish = (final: MemoryState, ms: number) => {
    const recorded = recordMemoryBest(store, bestKey, { moves: final.moves, ms });
    if (recorded.isNewBest) {
      setStore(recorded.store);
      saveJson(MEMORY_STORAGE_KEY, recorded.store);
      toast.success(best ? "New best for today 🧠" : "Board cleared — that's today's best to beat 🧠");
    }
    fireConfetti();
    setResult({ moves: final.moves, ms, isNewBest: recorded.isNewBest });
    setStatus(`Board cleared in ${final.moves} moves and ${formatClock(ms)}.`);
  };

  const onFlip = (index: number) => {
    if (result) return;
    const next = flipCard(game, index);
    if (next === game) return;
    let t0 = startedAt;
    if (t0 == null) {
      t0 = Date.now();
      setStartedAt(t0);
      setNow(t0);
    }
    setGame(next);
    const ev = next.last;
    if (!ev) return;
    if (ev.type === "open") {
      const card = next.cards[index];
      setStatus(`${card.kind === "word" ? "Word" : "Meaning"}: ${card.text}. Now find its pair.`);
    } else if (ev.type === "match") {
      const pair = deal.pairs[ev.pairId];
      if (isMemoryWon(next)) finish(next, Date.now() - t0);
      else setStatus(`Match! ${pair.word} means “${shortMeaning(pair.meaning)}”. ${next.matched.length} of ${pairs} pairs found.`);
    } else {
      setStatus("Not a pair. The cards will flip back.");
      if (flipBack.current) clearTimeout(flipBack.current);
      flipBack.current = setTimeout(() => setGame((g) => closeOpen(g)), MEMORY_FLIP_BACK_MS);
    }
  };

  return (
    <Card className="glass relative overflow-hidden border-averna-cyan/30">
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-averna-cyan/10 blur-3xl" />
      <CardContent className="relative space-y-4 px-3 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
            <span aria-hidden="true">{deal.deck.emoji}</span>
            <span className="truncate">{deal.deck.name}</span>
            <span className="shrink-0 text-xs font-normal text-gray-400">· {pairs} pairs</span>
          </p>
          <Button type="button" variant="outline" onClick={() => newBoard()} className="h-11 border-white/20 bg-transparent px-3 sm:h-10">
            <Shuffle className="mr-2 h-4 w-4" aria-hidden="true" /> New board
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <GameStat label="Moves" icon={LayoutGrid} value={result ? result.moves : game.moves} />
          <GameStat label="Time" icon={Timer} value={formatClock(elapsed)} />
          <GameStat label="Best" icon={Trophy} value={best ? best.moves : "—"} />
        </div>

        {result ? (
          <section
            aria-labelledby="memory-win"
            className="space-y-3 rounded-2xl border border-averna-neon/40 bg-averna-neon/10 p-4 text-center duration-300 animate-in fade-in zoom-in-95 motion-reduce:animate-none sm:p-5"
          >
            <Trophy className="mx-auto h-10 w-10 text-amber-400" aria-hidden="true" />
            <h2 id="memory-win" ref={winHeading} tabIndex={-1} className="text-xl font-bold text-white focus:outline-none">
              Board cleared!
            </h2>
            <p className="text-sm text-gray-300">
              {result.moves} moves · {formatClock(result.ms)}
            </p>
            <p className="text-xs text-gray-400">
              {result.isNewBest ? "New best for today" : best ? `Today's best: ${best.moves} moves · ${formatClock(best.ms)}` : null}
            </p>
            <ul className="mx-auto grid max-w-xl gap-1.5 text-left sm:grid-cols-2">
              {deal.pairs.map((p) => (
                <li key={p.word} className="min-w-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
                  <span className="font-semibold text-white">{p.word}</span>
                  <span className="text-gray-400"> — {shortMeaning(p.meaning)}</span>
                </li>
              ))}
            </ul>
            <Button type="button" onClick={() => newBoard(true)} className="bg-averna-cyan text-gray-950 hover:bg-averna-cyan/80">
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" /> Play again
            </Button>
          </section>
        ) : (
          <ul ref={grid} className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3" aria-label={`Memory board, ${deal.cards.length} cards`}>
            {deal.cards.map((card, i) => {
              const faceUp = isFaceUp(game, i);
              const matched = isMatched(game, i);
              const missed = !matched && game.open.length === 2 && game.open.includes(i);
              const kind = card.kind === "word" ? "Word" : "Meaning";
              const label = faceUp
                ? `Card ${i + 1}, ${kind.toLowerCase()}: ${card.text}${matched ? ", matched" : missed ? ", not a pair" : ""}`
                : `Card ${i + 1}, face down`;
              return (
                <li key={card.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onFlip(i)}
                    aria-label={label}
                    aria-disabled={matched || undefined}
                    className={cn(
                      "group relative block h-28 w-full rounded-xl [perspective:800px] sm:h-32",
                      FOCUS_RING,
                      matched ? "cursor-default" : "cursor-pointer",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute inset-0 rounded-xl transition-transform duration-500 ease-out [transform-style:preserve-3d] motion-reduce:transition-none",
                        faceUp && "[transform:rotateY(180deg)]",
                      )}
                    >
                      {/* Back */}
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 grid place-items-center rounded-xl border border-white/15 bg-gradient-to-br from-averna-cyan/25 via-averna-purple/15 to-averna-pink/25 transition-colors [backface-visibility:hidden] group-hover:border-white/30"
                      >
                        <span className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/10">
                          <Brain className="h-5 w-5 text-white/70" />
                        </span>
                      </span>
                      {/* Face */}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute inset-0 flex flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border p-1.5 text-center [backface-visibility:hidden] [transform:rotateY(180deg)] sm:p-2",
                          matched
                            ? "border-averna-neon/60 bg-averna-neon/15"
                            : missed
                              ? "border-red-400/60 bg-red-400/10"
                              : card.kind === "word"
                                ? "border-averna-cyan/50 bg-averna-cyan/10"
                                : "border-averna-purple/50 bg-averna-purple/10",
                        )}
                      >
                        <span
                          className={cn(
                            "flex shrink-0 items-center gap-1 text-xs font-medium",
                            matched ? "text-averna-neon" : missed ? "text-red-400" : "text-gray-400",
                          )}
                        >
                          {matched ? <Check className="h-3.5 w-3.5" /> : missed ? <X className="h-3.5 w-3.5" /> : null}
                          {kind}
                        </span>
                        <span
                          lang="en"
                          className={cn(
                            "max-w-full hyphens-auto [overflow-wrap:anywhere]",
                            card.kind === "word"
                              ? cn("line-clamp-3 font-semibold leading-tight text-white", card.text.length > 10 ? "text-xs sm:text-sm" : "text-sm sm:text-base")
                              : "line-clamp-5 text-xs leading-tight text-gray-200 sm:line-clamp-4 sm:text-sm",
                          )}
                        >
                          {card.text}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p role="status" aria-live="polite" className="min-h-[1.25rem] text-center text-sm text-gray-300">
          {status}
        </p>
        <GameFooter />
      </CardContent>
    </Card>
  );
}
