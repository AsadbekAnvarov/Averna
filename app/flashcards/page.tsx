"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layers, RotateCcw, Shuffle, Check, ChevronLeft, ChevronRight, Volume2 } from "lucide-react";

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

export default function FlashcardsPage() {
  const [deckId, setDeckId] = useState(DECKS[0].id);
  const [cards, setCards] = useState<Flashcard[]>(DECKS[0].cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const trackedRef = useRef(false);

  // Tell the server the student studied flashcards today (powers the daily
  // Learning Path + awards points once per day). Fire-and-forget.
  const trackStudy = () => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    fetch("/api/activity/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "FLASHCARDS" }),
    }).catch(() => {
      // allow a retry on a later card if this one failed
      trackedRef.current = false;
    });
  };

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
  const card = cards[index];

  const selectDeck = (id: string) => {
    const d = DECKS.find((x) => x.id === id)!;
    setDeckId(id);
    setCards(d.cards);
    setIndex(0);
    setFlipped(false);
  };

  const next = () => { setFlipped(false); setIndex((i) => (i + 1) % cards.length); };
  const prev = () => { setFlipped(false); setIndex((i) => (i - 1 + cards.length) % cards.length); };

  const markKnown = () => {
    const s = new Set(known);
    s.add(card.word);
    setKnown(s);
    persist(s);
    trackStudy();
    next();
  };

  const shuffle = () => {
    setCards((c) => [...c].sort(() => Math.random() - 0.5));
    setIndex(0);
    setFlipped(false);
  };

  const resetProgress = () => { setKnown(new Set()); persist(new Set()); };

  const speak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    window.speechSynthesis.speak(u);
  };

  const knownInDeck = deck.cards.filter((c) => known.has(c.word)).length;

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
          Choose a topic, tap a card to flip, and mark words you know. Progress is saved. 🧠
        </p>

        {/* Deck selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          {DECKS.map((d) => (
            <button
              key={d.id}
              onClick={() => selectDeck(d.id)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                deckId === d.id
                  ? "bg-averna-purple/20 border-averna-purple text-averna-purple"
                  : "bg-white/5 border-white/10 text-gray-300 hover:border-averna-purple/40"
              }`}
            >
              {d.emoji} {d.name}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4 text-sm">
          <span className="text-gray-400">Card {index + 1} / {cards.length}</span>
          <span className="text-averna-neon font-semibold">{knownInDeck} / {deck.cards.length} mastered in this deck</span>
        </div>

        {/* Flip card */}
        <button onClick={() => setFlipped((f) => !f)} className="w-full text-left" style={{ perspective: "1000px" }}>
          <div className="relative w-full h-64 transition-transform duration-500"
            style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
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
          <Button onClick={prev} variant="outline" className="border-white/20"><ChevronLeft className="h-4 w-4" /></Button>
          <Button onClick={markKnown} className="neon-button bg-averna-primary hover:bg-averna-light flex-1">
            <Check className="mr-2 h-4 w-4" /> I know this
          </Button>
          <Button onClick={next} variant="outline" className="border-white/20"><ChevronRight className="h-4 w-4" /></Button>
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
      </div>
    </div>
  );
}
