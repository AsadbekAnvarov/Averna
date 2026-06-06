"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, CheckCircle2, XCircle, RotateCcw, Trophy } from "lucide-react";
import { Confetti } from "@/components/confetti";
import { tashkentDayOfYear } from "@/lib/utils";

interface Question {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  category: string;
}

// A pool of IELTS-style questions. A daily set is selected deterministically.
const QUESTION_POOL: Question[] = [
  { category: "Vocabulary", question: "Choose the best synonym for \"meticulous\".", options: ["Careless", "Thorough", "Rapid", "Generous"], answer: 1, explanation: "\"Meticulous\" means showing great attention to detail, i.e. thorough." },
  { category: "Grammar", question: "Select the correct sentence.", options: ["She don't like coffee.", "She doesn't likes coffee.", "She doesn't like coffee.", "She not like coffee."], answer: 2, explanation: "With third-person singular, use \"doesn't\" + base verb: doesn't like." },
  { category: "Collocation", question: "Which word collocates with \"make\"?", options: ["a decision", "a photo", "homework", "a mistake quickly"], answer: 0, explanation: "We \"make a decision\". (We \"take a photo\" and \"do homework\".)" },
  { category: "Prepositions", question: "I'm really good ___ solving puzzles.", options: ["in", "at", "on", "for"], answer: 1, explanation: "We say \"good at\" + activity." },
  { category: "Vocabulary", question: "\"Ubiquitous\" most nearly means:", options: ["Rare", "Everywhere", "Expensive", "Ancient"], answer: 1, explanation: "\"Ubiquitous\" means present or found everywhere." },
  { category: "Grammar", question: "Choose the correct conditional: \"If I ___ more time, I would travel.\"", options: ["have", "had", "will have", "having"], answer: 1, explanation: "Second conditional uses past simple: \"If I had ... I would ...\"." },
  { category: "Word form", question: "Complete: \"Her argument was very ___.\" (persuade)", options: ["persuade", "persuasion", "persuasive", "persuaded"], answer: 2, explanation: "An adjective is needed to describe \"argument\": persuasive." },
  { category: "Idiom", question: "\"To hit the books\" means to:", options: ["Get angry", "Study hard", "Travel far", "Waste time"], answer: 1, explanation: "\"Hit the books\" is an idiom meaning to study hard." },
  { category: "Vocabulary", question: "Choose the closest meaning of \"reluctant\".", options: ["Eager", "Unwilling", "Confident", "Curious"], answer: 1, explanation: "\"Reluctant\" means unwilling or hesitant." },
  { category: "Grammar", question: "Pick the correct passive form: \"The report ___ yesterday.\"", options: ["was written", "is wrote", "has wrote", "writes"], answer: 0, explanation: "Past simple passive: was/were + past participle = \"was written\"." },
  { category: "Linking", question: "Which linker best shows contrast?", options: ["Moreover", "Therefore", "However", "Furthermore"], answer: 2, explanation: "\"However\" introduces a contrasting idea." },
  { category: "Vocabulary", question: "A synonym for \"significant\" is:", options: ["Trivial", "Considerable", "Tiny", "Optional"], answer: 1, explanation: "\"Significant\" means considerable or important." },
  { category: "Synonym", question: "Choose the closest meaning of \"detrimental\".", options: ["Helpful", "Harmful", "Neutral", "Cheap"], answer: 1, explanation: "\"Detrimental\" means causing harm or damage." },
  { category: "Grammar", question: "Pick the correct article: \"She is ___ honest person.\"", options: ["a", "an", "the", "—"], answer: 1, explanation: "\"Honest\" begins with a vowel sound (silent 'h'), so we use \"an\"." },
  { category: "Collocation", question: "Which verb fits: \"___ a goal\"?", options: ["do", "make", "achieve", "take"], answer: 2, explanation: "We \"achieve a goal\" (also \"reach\" or \"set\" a goal)." },
  { category: "Word form", question: "Complete: \"The results were ___.\" (impress)", options: ["impress", "impressive", "impression", "impressively"], answer: 1, explanation: "An adjective describes \"results\": impressive." },
  { category: "Prepositions", question: "She has been working here ___ 2019.", options: ["for", "since", "from", "during"], answer: 1, explanation: "Use \"since\" with a point in time; \"for\" with a duration." },
  { category: "Idiom", question: "\"Once in a blue moon\" means:", options: ["Very often", "Very rarely", "At night", "By accident"], answer: 1, explanation: "It describes something that happens very rarely." },
  { category: "Reading", question: "\"The scheme was scrapped due to lack of funding.\" \"Scrapped\" means:", options: ["Expanded", "Cancelled", "Delayed", "Approved"], answer: 1, explanation: "To \"scrap\" a plan is to cancel/abandon it." },
  { category: "Grammar", question: "Choose: \"By next year, I ___ here for a decade.\"", options: ["will work", "will have worked", "have worked", "worked"], answer: 1, explanation: "Future perfect (will have + past participle) for an action completed by a future point." },
  { category: "Vocabulary", question: "\"Mitigate\" most nearly means:", options: ["Worsen", "Reduce", "Ignore", "Repeat"], answer: 1, explanation: "To \"mitigate\" is to make something less severe." },
  { category: "Linking", question: "Which linker best adds a similar idea?", options: ["However", "Furthermore", "Nevertheless", "Whereas"], answer: 1, explanation: "\"Furthermore\" adds supporting information." },
  { category: "Collocation", question: "Which is correct?", options: ["heavy rain", "strong rain", "big rain", "high rain"], answer: 0, explanation: "We say \"heavy rain\" — a common collocation." },
  { category: "Synonym", question: "Choose the closest meaning of \"abundant\".", options: ["Scarce", "Plentiful", "Hidden", "Costly"], answer: 1, explanation: "\"Abundant\" means existing in large quantities; plentiful." },
];

// Deterministic daily selection of 5 questions (Tashkent day)
function getDailyQuestions(): Question[] {
  const dayOfYear = tashkentDayOfYear();
  const result: Question[] = [];
  for (let i = 0; i < 5; i++) {
    result.push(QUESTION_POOL[(dayOfYear + i * 5) % QUESTION_POOL.length]);
  }
  return result;
}

export default function DailyChallengePage() {
  const [questions] = useState<Question[]>(getDailyQuestions);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [points, setPoints] = useState(0);
  const [lastGain, setLastGain] = useState(0);
  const [finished, setFinished] = useState(false);
  const [rewardMsg, setRewardMsg] = useState("");

  const q = questions[current];
  const comboMult = 1 + Math.min(combo, 4) * 0.5;

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === q.answer) {
      const newCombo = combo + 1;
      const mult = 1 + Math.min(newCombo - 1, 4) * 0.5;
      const gain = Math.round(10 * mult);
      setCombo(newCombo);
      setMaxCombo((m) => Math.max(m, newCombo));
      setPoints((p) => p + gain);
      setLastGain(gain);
      setScore((s) => s + 1);
    } else {
      setCombo(0);
      setLastGain(0);
    }
  };

  const handleNext = () => {
    if (current + 1 < questions.length) {
      setCurrent((c) => c + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      setFinished(true);
      // Award points (once per day) in the background
      const finalScore = score + (selected === q.answer ? 0 : 0); // score already counted on select
      fetch("/api/challenge/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: finalScore }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.alreadyDone) setRewardMsg("✓ Already completed today — come back tomorrow!");
          else if (d.pointsEarned > 0) setRewardMsg(`🪙 +${d.pointsEarned} points added!`);
        })
        .catch(() => {});
    }
  };

  const restart = () => {
    setCurrent(0);
    setSelected(null);
    setAnswered(false);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setPoints(0);
    setLastGain(0);
    setFinished(false);
  };

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <Link
          href="/dashboard"
          className="text-averna-neon hover:underline text-sm mb-4 block"
        >
          ← Back to Dashboard
        </Link>

        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Zap className="h-8 w-8 text-averna-cyan" />
          Daily <span className="neon-text-cyan">Challenge</span>
        </h1>
        <p className="text-gray-400 mb-8">5 quick questions. New set every day. 🌟</p>

        {!finished && (
          <div className="flex items-center justify-between mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-averna-neon/15 border border-averna-neon/30 text-averna-neon text-sm font-semibold">
              ⭐ {points} pts
            </span>
            {combo >= 2 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/40 text-orange-300 text-sm font-bold animate-pulse">
                🔥 Combo ×{comboMult}
              </span>
            ) : (
              <span className="text-xs text-gray-500">Answer in a row to build a combo 🔥</span>
            )}
          </div>
        )}

        {!finished ? (
          <Card className="glass border-averna-cyan/30 animate-fade-in">
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-averna-purple">
                  {q.category}
                </span>
                <span className="text-sm text-gray-400">
                  {current + 1} / {questions.length}
                </span>
              </div>
              <CardTitle className="text-xl text-white mt-2">{q.question}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {q.options.map((opt, idx) => {
                const isCorrect = idx === q.answer;
                const isChosen = idx === selected;
                let cls =
                  "w-full text-left p-4 rounded-lg border transition-all duration-200 ";
                if (!answered) {
                  cls +=
                    "border-white/10 bg-white/5 hover:border-averna-cyan/50 hover:bg-averna-cyan/10 text-gray-200";
                } else if (isCorrect) {
                  cls += "border-averna-neon bg-averna-neon/10 text-averna-neon";
                } else if (isChosen) {
                  cls += "border-red-500 bg-red-500/10 text-red-300";
                } else {
                  cls += "border-white/10 bg-white/5 text-gray-400";
                }
                return (
                  <button key={idx} className={cls} onClick={() => handleSelect(idx)}>
                    <span className="flex items-center justify-between">
                      {opt}
                      {answered && isCorrect && <CheckCircle2 className="h-5 w-5" />}
                      {answered && isChosen && !isCorrect && <XCircle className="h-5 w-5" />}
                    </span>
                  </button>
                );
              })}

              {answered && (
                <div className="mt-4 p-4 rounded-lg bg-averna-primary/20 border border-averna-primary/30 animate-fade-in">
                  {selected === q.answer ? (
                    <p className="text-sm font-semibold text-averna-neon mb-1">
                      ✓ Correct! +{lastGain} pts{combo >= 2 ? ` (×${comboMult} combo 🔥)` : ""}
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-rose-300 mb-1">✗ Not quite — combo reset</p>
                  )}
                  <p className="text-sm text-gray-200">
                    <span className="font-semibold text-averna-neon">Explanation: </span>
                    {q.explanation}
                  </p>
                  <Button
                    onClick={handleNext}
                    className="w-full mt-4 neon-button bg-averna-primary hover:bg-averna-light"
                  >
                    {current + 1 < questions.length ? "Next Question" : "See Result"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="glass border-averna-neon/40 text-center animate-fade-in">
            <CardContent className="py-10 space-y-4">
              <Trophy className="h-16 w-16 text-yellow-400 mx-auto" />
              {score >= Math.ceil(questions.length / 2) && <Confetti />}
              <h2 className="text-3xl font-bold text-white">
                You scored {score} / {questions.length}
              </h2>
              <div className="flex items-center justify-center gap-3">
                <span className="px-3 py-1 rounded-full bg-averna-neon/15 border border-averna-neon/30 text-averna-neon text-sm font-bold">
                  ⭐ {points} challenge pts
                </span>
                {maxCombo >= 2 && (
                  <span className="px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/40 text-orange-300 text-sm font-bold">
                    🔥 Best combo ×{(1 + Math.min(maxCombo - 1, 4) * 0.5)}
                  </span>
                )}
              </div>
              <p className="text-gray-300">
                {score === questions.length
                  ? "Perfect! You're on fire 🔥"
                  : score >= questions.length / 2
                  ? "Great job! Keep practicing 💪"
                  : "Good effort — review and try again tomorrow!"}
              </p>
              {rewardMsg && (
                <p className="text-averna-neon font-semibold">{rewardMsg}</p>
              )}
              <div className="flex gap-3 justify-center pt-2">
                <Button
                  onClick={restart}
                  variant="outline"
                  className="border-averna-cyan text-averna-cyan"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Link href="/dashboard">
                  <Button className="neon-button bg-averna-primary hover:bg-averna-light">
                    Back to Dashboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
