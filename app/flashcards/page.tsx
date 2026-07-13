"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layers, RotateCcw, Shuffle, Check, ChevronLeft, ChevronRight, Volume2, Search } from "lucide-react";
import { DECKS, type Flashcard } from "@/lib/flashcards-data";

export default function FlashcardsPage() {
  const [deckId, setDeckId] = useState(DECKS[0].id);
  const [cards, setCards] = useState<Flashcard[]>(DECKS[0].cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [onlyUnknown, setOnlyUnknown] = useState(false);

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

  const deck = DECKS.find((d) => d.id === deckId)!;

  const visibleCards = useMemo(() => {
    let list = cards;
    if (onlyUnknown) list = list.filter((c) => !known.has(c.word));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.word.toLowerCase().includes(q) ||
          c.meaning.toLowerCase().includes(q) ||
          c.uz.toLowerCase().includes(q)
      );
    }
    return list;
  }, [cards, onlyUnknown, known, query]);

  const card = visibleCards[index] || visibleCards[0];

  const selectDeck = (id: string) => {
    const d = DECKS.find((x) => x.id === id)!;
    setDeckId(id);
    setCards(d.cards);
    setIndex(0);
    setFlipped(false);
  };

  const next = () => {
    setFlipped(false);
    setIndex((i) => (visibleCards.length ? (i + 1) % visibleCards.length : 0));
  };
  const prev = () => {
    setFlipped(false);
    setIndex((i) => (visibleCards.length ? (i - 1 + visibleCards.length) % visibleCards.length : 0));
  };

  const markKnown = () => {
    if (!card) return;
    const s = new Set(known);
    s.add(card.word);
    setKnown(s);
    persist(s);
    next();
  };

  const shuffle = () => {
    setCards((c) => [...c].sort(() => Math.random() - 0.5));
    setIndex(0);
    setFlipped(false);
  };

  const resetProgress = () => {
    setKnown(new Set());
    persist(new Set());
  };

  const speak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    window.speechSynthesis.speak(u);
  };

  const knownInDeck = deck.cards.filter((c) => known.has(c.word)).length;
  const totalKnown = known.size;
  const totalWords = DECKS.reduce((sum, d) => sum + d.cards.length, 0);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-2xl pb-24 lg:pb-8">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Layers className="h-9 w-9 text-averna-purple" />
          Vocabulary <span className="neon-text-purple">Flashcards</span>
        </h1>
        <p className="text-gray-400 mb-1">
          Real IELTS vocabulary with Uzbek translations. Tap a card to flip. 🧠
        </p>
        <p className="text-xs text-averna-neon mb-5">
          {totalKnown} / {totalWords} words mastered across all decks
        </p>

        {/* Deck selector */}
        <div className="flex flex-wrap gap-2 mb-4">
          {DECKS.map((d) => {
            const dk = d.cards.filter((c) => known.has(c.word)).length;
            return (
              <button
                key={d.id}
                onClick={() => selectDeck(d.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  deckId === d.id
                    ? "bg-averna-purple/20 border-averna-purple text-averna-purple"
                    : "bg-white/5 border-white/10 text-gray-300 hover:border-averna-purple/40"
                }`}
                title={`${dk}/${d.cards.length} mastered`}
              >
                {d.emoji} {d.name}
                <span className="ml-1 text-xs opacity-70">
                  {dk}/{d.cards.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search + filter */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIndex(0);
                setFlipped(false);
              }}
              placeholder="Search word, meaning or Uzbek…"
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:border-averna-purple/60 outline-none"
            />
          </div>
          <button
            onClick={() => {
              setOnlyUnknown((v) => !v);
              setIndex(0);
              setFlipped(false);
            }}
            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
              onlyUnknown
                ? "bg-averna-neon/20 border-averna-neon text-averna-neon"
                : "bg-white/5 border-white/10 text-gray-300 hover:border-averna-neon/40"
            }`}
          >
            {onlyUnknown ? "All" : "Unknown only"}
          </button>
        </div>

        <div className="flex items-center justify-between mb-4 text-sm">
          <span className="text-gray-400">
            {visibleCards.length > 0 ? `Card ${index + 1} / ${visibleCards.length}` : "No cards"}
          </span>
          <span className="text-averna-neon font-semibold">
            {knownInDeck} / {deck.cards.length} in {deck.name}
          </span>
        </div>

        {!card ? (
          <Card className="glass border-averna-purple/40">
            <CardContent className="text-center py-16 text-gray-400">
              No cards match your filter. Try clearing the search or turning off &quot;Unknown only&quot;.
            </CardContent>
          </Card>
        ) : (
          <button onClick={() => setFlipped((f) => !f)} className="w-full text-left" style={{ perspective: "1000px" }}>
            <div
              className="relative w-full h-72 transition-transform duration-500"
              style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
            >
              <Card
                className="glass border-averna-purple/40 absolute inset-0 flex items-center justify-center"
                style={{ backfaceVisibility: "hidden" }}
              >
                <CardContent className="text-center py-10">
                  <p className="text-xs uppercase tracking-widest text-averna-purple mb-2">{deck.band}</p>
                  <p className="text-4xl font-bold text-white">{card.word}</p>
                  {known.has(card.word) && (
                    <span className="mt-3 inline-block text-xs text-averna-neon">✓ mastered</span>
                  )}
                  <p className="text-xs text-gray-500 mt-4">tap to see meaning</p>
                </CardContent>
              </Card>
              <Card
                className="glass-strong border-averna-cyan/40 absolute inset-0 flex items-center justify-center"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <CardContent className="text-center py-8 px-6">
                  <p className="text-lg text-averna-cyan font-semibold mb-2">{card.meaning}</p>
                  <p className="text-sm text-gray-300 italic mb-3">&ldquo;{card.example}&rdquo;</p>
                  <div className="pt-3 border-t border-white/10">
                    <p className="text-xs uppercase tracking-widest text-averna-neon mb-1">Oʻzbekcha</p>
                    <p className="text-base text-white font-medium">{card.uz}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </button>
        )}

        {/* Controls */}
        {card && (
          <>
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

            <div className="flex justify-center gap-3 mt-4 flex-wrap">
              <Button onClick={() => speak(`${card.word}. ${card.example}`)} variant="ghost" size="sm" className="text-averna-pink">
                <Volume2 className="mr-2 h-4 w-4" /> Pronounce
              </Button>
              <Button onClick={shuffle} variant="ghost" size="sm" className="text-averna-cyan">
                <Shuffle className="mr-2 h-4 w-4" /> Shuffle
              </Button>
              <Button onClick={resetProgress} variant="ghost" size="sm" className="text-gray-400">
                <RotateCcw className="mr-2 h-4 w-4" /> Reset
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
