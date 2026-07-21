"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
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
  const [finished, setFinished] = useState(false);
  const [rewardMsg, setRewardMsg] = useState("");

  const q = questions[current];

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === q.answer) setScore((s) => s + 1);
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
    setFinished(false);
  };

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <PageHeader
          back={{ href: "/dashboard", label: "Back to Dashboard" }}
          icon={Zap}
          iconClassName="text-averna-cyan"
          title={<>Daily <span className="neon-text-cyan">Challenge</span></>}
          subtitle="5 quick questions. New set every day. 🌟"
        />

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
