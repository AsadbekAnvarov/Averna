"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Layers, RotateCcw, Shuffle, Check, ChevronLeft, ChevronRight,
  Volume2, Search, BookOpen, Zap, X as XIcon, Trophy,
} from "lucide-react";
import { DECKS, type Flashcard } from "@/lib/flashcards-data";
import { SrsReview } from "@/components/learning/srs-review";
import { loadSrs, countDue } from "@/lib/srs";

type Mode = "study" | "quiz" | "srs";

export default function FlashcardsPage() {
  const [deckId, setDeckId] = useState(DECKS[0].id);
  const [mode, setMode] = useState<Mode>("study");
  const [cards, setCards] = useState<Flashcard[]>(DECKS[0].cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [onlyUnknown, setOnlyUnknown] = useState(false);

  // Quiz state
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [quizAnswered, setQuizAnswered] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });

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

  // Whole de-duplicated pool + how many cards are due for spaced review.
  const allCards = useMemo(() => {
    const seen = new Set<string>();
    return DECKS.flatMap((d) => d.cards).filter((c) => (seen.has(c.word) ? false : (seen.add(c.word), true)));
  }, []);
  const [dueCount, setDueCount] = useState(0);
  useEffect(() => {
    // Recompute due count on load and whenever we leave the review session.
    if (mode !== "srs") {
      setDueCount(countDue(allCards.map((c) => c.word), loadSrs()));
    }
  }, [mode, allCards]);

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

  const buildQuizOptions = useCallback((c: Flashcard | undefined, pool: Flashcard[]) => {
    if (!c) return [];
    const distractors = pool
      .filter((x) => x.word !== c.word)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((x) => x.meaning);
    return [c.meaning, ...distractors].sort(() => Math.random() - 0.5);
  }, []);

  // Regenerate quiz options whenever mode/current card changes
  useEffect(() => {
    if (mode === "quiz") {
      setQuizOptions(buildQuizOptions(card, deck.cards));
      setQuizAnswered(null);
    }
  }, [mode, index, deckId, card, deck.cards, buildQuizOptions]);

  const selectDeck = (id: string) => {
    const d = DECKS.find((x) => x.id === id)!;
    setDeckId(id);
    setCards(d.cards);
    setIndex(0);
    setFlipped(false);
    setQuizAnswered(null);
    if (mode === "quiz") setQuizScore({ correct: 0, total: 0 });
  };

  const next = () => {
    setFlipped(false);
    setQuizAnswered(null);
    setIndex((i) => (visibleCards.length ? (i + 1) % visibleCards.length : 0));
  };
  const prev = () => {
    setFlipped(false);
    setQuizAnswered(null);
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

  const answerQuiz = (optIdx: number) => {
    if (quizAnswered !== null || !card) return;
    setQuizAnswered(optIdx);
    const isCorrect = quizOptions[optIdx] === card.meaning;
    setQuizScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
    if (isCorrect) {
      const set = new Set(known);
      set.add(card.word);
      setKnown(set);
      persist(set);
    }
  };

  const shuffle = () => {
    setCards((c) => [...c].sort(() => Math.random() - 0.5));
    setIndex(0);
    setFlipped(false);
    setQuizAnswered(null);
  };

  const resetProgress = () => {
    setKnown(new Set());
    persist(new Set());
    setQuizScore({ correct: 0, total: 0 });
  };

  const speak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    window.speechSynthesis.speak(u);
  };

  const setModeAndReset = (m: Mode) => {
    setMode(m);
    setQuizAnswered(null);
    if (m === "quiz") setQuizScore({ correct: 0, total: 0 });
  };

  const knownInDeck = deck.cards.filter((c) => known.has(c.word)).length;
  const totalKnown = known.size;
  const totalWords = DECKS.reduce((sum, d) => sum + d.cards.length, 0);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-2xl pb-24 lg:pb-8">
        <PageHeader
          className="mb-2"
          back={{ href: "/dashboard", label: "Back to Dashboard" }}
          icon={Layers}
          iconClassName="text-averna-purple"
          title={<>Vocabulary <span className="neon-text-purple">Flashcards</span></>}
          subtitle="Real IELTS vocabulary with Uzbek translations. Study cards, then test yourself with the quiz. 🧠"
        />
        <p className="text-xs text-averna-neon mb-5">
          {totalKnown} / {totalWords} words mastered across all decks
        </p>

        {/* Mode toggle */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setModeAndReset("study")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${
              mode === "study"
                ? "bg-averna-purple/20 border-averna-purple text-averna-purple"
                : "border-white/10 text-gray-300 hover:border-averna-purple/40"
            }`}
          >
            <BookOpen className="h-4 w-4" /> Study
          </button>
          <button
            onClick={() => setModeAndReset("quiz")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${
              mode === "quiz"
                ? "bg-averna-neon/20 border-averna-neon text-averna-neon"
                : "border-white/10 text-gray-300 hover:border-averna-neon/40"
            }`}
          >
            <Zap className="h-4 w-4" /> Quiz
          </button>
          <button
            onClick={() => setModeAndReset("srs")}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${
              mode === "srs"
                ? "bg-averna-cyan/20 border-averna-cyan text-averna-cyan"
                : "border-white/10 text-gray-300 hover:border-averna-cyan/40"
            }`}
          >
            <RotateCcw className="h-4 w-4" /> Review
            {dueCount > 0 && mode !== "srs" && (
              <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-averna-cyan text-black">{dueCount}</span>
            )}
          </button>
          {mode === "quiz" && quizScore.total > 0 && (
            <div className="ml-auto flex items-center gap-2 text-sm text-averna-neon">
              <Trophy className="h-4 w-4" />
              {quizScore.correct} / {quizScore.total}
            </div>
          )}
        </div>

        {/* Deck selector */}
        {mode !== "srs" && (
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
        )}

        {/* Search + filter (study mode only) */}
        {mode === "study" && (
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
        )}

        {mode !== "srs" && (
        <div className="flex items-center justify-between mb-4 text-sm">
          <span className="text-gray-400">
            {visibleCards.length > 0 ? `Card ${index + 1} / ${visibleCards.length}` : "No cards"}
          </span>
          <span className="text-averna-neon font-semibold">
            {knownInDeck} / {deck.cards.length} in {deck.name}
          </span>
        </div>
        )}

        {mode === "srs" ? (
          <SrsReview cards={allCards} />
        ) : !card ? (
          <Card className="glass border-averna-purple/40">
            <CardContent className="text-center py-16 text-gray-400">
              No cards match your filter. Try clearing the search or turning off &quot;Unknown only&quot;.
            </CardContent>
          </Card>
        ) : mode === "study" ? (
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
        ) : (
          // Quiz mode
          <Card className="glass border-averna-neon/40">
            <CardContent className="py-8 px-6">
              <p className="text-xs uppercase tracking-widest text-averna-neon mb-2 text-center">
                Choose the correct meaning
              </p>
              <div className="flex items-center justify-center gap-3 mb-6">
                <p className="text-3xl font-bold text-white">{card.word}</p>
                <button
                  onClick={() => speak(card.word)}
                  className="text-averna-cyan hover:text-averna-neon transition-colors"
                  aria-label="Pronounce word"
                >
                  <Volume2 className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-2">
                {quizOptions.map((opt, i) => {
                  const isCorrect = opt === card.meaning;
                  const isChosen = quizAnswered === i;
                  let cls = "text-left px-4 py-3 rounded-lg border text-sm transition-colors ";
                  if (quizAnswered === null) {
                    cls += "border-white/10 bg-white/5 text-gray-200 hover:border-averna-neon/50 hover:bg-averna-neon/5";
                  } else if (isCorrect) {
                    cls += "border-averna-neon bg-averna-neon/10 text-averna-neon";
                  } else if (isChosen) {
                    cls += "border-red-500 bg-red-500/10 text-red-300";
                  } else {
                    cls += "border-white/5 bg-white/5 text-gray-500";
                  }
                  return (
                    <button
                      key={i}
                      onClick={() => answerQuiz(i)}
                      disabled={quizAnswered !== null}
                      className={cls}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span>{opt}</span>
                        {quizAnswered !== null && isCorrect && <Check className="h-4 w-4 shrink-0" />}
                        {quizAnswered !== null && isChosen && !isCorrect && <XIcon className="h-4 w-4 shrink-0" />}
                      </span>
                    </button>
                  );
                })}
              </div>

              {quizAnswered !== null && (
                <div className="mt-5 pt-4 border-t border-white/10 space-y-2 animate-in fade-in duration-200">
                  <p className="text-xs text-gray-400 italic">&ldquo;{card.example}&rdquo;</p>
                  <p className="text-sm">
                    <span className="text-xs uppercase tracking-wider text-averna-neon">Oʻzbekcha: </span>
                    <span className="text-white font-medium">{card.uz}</span>
                  </p>
                  <Button
                    onClick={next}
                    className="w-full mt-3 neon-button bg-averna-neon hover:bg-averna-neon/80 text-black"
                  >
                    Next question <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Controls (study mode) */}
        {card && mode === "study" && (
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

        {/* Quiz-mode secondary controls */}
        {card && mode === "quiz" && (
          <div className="flex justify-center gap-3 mt-6 flex-wrap">
            <Button onClick={shuffle} variant="ghost" size="sm" className="text-averna-cyan">
              <Shuffle className="mr-2 h-4 w-4" /> Shuffle deck
            </Button>
            <Button
              onClick={() => setQuizScore({ correct: 0, total: 0 })}
              variant="ghost"
              size="sm"
              className="text-gray-400"
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Reset score
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
