"use client";

import { useEffect, useMemo, useState } from "react";
import { Shuffle, Keyboard, ListChecks, X, RotateCcw, ArrowLeft, Coffee, Trophy } from "lucide-react";
import { fireConfetti } from "@/lib/confetti";

/** A small bank of IELTS-friendly words used across the break mini-games. */
const WORDS: { word: string; meaning: string }[] = [
  { word: "abundant", meaning: "existing in large quantities; plentiful" },
  { word: "concise", meaning: "giving information clearly in few words" },
  { word: "deteriorate", meaning: "to become progressively worse" },
  { word: "feasible", meaning: "possible to do easily or conveniently" },
  { word: "inevitable", meaning: "certain to happen; unavoidable" },
  { word: "meticulous", meaning: "showing great attention to detail" },
  { word: "prevalent", meaning: "widespread in a particular area" },
  { word: "redundant", meaning: "no longer needed or useful" },
  { word: "subtle", meaning: "so delicate it is hard to notice" },
  { word: "viable", meaning: "capable of working successfully" },
  { word: "ambiguous", meaning: "open to more than one interpretation" },
  { word: "diligent", meaning: "showing careful and persistent effort" },
  { word: "scarce", meaning: "insufficient for the demand; rare" },
  { word: "tedious", meaning: "too long, slow or dull; tiresome" },
  { word: "vivid", meaning: "producing powerful, clear images in the mind" },
];

const SENTENCES = [
  "Practice makes progress, not perfection.",
  "A wide vocabulary boosts your band score.",
  "Read every day to improve your fluency.",
  "Confidence grows with consistent effort.",
  "Small steps every day lead to big results.",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ----------------------------- Word Scramble ----------------------------- */
function WordScramble() {
  const deck = useMemo(() => shuffle(WORDS), []);
  const [i, setI] = useState(0);
  const [guess, setGuess] = useState("");
  const [score, setScore] = useState(0);
  const [reveal, setReveal] = useState(false);

  const current = deck[i % deck.length];
  const scrambled = useMemo(() => {
    let s = shuffle(current.word.split("")).join("");
    if (s === current.word) s = shuffle(current.word.split("")).join("");
    return s;
  }, [current]);

  const next = (correct: boolean) => {
    if (correct) setScore((s) => s + 1);
    setGuess("");
    setReveal(false);
    setI((x) => x + 1);
  };

  const submit = () => {
    if (guess.trim().toLowerCase() === current.word) next(true);
    else setReveal(true);
  };

  return (
    <div className="text-center">
      <p className="text-xs text-gray-400 mb-2">Unscramble the word</p>
      <p className="text-3xl font-bold tracking-[0.3em] text-averna-cyan uppercase mb-1">{scrambled}</p>
      <p className="text-xs text-gray-500 mb-4 italic">Hint: {current.meaning}</p>
      <input
        autoFocus
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Type your answer…"
        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-center text-white focus:outline-none focus:ring-2 focus:ring-averna-cyan"
      />
      {reveal && (
        <p className="text-sm text-amber-400 mt-2">
          It was <span className="font-bold uppercase">{current.word}</span>
        </p>
      )}
      <div className="flex gap-2 justify-center mt-4">
        <button onClick={submit} className="px-4 py-2 rounded-lg bg-averna-primary/80 hover:bg-averna-primary text-white text-sm font-medium">Check</button>
        <button onClick={() => next(false)} className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-300 text-sm">Skip</button>
      </div>
      <p className="text-sm text-averna-neon mt-3 flex items-center justify-center gap-1"><Trophy className="h-4 w-4" /> Score: {score}</p>
    </div>
  );
}

/* ------------------------------ Typing Race ------------------------------ */
function TypingRace() {
  const [sentence, setSentence] = useState(() => SENTENCES[Math.floor(Math.random() * SENTENCES.length)]);
  const [text, setText] = useState("");
  const [start, setStart] = useState<number | null>(null);
  const [done, setDone] = useState<{ wpm: number; acc: number } | null>(null);

  const onChange = (v: string) => {
    if (start === null && v.length > 0) setStart(Date.now());
    setText(v);
    if (v.length >= sentence.length) {
      const elapsedMin = ((Date.now() - (start ?? Date.now())) || 1) / 60000;
      const words = sentence.trim().split(/\s+/).length;
      const wpm = Math.max(1, Math.round(words / Math.max(elapsedMin, 0.01)));
      let correct = 0;
      for (let k = 0; k < sentence.length; k++) if (v[k] === sentence[k]) correct++;
      const acc = Math.round((correct / sentence.length) * 100);
      setDone({ wpm, acc });
    }
  };

  const reset = () => {
    setSentence(SENTENCES[Math.floor(Math.random() * SENTENCES.length)]);
    setText("");
    setStart(null);
    setDone(null);
  };

  return (
    <div>
      <p className="text-xs text-gray-400 mb-2 text-center">Type the sentence as fast & accurately as you can</p>
      <div className="p-3 rounded-lg bg-white/5 border border-white/10 mb-3 text-sm leading-relaxed">
        {sentence.split("").map((ch, idx) => {
          const typed = text[idx];
          const cls = typed == null ? "text-gray-400" : typed === ch ? "text-averna-neon" : "text-red-400 underline";
          return <span key={idx} className={cls}>{ch}</span>;
        })}
      </div>
      <textarea
        autoFocus
        value={text}
        disabled={!!done}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-averna-cyan"
      />
      {done && (
        <div className="text-center mt-3">
          <p className="text-averna-neon font-bold text-lg">{done.wpm} WPM · {done.acc}% accuracy</p>
          <button onClick={reset} className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-averna-primary/80 hover:bg-averna-primary text-white text-sm">
            <RotateCcw className="h-4 w-4" /> Try another
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Word Quiz ------------------------------- */
function WordQuiz() {
  const quiz = useMemo(() => {
    const picked = shuffle(WORDS).slice(0, 5);
    return picked.map((q) => {
      const wrong = shuffle(WORDS.filter((w) => w.word !== q.word)).slice(0, 3);
      return { word: q.word, options: shuffle([q, ...wrong]).map((o) => o.meaning), answer: q.meaning };
    });
  }, []);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  const finished = i >= quiz.length;
  useEffect(() => {
    if (finished && score >= 4) fireConfetti();
  }, [finished, score]);

  if (i >= quiz.length) {
    return (
      <div className="text-center py-4">
        <p className="text-4xl mb-2">{score >= 4 ? "🌟" : score >= 2 ? "👍" : "💪"}</p>
        <p className="text-xl font-bold text-white">{score} / {quiz.length}</p>
        <p className="text-sm text-gray-400 mt-1">Nice brain workout!</p>
      </div>
    );
  }

  const q = quiz[i];
  const choose = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    if (opt === q.answer) setScore((s) => s + 1);
    setTimeout(() => { setPicked(null); setI((x) => x + 1); }, 900);
  };

  return (
    <div>
      <p className="text-xs text-gray-400 mb-1 text-center">Question {i + 1} of {quiz.length}</p>
      <p className="text-center mb-4">What does <span className="text-2xl font-bold text-averna-cyan uppercase">{q.word}</span> mean?</p>
      <div className="space-y-2">
        {q.options.map((opt) => {
          const isAnswer = opt === q.answer;
          const state = picked ? (isAnswer ? "bg-averna-neon/20 border-averna-neon/50 text-averna-neon" : opt === picked ? "bg-red-400/15 border-red-400/40 text-red-300" : "border-white/10 text-gray-400") : "border-white/10 text-gray-200 hover:border-averna-cyan/40";
          return (
            <button key={opt} onClick={() => choose(opt)} className={`w-full text-left text-sm px-3 py-2.5 rounded-lg border transition-colors ${state}`}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ Break Modal ------------------------------ */
const GAMES = [
  { key: "scramble", label: "Word Scramble", desc: "Unscramble the letters", icon: Shuffle, color: "bg-averna-cyan/15 text-averna-cyan" },
  { key: "typing", label: "Typing Race", desc: "Type fast & accurately", icon: Keyboard, color: "bg-averna-purple/15 text-averna-purple" },
  { key: "quiz", label: "Word Quiz", desc: "Guess the meaning", icon: ListChecks, color: "bg-averna-pink/15 text-averna-pink" },
] as const;

type GameKey = (typeof GAMES)[number]["key"];

export function BrainBreak({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [game, setGame] = useState<GameKey | null>(null);

  useEffect(() => {
    if (!open) setGame(null);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="w-full max-w-md glass-strong border border-averna-neon/30 rounded-2xl p-5 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white flex items-center gap-2">
            {game ? (
              <button onClick={() => setGame(null)} className="text-gray-400 hover:text-white"><ArrowLeft className="h-5 w-5" /></button>
            ) : (
              <Coffee className="h-5 w-5 text-averna-neon" />
            )}
            {game ? GAMES.find((g) => g.key === game)?.label : "Brain Break — take 5! ☕"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white" title="Back to study"><X className="h-5 w-5" /></button>
        </div>

        {!game ? (
          <>
            <p className="text-sm text-gray-400 mb-4">Great focus session! Recharge with a quick word game.</p>
            <div className="space-y-2">
              {GAMES.map((g) => {
                const Icon = g.icon;
                return (
                  <button
                    key={g.key}
                    onClick={() => setGame(g.key)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-averna-dark/40 border border-white/5 hover:border-averna-neon/40 hover:-translate-y-0.5 transition-all text-left"
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${g.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{g.label}</p>
                      <p className="text-xs text-gray-400">{g.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={onClose} className="w-full mt-4 py-2.5 rounded-lg border border-white/10 text-gray-300 hover:text-white text-sm transition-colors">
              Skip — back to studying
            </button>
          </>
        ) : (
          <div className="min-h-[220px]">
            {game === "scramble" && <WordScramble />}
            {game === "typing" && <TypingRace />}
            {game === "quiz" && <WordQuiz />}
          </div>
        )}
      </div>
    </div>
  );
}
