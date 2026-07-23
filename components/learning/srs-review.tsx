"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2, Sparkles, RotateCcw, PartyPopper } from "lucide-react";
import type { Flashcard } from "@/lib/flashcards-data";
import {
  loadSrs,
  saveSrs,
  schedule,
  isDue,
  isNew,
  intervalHint,
  type Rating,
  type SrsMap,
} from "@/lib/srs";

const NEW_PER_SESSION = 20;
const MAX_QUEUE = 60;

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-GB";
  window.speechSynthesis.speak(u);
}

/**
 * Spaced-repetition review session over the whole vocabulary pool. Builds a
 * queue of due + a capped number of new cards, shows one at a time, and
 * schedules the next review from the learner's rating (Again/Hard/Good/Easy).
 */
export function SrsReview({ cards }: { cards: Flashcard[] }) {
  // De-duplicate the pool by word (decks may share entries).
  const pool = useMemo(() => {
    const seen = new Set<string>();
    return cards.filter((c) => (seen.has(c.word) ? false : (seen.add(c.word), true)));
  }, [cards]);

  const mapRef = useRef<SrsMap>({});
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [ready, setReady] = useState(false);

  // Build the session queue on mount.
  useEffect(() => {
    const map = loadSrs();
    mapRef.current = map;
    const now = Date.now();

    const dueExisting = pool.filter((c) => !isNew(map[c.word]) && isDue(map[c.word], now));
    const fresh = pool.filter((c) => isNew(map[c.word])).slice(0, NEW_PER_SESSION);

    const combined = [...dueExisting, ...fresh].slice(0, MAX_QUEUE);
    // Light shuffle so order isn't always deck order.
    combined.sort(() => Math.random() - 0.5);

    setQueue(combined);
    setReady(true);
  }, [pool]);

  const current = queue[0];

  const rate = (rating: Rating) => {
    if (!current) return;
    const map = mapRef.current;
    map[current.word] = schedule(map[current.word], rating);
    saveSrs(map);
    setReviewed((n) => n + 1);
    setFlipped(false);

    setQueue((q) => {
      const [, ...rest] = q;
      // "again" cards come back near the end of this session.
      return rating === "again" ? [...rest, current] : rest;
    });
  };

  if (!ready) return null;

  // Completion state
  if (!current) {
    return (
      <Card className="glass border-averna-neon/40">
        <CardContent className="text-center py-16">
          <PartyPopper className="h-12 w-12 text-averna-neon mx-auto mb-4" />
          <p className="text-xl font-bold text-white">All caught up! 🎉</p>
          <p className="text-sm text-gray-400 mt-2">
            {reviewed > 0
              ? `You reviewed ${reviewed} card${reviewed === 1 ? "" : "s"}. Come back later for the next batch.`
              : "No cards are due right now — new words unlock as you study, and reviews come back on schedule."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const prevState = mapRef.current[current.word];
  const newBadge = isNew(prevState);

  const ratings: { key: Rating; label: string; cls: string }[] = [
    { key: "again", label: "Again", cls: "border-red-500/50 text-red-300 hover:bg-red-500/10" },
    { key: "hard", label: "Hard", cls: "border-amber-500/50 text-amber-300 hover:bg-amber-500/10" },
    { key: "good", label: "Good", cls: "border-averna-cyan/50 text-averna-cyan hover:bg-averna-cyan/10" },
    { key: "easy", label: "Easy", cls: "border-averna-neon/50 text-averna-neon hover:bg-averna-neon/10" },
  ];

  return (
    <div>
      {/* Progress */}
      <div className="flex items-center justify-between mb-4 text-sm">
        <span className="text-gray-400">{queue.length} left in this session</span>
        <span className="text-averna-neon font-semibold flex items-center gap-1">
          <RotateCcw className="h-3.5 w-3.5" /> {reviewed} reviewed
        </span>
      </div>

      <button onClick={() => setFlipped((f) => !f)} className="w-full text-left" style={{ perspective: "1000px" }}>
        <div
          className="relative w-full h-72 transition-transform duration-500"
          style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          {/* Front */}
          <Card className="glass border-averna-purple/40 absolute inset-0 flex items-center justify-center" style={{ backfaceVisibility: "hidden" }}>
            <CardContent className="text-center py-10">
              {newBadge ? (
                <span className="inline-block text-[10px] uppercase tracking-widest text-averna-pink mb-3">new word</span>
              ) : (
                <span className="inline-block text-[10px] uppercase tracking-widest text-averna-cyan mb-3">review</span>
              )}
              <p className="text-4xl font-bold text-white">{current.word}</p>
              <p className="text-xs text-gray-500 mt-4">tap to reveal</p>
            </CardContent>
          </Card>
          {/* Back */}
          <Card className="glass-strong border-averna-cyan/40 absolute inset-0 flex items-center justify-center" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <CardContent className="text-center py-8 px-6">
              <p className="text-lg text-averna-cyan font-semibold mb-2">{current.meaning}</p>
              <p className="text-sm text-gray-300 italic mb-3">&ldquo;{current.example}&rdquo;</p>
              <div className="pt-3 border-t border-white/10">
                <p className="text-xs uppercase tracking-widest text-averna-neon mb-1">Oʻzbekcha</p>
                <p className="text-base text-white font-medium">{current.uz}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </button>

      {/* Pronounce */}
      <div className="flex justify-center mt-4">
        <Button onClick={() => speak(`${current.word}. ${current.example}`)} variant="ghost" size="sm" className="text-averna-pink">
          <Volume2 className="mr-2 h-4 w-4" /> Pronounce
        </Button>
      </div>

      {/* Ratings — revealed after flip */}
      {flipped ? (
        <div className="grid grid-cols-4 gap-2 mt-4">
          {ratings.map((r) => (
            <button
              key={r.key}
              onClick={() => rate(r.key)}
              className={`flex flex-col items-center gap-0.5 py-2.5 rounded-lg border bg-white/5 transition-colors ${r.cls}`}
            >
              <span className="text-sm font-medium">{r.label}</span>
              <span className="text-[10px] opacity-70">{intervalHint(prevState, r.key)}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-center text-xs text-gray-500 mt-4 flex items-center justify-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-averna-purple" /> Recall the meaning, then tap the card to grade yourself.
        </p>
      )}
    </div>
  );
}
