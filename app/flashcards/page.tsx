"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Layers,
  RotateCcw,
  Shuffle,
  Check,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Repeat,
  Sparkles,
} from "lucide-react";
import { tashkentDayOfYear } from "@/lib/utils";

interface Flashcard {
  word: string;
  meaning: string;
  example: string;
}

interface Deck {
  id: string;
  name: string;
  emoji: string;
  cards: Flashcard[];
}

const DECKS: Deck[] = [
  {
    id: "general",
    name: "General Academic",
    emoji: "🎓",
    cards: [
      { word: "Abundant", meaning: "Existing in large quantities; plentiful.", example: "The region has abundant natural resources." },
      { word: "Concise", meaning: "Giving a lot of information clearly in few words.", example: "Keep your introduction concise and clear." },
      { word: "Enhance", meaning: "To improve the quality or value of something.", example: "Reading enhances your vocabulary." },
      { word: "Feasible", meaning: "Possible to do easily or conveniently.", example: "Is it feasible to finish by Friday?" },
      { word: "Inevitable", meaning: "Certain to happen; unavoidable.", example: "Change is inevitable in any growing company." },
      { word: "Prominent", meaning: "Important or well known.", example: "He is a prominent figure in education." },
      { word: "Reluctant", meaning: "Unwilling and hesitant.", example: "Students are sometimes reluctant to speak." },
      { word: "Vital", meaning: "Absolutely necessary; essential.", example: "Daily practice is vital for fluency." },
    ],
  },
  {
    id: "travel",
    name: "Travel & Tourism",
    emoji: "✈️",
    cards: [
      { word: "Itinerary", meaning: "A planned route or journey.", example: "Our itinerary included three cities in five days." },
      { word: "Destination", meaning: "The place to which someone is going.", example: "Bali is a popular holiday destination." },
      { word: "Excursion", meaning: "A short trip, usually for leisure.", example: "We booked a day excursion to the mountains." },
      { word: "Accommodation", meaning: "A place to stay or live.", example: "The hotel offers comfortable accommodation." },
      { word: "Souvenir", meaning: "An object kept as a reminder of a place.", example: "She bought a souvenir from every country." },
      { word: "Voyage", meaning: "A long journey, especially by sea.", example: "The voyage across the Atlantic took six days." },
      { word: "Picturesque", meaning: "Visually attractive, like a picture.", example: "The village was small and picturesque." },
      { word: "Remote", meaning: "Far away from other places.", example: "They travelled to a remote island." },
    ],
  },
  {
    id: "education",
    name: "Education",
    emoji: "📚",
    cards: [
      { word: "Curriculum", meaning: "The subjects taught in a course.", example: "The curriculum covers maths and science." },
      { word: "Tuition", meaning: "Teaching, or the fee paid for it.", example: "Tuition fees have risen in recent years." },
      { word: "Scholarship", meaning: "Financial support awarded to a student.", example: "She won a scholarship to study abroad." },
      { word: "Assessment", meaning: "The evaluation of a student's work.", example: "Continuous assessment reduces exam stress." },
      { word: "Discipline", meaning: "A branch of knowledge; also self-control.", example: "Engineering is a demanding discipline." },
      { word: "Literacy", meaning: "The ability to read and write.", example: "The campaign improved adult literacy." },
      { word: "Mentor", meaning: "An experienced, trusted adviser.", example: "Her mentor helped her plan her career." },
      { word: "Vocational", meaning: "Relating to a particular occupation.", example: "He chose a vocational training course." },
    ],
  },
  {
    id: "environment",
    name: "Environment",
    emoji: "🌍",
    cards: [
      { word: "Sustainable", meaning: "Able to continue without harming the environment.", example: "We need sustainable energy sources." },
      { word: "Emissions", meaning: "Gases released into the air.", example: "Cars produce harmful emissions." },
      { word: "Conservation", meaning: "Protection of nature and resources.", example: "Wildlife conservation is essential." },
      { word: "Renewable", meaning: "Naturally replenished, like solar power.", example: "Renewable energy is becoming cheaper." },
      { word: "Pollution", meaning: "Harmful substances in the environment.", example: "Air pollution affects city dwellers." },
      { word: "Deforestation", meaning: "The clearing of forests.", example: "Deforestation threatens many species." },
      { word: "Habitat", meaning: "The natural home of an animal or plant.", example: "Pandas are losing their habitat." },
      { word: "Biodiversity", meaning: "The variety of life in an area.", example: "Rainforests have rich biodiversity." },
    ],
  },
  {
    id: "technology",
    name: "Technology",
    emoji: "💻",
    cards: [
      { word: "Innovation", meaning: "A new method, idea, or product.", example: "The company is known for innovation." },
      { word: "Automation", meaning: "Using machines to do work automatically.", example: "Automation has changed manufacturing." },
      { word: "Digital", meaning: "Relating to computer technology.", example: "We live in a digital age." },
      { word: "Device", meaning: "A piece of equipment for a purpose.", example: "Mobile devices are everywhere." },
      { word: "Efficient", meaning: "Working well without wasting resources.", example: "The new system is far more efficient." },
      { word: "Network", meaning: "A group of connected computers or people.", example: "The social network has millions of users." },
      { word: "Cutting-edge", meaning: "The most advanced; latest.", example: "They use cutting-edge technology." },
      { word: "Obsolete", meaning: "No longer used; out of date.", example: "Fax machines are now obsolete." },
    ],
  },
];

const ALL_CARDS: Flashcard[] = DECKS.flatMap((d) => d.cards);
const DAY = 86400000;
const MAX_NEW_PER_SESSION = 10;

interface SrsEntry {
  due: number;
  interval: number; // days
}
type SrsMap = Record<string, SrsEntry>;
type Grade = "again" | "good" | "easy";

function schedule(prev: SrsEntry | undefined, grade: Grade): SrsEntry {
  let interval = prev?.interval ?? 0;
  if (grade === "again") {
    return { interval: 0, due: Date.now() + 10 * 60 * 1000 }; // ~10 min
  }
  if (grade === "good") {
    interval = interval === 0 ? 1 : Math.min(Math.round(interval * 2), 60);
  } else {
    interval = interval === 0 ? 3 : Math.min(Math.round(interval * 2.5), 120);
  }
  return { interval, due: Date.now() + interval * DAY };
}

export default function FlashcardsPage() {
  // The featured deck rotates every day so students see fresh words daily.
  const dailyDeckIndex = tashkentDayOfYear() % DECKS.length;

  const [mode, setMode] = useState<"browse" | "review">("browse");
  const [deckId, setDeckId] = useState(DECKS[dailyDeckIndex].id);
  const [cards, setCards] = useState<Flashcard[]>(DECKS[dailyDeckIndex].cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [srs, setSrs] = useState<SrsMap>({});
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [reviewPos, setReviewPos] = useState(0);
  const trackedRef = useRef(false);

  const trackStudy = () => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    fetch("/api/activity/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "FLASHCARDS" }),
    }).catch(() => {
      trackedRef.current = false;
    });
  };

  useEffect(() => {
    try {
      const savedKnown = localStorage.getItem("averna_known_cards");
      if (savedKnown) setKnown(new Set(JSON.parse(savedKnown)));
      const savedSrs = localStorage.getItem("averna_srs");
      if (savedSrs) setSrs(JSON.parse(savedSrs));
    } catch {}
  }, []);

  const persistKnown = (s: Set<string>) => {
    try {
      localStorage.setItem("averna_known_cards", JSON.stringify(Array.from(s)));
    } catch {}
  };
  const persistSrs = (s: SrsMap) => {
    try {
      localStorage.setItem("averna_srs", JSON.stringify(s));
    } catch {}
  };

  const deck = DECKS.find((d) => d.id === deckId)!;
  const card = cards[index];

  // How many cards are due (or new) right now
  const now = Date.now();
  const dueCount =
    ALL_CARDS.filter((c) => srs[c.word] && srs[c.word].due <= now).length +
    Math.min(MAX_NEW_PER_SESSION, ALL_CARDS.filter((c) => !srs[c.word]).length);

  const selectDeck = (id: string) => {
    const d = DECKS.find((x) => x.id === id)!;
    setDeckId(id);
    setCards(d.cards);
    setIndex(0);
    setFlipped(false);
  };

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
    persistKnown(s);
    trackStudy();
    next();
  };

  const shuffle = () => {
    setCards((c) => [...c].sort(() => Math.random() - 0.5));
    setIndex(0);
    setFlipped(false);
  };

  const resetProgress = () => {
    setKnown(new Set());
    persistKnown(new Set());
  };

  const speak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    window.speechSynthesis.speak(u);
  };

  // ---- Spaced-repetition review mode ----
  const startReview = () => {
    const due = ALL_CARDS.filter((c) => srs[c.word] && srs[c.word].due <= now);
    const fresh = ALL_CARDS.filter((c) => !srs[c.word]).slice(0, MAX_NEW_PER_SESSION);
    const q = [...due, ...fresh].sort(() => Math.random() - 0.5);
    setQueue(q);
    setReviewPos(0);
    setFlipped(false);
    setMode("review");
  };

  const gradeCard = (grade: Grade) => {
    const c = queue[reviewPos];
    if (!c) return;
    const updated = { ...srs, [c.word]: schedule(srs[c.word], grade) };
    setSrs(updated);
    persistSrs(updated);
    trackStudy();
    setFlipped(false);
    setReviewPos((p) => p + 1);
  };

  const knownInDeck = deck.cards.filter((c) => known.has(c.word)).length;
  const reviewCard = queue[reviewPos];
  const reviewDone = mode === "review" && reviewPos >= queue.length;

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
        <p className="text-gray-400 mb-5">
          Browse topics or run a smart <span className="text-averna-cyan">Daily Review</span> that
          shows each word right before you&apos;d forget it. 🧠
        </p>

        {/* Mode toggle */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setMode("browse")}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              mode === "browse"
                ? "bg-averna-purple/20 border-averna-purple text-averna-purple"
                : "bg-white/5 border-white/10 text-gray-300 hover:border-averna-purple/40"
            }`}
          >
            <Layers className="inline h-4 w-4 mr-1" /> Browse Decks
          </button>
          <button
            onClick={startReview}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              mode === "review"
                ? "bg-averna-cyan/20 border-averna-cyan text-averna-cyan"
                : "bg-white/5 border-white/10 text-gray-300 hover:border-averna-cyan/40"
            }`}
          >
            <Repeat className="inline h-4 w-4 mr-1" /> Daily Review
            {dueCount > 0 && (
              <span className="ml-1.5 text-[10px] font-bold bg-averna-cyan/30 text-averna-cyan px-1.5 py-0.5 rounded-full">
                {dueCount}
              </span>
            )}
          </button>
        </div>

        {mode === "review" ? (
          /* ============ SPACED-REPETITION REVIEW ============ */
          reviewDone ? (
            <Card className="glass border-averna-neon/40">
              <CardContent className="py-12 text-center space-y-3">
                <Sparkles className="h-10 w-10 text-averna-neon mx-auto" />
                <p className="text-xl font-bold text-averna-neon">Review complete! 🎉</p>
                <p className="text-gray-400 text-sm">
                  You reviewed {queue.length} card{queue.length !== 1 ? "s" : ""}. Come back tomorrow —
                  cards will reappear right when you need them.
                </p>
                <Button onClick={() => setMode("browse")} className="neon-button bg-averna-primary hover:bg-averna-light mt-2">
                  Back to decks
                </Button>
              </CardContent>
            </Card>
          ) : reviewCard ? (
            <>
              <div className="flex items-center justify-between mb-4 text-sm">
                <span className="text-gray-400">
                  Card {reviewPos + 1} / {queue.length}
                </span>
                <span className="text-averna-cyan font-semibold">Spaced repetition</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden mb-4">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-averna-cyan to-averna-neon transition-all"
                  style={{ width: `${(reviewPos / queue.length) * 100}%` }}
                />
              </div>

              <button onClick={() => setFlipped((f) => !f)} className="w-full text-left">
                <Card className="glass-strong border-averna-cyan/40 min-h-[16rem] flex items-center justify-center">
                  <CardContent className="text-center py-10 px-6">
                    {!flipped ? (
                      <>
                        <p className="text-4xl font-bold text-white">{reviewCard.word}</p>
                        <p className="text-xs text-gray-500 mt-4">tap to reveal meaning</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg text-averna-cyan font-semibold mb-2">{reviewCard.meaning}</p>
                        <p className="text-sm text-gray-300 italic">&ldquo;{reviewCard.example}&rdquo;</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </button>

              {!flipped ? (
                <Button
                  onClick={() => setFlipped(true)}
                  className="w-full mt-6 neon-button bg-averna-primary hover:bg-averna-light"
                >
                  Show answer
                </Button>
              ) : (
                <div className="grid grid-cols-3 gap-2 mt-6">
                  <Button onClick={() => gradeCard("again")} variant="outline" className="border-rose-500/50 text-rose-300">
                    Again
                    <span className="block text-[10px] opacity-70">10 min</span>
                  </Button>
                  <Button onClick={() => gradeCard("good")} variant="outline" className="border-averna-cyan/50 text-averna-cyan">
                    Good
                    <span className="block text-[10px] opacity-70">days</span>
                  </Button>
                  <Button onClick={() => gradeCard("easy")} className="neon-button bg-averna-primary hover:bg-averna-light">
                    Easy
                    <span className="block text-[10px] opacity-80">longer</span>
                  </Button>
                </div>
              )}

              <div className="flex justify-center mt-4">
                <Button onClick={() => speak(`${reviewCard.word}. ${reviewCard.example}`)} variant="ghost" size="sm" className="text-averna-pink">
                  <Volume2 className="mr-2 h-4 w-4" /> Pronounce
                </Button>
              </div>
            </>
          ) : (
            <Card className="glass border-averna-neon/40">
              <CardContent className="py-12 text-center space-y-3">
                <Sparkles className="h-10 w-10 text-averna-neon mx-auto" />
                <p className="text-xl font-bold text-averna-neon">All caught up! 🎉</p>
                <p className="text-gray-400 text-sm">
                  No cards are due right now. Browse a deck to learn new words, or check back later.
                </p>
                <Button onClick={() => setMode("browse")} className="neon-button bg-averna-primary hover:bg-averna-light mt-2">
                  Browse decks
                </Button>
              </CardContent>
            </Card>
          )
        ) : (
          /* ============ BROWSE MODE ============ */
          <>
            {/* Deck selector */}
            <div className="flex flex-wrap gap-2 mb-6">
              {DECKS.map((d, i) => (
                <button
                  key={d.id}
                  onClick={() => selectDeck(d.id)}
                  className={`relative px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    deckId === d.id
                      ? "bg-averna-purple/20 border-averna-purple text-averna-purple"
                      : "bg-white/5 border-white/10 text-gray-300 hover:border-averna-purple/40"
                  }`}
                >
                  {d.emoji} {d.name}
                  {i === dailyDeckIndex && (
                    <span className="ml-1.5 text-[9px] font-bold uppercase text-averna-neon">• Today</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between mb-4 text-sm">
              <span className="text-gray-400">
                Card {index + 1} / {cards.length}
              </span>
              <span className="text-averna-neon font-semibold">
                {knownInDeck} / {deck.cards.length} mastered in this deck
              </span>
            </div>

            {/* Flip card */}
            <button onClick={() => setFlipped((f) => !f)} className="w-full text-left" style={{ perspective: "1000px" }}>
              <div
                className="relative w-full h-64 transition-transform duration-500"
                style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
              >
                <Card className="glass border-averna-purple/40 absolute inset-0 flex items-center justify-center" style={{ backfaceVisibility: "hidden" }}>
                  <CardContent className="text-center py-10">
                    <p className="text-4xl font-bold text-white">{card.word}</p>
                    {known.has(card.word) && <span className="mt-3 inline-block text-xs text-averna-neon">✓ mastered</span>}
                    <p className="text-xs text-gray-500 mt-4">tap to see meaning</p>
                  </CardContent>
                </Card>
                <Card className="glass-strong border-averna-cyan/40 absolute inset-0 flex items-center justify-center" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
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
