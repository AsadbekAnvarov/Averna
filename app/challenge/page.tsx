"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Zap, CheckCircle2, XCircle, RotateCcw, Trophy } from "lucide-react";
import { Confetti } from "@/components/confetti";
import { getDailyQuestions, type Question } from "@/lib/challenge-questions";
import { tashkentDateKey } from "@/lib/utils";

export default function DailyChallengePage() {
  const [questions] = useState<Question[]>(getDailyQuestions);
  // The day this set belongs to, so a set started before midnight is still
  // scored against the questions the student actually saw.
  const [setDay] = useState<string>(() => tashkentDateKey());
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [rewardMsg, setRewardMsg] = useState("");
  const [choices, setChoices] = useState<number[]>([]);

  const q = questions[current];

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    setChoices((c) => {
      const next = [...c];
      next[current] = idx;
      return next;
    });
    if (idx === q.answer) setScore((s) => s + 1);
  };

  const handleNext = () => {
    if (current + 1 < questions.length) {
      setCurrent((c) => c + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      setFinished(true);
      // Scored on the SERVER from the chosen options; rewarded once per day.
      fetch("/api/challenge/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: choices, dayKey: setDay }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.alreadyDone) setRewardMsg("Already completed today — a new set unlocks tomorrow.");
          else if (d.pointsEarned > 0) setRewardMsg(`+${d.pointsEarned} XP · Warm-up done for today`);
          else if (d.error) setRewardMsg("Your result couldn't be saved. Check your connection and reload.");
        })
        .catch(() => setRewardMsg("Your result couldn't be saved. Check your connection and reload."));
    }
  };

  const restart = () => {
    setCurrent(0);
    setSelected(null);
    setAnswered(false);
    setScore(0);
    setChoices([]);
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
                    {current + 1 < questions.length ? "Next Question" : "See My Result"}
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
                  Practise Again
                </Button>
                <Link href="/dashboard">
                  <Button className="neon-button bg-averna-primary hover:bg-averna-light">
                    Continue Today&apos;s Mission
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
