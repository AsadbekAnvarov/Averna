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
  Keyboard,
  X,
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
      { word: "Comprehensive", meaning: "Complete and including everything.", example: "The course gives a comprehensive overview." },
      { word: "Diverse", meaning: "Showing a great deal of variety.", example: "The city has a diverse population." },
      { word: "Significant", meaning: "Large enough to be noticed or important.", example: "There was a significant rise in prices." },
      { word: "Substantial", meaning: "Large in amount or importance.", example: "They made a substantial investment." },
      { word: "Subsequent", meaning: "Coming after something in time.", example: "Subsequent studies confirmed the result." },
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
      { word: "Bustling", meaning: "Full of busy, energetic activity.", example: "The market was bustling with shoppers." },
      { word: "Affordable", meaning: "Reasonably priced; not expensive.", example: "We looked for affordable flights." },
      { word: "Spontaneous", meaning: "Done without planning, on impulse.", example: "We took a spontaneous trip to the coast." },
      { word: "Breathtaking", meaning: "Astonishingly beautiful or impressive.", example: "The view from the peak was breathtaking." },
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
      { word: "Tertiary", meaning: "Relating to higher education.", example: "Tertiary education includes universities." },
      { word: "Compulsory", meaning: "Required by law or rules.", example: "Schooling is compulsory until sixteen." },
      { word: "Aptitude", meaning: "A natural ability to do something.", example: "She has an aptitude for languages." },
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
      { word: "Ecosystem", meaning: "A community of living things and their environment.", example: "Coral reefs are fragile ecosystems." },
      { word: "Contaminate", meaning: "To make impure or polluted.", example: "Waste can contaminate the water supply." },
      { word: "Depletion", meaning: "The using up of a resource.", example: "Oil depletion is a global concern." },
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
      { word: "Artificial", meaning: "Made by humans, not natural.", example: "Artificial intelligence is advancing fast." },
      { word: "Surveillance", meaning: "Close observation, especially of a suspect.", example: "Cameras provide constant surveillance." },
      { word: "Disruptive", meaning: "Causing radical change to an industry.", example: "Streaming was a disruptive technology." },
    ],
  },
  {
    id: "health",
    name: "Health & Medicine",
    emoji: "🩺",
    cards: [
      { word: "Nutrition", meaning: "The process of getting the right food for health.", example: "Good nutrition supports concentration." },
      { word: "Chronic", meaning: "Lasting for a long time (illness).", example: "Diabetes is a chronic condition." },
      { word: "Sedentary", meaning: "Involving a lot of sitting; inactive.", example: "A sedentary lifestyle harms your health." },
      { word: "Immunity", meaning: "The body's ability to resist disease.", example: "Vaccines build immunity." },
      { word: "Epidemic", meaning: "A widespread occurrence of a disease.", example: "The flu epidemic spread quickly." },
      { word: "Wellbeing", meaning: "The state of being comfortable and healthy.", example: "Exercise improves mental wellbeing." },
      { word: "Preventive", meaning: "Designed to stop something before it happens.", example: "Preventive care reduces hospital visits." },
      { word: "Fatigue", meaning: "Extreme tiredness.", example: "Lack of sleep causes fatigue." },
      { word: "Diagnosis", meaning: "Identifying an illness from its symptoms.", example: "Early diagnosis improves recovery." },
      { word: "Therapy", meaning: "Treatment to relieve or heal a condition.", example: "Speech therapy helped her recover." },
    ],
  },
  {
    id: "work",
    name: "Work & Business",
    emoji: "💼",
    cards: [
      { word: "Entrepreneur", meaning: "A person who starts a business.", example: "The young entrepreneur launched a startup." },
      { word: "Productivity", meaning: "The rate of producing useful output.", example: "Remote work can boost productivity." },
      { word: "Incentive", meaning: "Something that motivates you to act.", example: "Bonuses are a strong incentive." },
      { word: "Negotiate", meaning: "To discuss to reach an agreement.", example: "They negotiated a better contract." },
      { word: "Recruitment", meaning: "The process of hiring people.", example: "Recruitment takes several weeks." },
      { word: "Revenue", meaning: "The income a business earns.", example: "Annual revenue rose by 10%." },
      { word: "Versatile", meaning: "Able to adapt to many tasks.", example: "Employers value versatile workers." },
      { word: "Lucrative", meaning: "Producing a lot of money.", example: "Software can be a lucrative career." },
      { word: "Collaborate", meaning: "To work jointly with others.", example: "Teams collaborate on shared goals." },
      { word: "Tedious", meaning: "Boring and repetitive.", example: "Data entry can be tedious." },
    ],
  },
  {
    id: "society",
    name: "Society & Law",
    emoji: "⚖️",
    cards: [
      { word: "Inequality", meaning: "Unfair difference between groups.", example: "Income inequality is widening." },
      { word: "Welfare", meaning: "The health and happiness of people.", example: "The state supports child welfare." },
      { word: "Legislation", meaning: "Laws considered together.", example: "New legislation banned smoking indoors." },
      { word: "Deterrent", meaning: "Something that discourages an action.", example: "Fines act as a deterrent to speeding." },
      { word: "Rehabilitation", meaning: "Restoring someone to normal life.", example: "Prisons should focus on rehabilitation." },
      { word: "Discrimination", meaning: "Unfair treatment of a group.", example: "The law forbids discrimination at work." },
      { word: "Integrity", meaning: "Being honest and having strong morals.", example: "Leaders should act with integrity." },
      { word: "Poverty", meaning: "The state of being extremely poor.", example: "Education helps reduce poverty." },
      { word: "Civic", meaning: "Relating to a city or citizens' duties.", example: "Voting is a civic responsibility." },
      { word: "Prohibit", meaning: "To formally forbid by law.", example: "The rules prohibit cheating." },
    ],
  },
  {
    id: "advanced",
    name: "Band 7+ Advanced",
    emoji: "🚀",
    cards: [
      { word: "Ubiquitous", meaning: "Present or found everywhere.", example: "Smartphones are now ubiquitous." },
      { word: "Detrimental", meaning: "Causing harm or damage.", example: "Stress is detrimental to health." },
      { word: "Pivotal", meaning: "Of crucial importance.", example: "Teachers play a pivotal role." },
      { word: "Mitigate", meaning: "To make less severe.", example: "Trees help mitigate flooding." },
      { word: "Compelling", meaning: "Convincing and powerful.", example: "She made a compelling argument." },
      { word: "Inherent", meaning: "Existing as a natural part of something.", example: "Risk is inherent in any sport." },
      { word: "Paramount", meaning: "More important than anything else.", example: "Safety is of paramount importance." },
      { word: "Exacerbate", meaning: "To make a problem worse.", example: "Traffic exacerbates air pollution." },
      { word: "Scrutiny", meaning: "Critical, careful examination.", example: "The plan came under public scrutiny." },
      { word: "Cohesive", meaning: "Well connected and unified.", example: "A cohesive essay flows logically." },
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

// Hide the target word inside its example sentence for active recall.
function blankExample(card: Flashcard): string {
  const re = new RegExp(card.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
  const replaced = card.example.replace(re, "_____");
  return replaced === card.example ? card.example : replaced;
}

export default function FlashcardsPage() {
  // The featured deck rotates every day so students see fresh words daily.
  const dailyDeckIndex = tashkentDayOfYear() % DECKS.length;

  const [mode, setMode] = useState<"browse" | "recall" | "review">("browse");
  const [deckId, setDeckId] = useState(DECKS[dailyDeckIndex].id);
  const [cards, setCards] = useState<Flashcard[]>(DECKS[dailyDeckIndex].cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [srs, setSrs] = useState<SrsMap>({});
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [reviewPos, setReviewPos] = useState(0);
  const [recallInput, setRecallInput] = useState("");
  const [recallResult, setRecallResult] = useState<"correct" | "wrong" | null>(null);
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
    setRecallInput("");
    setRecallResult(null);
    setIndex((i) => (i + 1) % cards.length);
  };
  const prev = () => {
    setFlipped(false);
    setRecallInput("");
    setRecallResult(null);
    setIndex((i) => (i - 1 + cards.length) % cards.length);
  };

  const checkRecall = () => {
    if (recallResult) {
      next();
      return;
    }
    const correct = recallInput.trim().toLowerCase() === card.word.toLowerCase();
    setRecallResult(correct ? "correct" : "wrong");
    trackStudy();
    if (correct) {
      const s = new Set(known);
      s.add(card.word);
      setKnown(s);
      persistKnown(s);
    }
  };

  const deckMastery = (d: Deck) =>
    Math.round((d.cards.filter((c) => known.has(c.word)).length / d.cards.length) * 100);

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
            onClick={() => { setMode("recall"); setRecallInput(""); setRecallResult(null); }}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              mode === "recall"
                ? "bg-averna-pink/20 border-averna-pink text-averna-pink"
                : "bg-white/5 border-white/10 text-gray-300 hover:border-averna-pink/40"
            }`}
          >
            <Keyboard className="inline h-4 w-4 mr-1" /> Type it
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
        ) : mode === "recall" ? (
          /* ============ ACTIVE RECALL (type the word) ============ */
          <>
            <div className="flex items-center justify-between mb-4 text-sm">
              <span className="text-gray-400">Card {index + 1} / {cards.length}</span>
              <span className="text-averna-pink font-semibold">Active recall</span>
            </div>
            <Card className="glass-strong border-averna-pink/40">
              <CardContent className="py-8 px-6 space-y-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Definition</p>
                  <p className="text-lg text-white font-medium">{card.meaning}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Used in a sentence</p>
                  <p className="text-sm text-gray-300 italic">&ldquo;{blankExample(card)}&rdquo;</p>
                </div>
                <input
                  value={recallInput}
                  onChange={(e) => setRecallInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") checkRecall(); }}
                  disabled={recallResult !== null}
                  placeholder="Type the word…"
                  className={`w-full rounded-lg border bg-white/5 px-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 ${
                    recallResult === "correct"
                      ? "border-averna-neon focus:ring-averna-neon"
                      : recallResult === "wrong"
                      ? "border-rose-500 focus:ring-rose-500"
                      : "border-white/10 focus:ring-averna-pink"
                  }`}
                />
                {recallResult === "correct" && (
                  <p className="text-averna-neon text-sm flex items-center gap-1">
                    <Check className="h-4 w-4" /> Correct! Nicely recalled.
                  </p>
                )}
                {recallResult === "wrong" && (
                  <p className="text-rose-300 text-sm flex items-center gap-1">
                    <X className="h-4 w-4" /> The word was <span className="font-bold">{card.word}</span>
                  </p>
                )}
              </CardContent>
            </Card>
            <div className="flex items-center gap-2 mt-6">
              <Button onClick={prev} variant="outline" className="border-white/20">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button onClick={checkRecall} className="neon-button bg-averna-primary hover:bg-averna-light flex-1">
                {recallResult ? "Next word" : "Check"}
              </Button>
              <Button onClick={next} variant="outline" className="border-white/20">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          /* ============ BROWSE MODE ============ */
          <>
            {/* Deck selector with mastery */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
              {DECKS.map((d, i) => {
                const mastery = deckMastery(d);
                return (
                  <button
                    key={d.id}
                    onClick={() => selectDeck(d.id)}
                    className={`relative text-left p-2.5 rounded-xl border transition-colors ${
                      deckId === d.id
                        ? "bg-averna-purple/15 border-averna-purple"
                        : "bg-white/5 border-white/10 hover:border-averna-purple/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{d.emoji}</span>
                      <span className="text-xs font-medium text-white truncate flex-1">{d.name}</span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden mt-2">
                      <div className="h-full rounded-full bg-gradient-to-r from-averna-purple to-averna-neon" style={{ width: `${mastery}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] text-gray-500">{d.cards.length} words</span>
                      <span className="text-[9px] text-averna-neon font-semibold">{mastery}%</span>
                    </div>
                    {i === dailyDeckIndex && (
                      <span className="absolute top-1.5 right-1.5 text-[8px] font-bold uppercase text-averna-neon">Today</span>
                    )}
                  </button>
                );
              })}
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
