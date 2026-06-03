"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layers, RotateCcw, Shuffle, Check, ChevronLeft, ChevronRight } from "lucide-react";

interface Flashcard {
  word: string;
  meaning: string;
  example: string;
}

const DECK: Flashcard[] = [
  { word: "Abundant", meaning: "Existing in large quantities; plentiful.", example: "The region has abundant natural resources." },
  { word: "Concise", meaning: "Giving a lot of information clearly in few words.", example: "Keep your introduction concise and clear." },
  { word: "Deteriorate", meaning: "To become progressively worse.", example: "Air quality can deteriorate in big cities." },
  { word: "Enhance", meaning: "To improve the quality or value of something.", example: "Reading enhances your vocabulary." },
  { word: "Feasible", meaning: "Possible to do easily or conveniently.", example: "Is it feasible to finish the project by Friday?" },
  { word: "Gradual", meaning: "Happening slowly over a period of time.", example: "There was a gradual improvement in her scores." },
  { word: "Hinder", meaning: "To make it difficult to do something.", example: "Noise can hinder concentration while studying." },
  { word: "Inevitable", meaning: "Certain to happen; unavoidable.", example: "Change is inevitable in any growing company." },
  { word: "Notion", meaning: "A belief or idea.", example: "She rejected the notion that talent is fixed." },
  { word: "Prominent", meaning: "Important or well known.", example: "He is a prominent figure in education." },
  { word: "Reluctant", meaning: "Unwilling and hesitant.", example: "Students are sometimes reluctant to speak." },
  { word: "Vital", meaning: "Absolutely necessary; essential.", example: "Daily practice is vital for fluency." },
];

export default function FlashcardsPage() {
  const [cards, setCards] = useState<Flashcard[]>(DECK);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem("averna_known_cards");
      if (saved) setKnown(new Set(JSON.parse(saved)));
    } catch {}
  }, []);

  const persist = (s: Set<string>) => {
    try {
      localStorage.setItem("averna_known_cards", JSON.stringify(Array.from(s)));
    } catch {}
  };

  const card = cards[index];

  const next = () => {
    setFlipped(false);
    setIndex((i) => (i + 1) % cards.length);
  };
  const prev = () => {
    setFlipped(false);
    setIndex((i) => (i - 1 + cards.length) % cards.length);
  };

  const markKnown = () => {
    const s = new Set(known);
    s.add(card.word);
    setKnown(s);
    persist(s);
    next();
  };

  const shuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setIndex(0);
    setFlipped(false);
  };

  const resetProgress = () => {
    setKnown(new Set());
    persist(new Set());
  };

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Layers className="h-9 w-9 text-averna-purple" />
          Vocabulary <span className="neon-text-purple">Flashcards</span>
        </h1>
        <p className="text-gray-400 mb-6">
          Tap the card to flip. Mark words you know — your progress is saved. 🧠
        </p>

        <div className="flex items-center justify-between mb-4 text-sm">
          <span className="text-gray-400">
            Card {index + 1} / {cards.length}
          </span>
          <span className="text-averna-neon font-semibold">
            {known.size} / {DECK.length} mastered
          </span>
        </div>

        {/* Flip card */}
        <button
          onClick={() => setFlipped((f) => !f)}
          className="w-full text-left"
          style={{ perspective: "1000px" }}
        >
          <div
            className="relative w-full h-64 transition-transform duration-500"
            style={{
              transformStyle: "preserve-3d",
              transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
          >
            {/* Front */}
            <Card
              className="glass border-averna-purple/40 absolute inset-0 flex items-center justify-center"
              style={{ backfaceVisibility: "hidden" }}
            >
              <CardContent className="text-center py-10">
                <p className="text-4xl font-bold text-white">{card.word}</p>
                {known.has(card.word) && (
                  <span className="mt-3 inline-block text-xs text-averna-neon">✓ mastered</span>
                )}
                <p className="text-xs text-gray-500 mt-4">tap to see meaning</p>
              </CardContent>
            </Card>
            {/* Back */}
            <Card
              className="glass-strong border-averna-cyan/40 absolute inset-0 flex items-center justify-center"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <CardContent className="text-center py-8 px-6">
                <p className="text-lg text-averna-cyan font-semibold mb-2">{card.meaning}</p>
                <p className="text-sm text-gray-300 italic">&ldquo;{card.example}&rdquo;</p>
              </CardContent>
            </Card>
          </div>
        </button>

        {/* Controls */}
        <div className="flex items-center justify-between mt-6 gap-2">
          <Button onClick={prev} variant="outline" className="border-white/20">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button onClick={markKnown} className="neon-button bg-averna-primary hover:bg-averna-light flex-1">
            <Check className="mr-2 h-4 w-4" /> I know this
          </Button>
          <Button onClick={next} variant="outline" className="border-white/20">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex justify-center gap-3 mt-4">
          <Button onClick={shuffle} variant="ghost" size="sm" className="text-averna-cyan">
            <Shuffle className="mr-2 h-4 w-4" /> Shuffle
          </Button>
          <Button onClick={resetProgress} variant="ghost" size="sm" className="text-gray-400">
            <RotateCcw className="mr-2 h-4 w-4" /> Reset progress
          </Button>
        </div>
      </div>
    </div>
  );
}
