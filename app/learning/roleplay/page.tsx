"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Square, Volume2, RotateCcw, Trophy, MessagesSquare, Loader2, ArrowLeft } from "lucide-react";
import { scoreSpeaking, type SpeakingScore } from "@/lib/utils";
import { Confetti } from "@/components/confetti";

interface Scenario {
  id: string;
  title: string;
  emoji: string;
  persona: string;
  intro: string;
  prompts: string[];
}

const SCENARIOS: Scenario[] = [
  {
    id: "interview",
    title: "Job Interview",
    emoji: "💼",
    persona: "Interviewer",
    intro: "Welcome! Thanks for coming in today. Let's begin.",
    prompts: [
      "Tell me a little about yourself.",
      "Why do you want to work for our company?",
      "What is your greatest strength, and can you give an example?",
      "Where do you see yourself in five years?",
      "Do you have any questions for me?",
    ],
  },
  {
    id: "airport",
    title: "At the Airport",
    emoji: "✈️",
    persona: "Check-in Agent",
    intro: "Good morning! Welcome to the check-in desk.",
    prompts: [
      "May I see your passport and ticket, please?",
      "Are you checking in any luggage today?",
      "Would you prefer a window or an aisle seat?",
      "Did you pack your bags yourself?",
      "Your gate is B12. Do you know how to get there, or shall I explain?",
    ],
  },
  {
    id: "restaurant",
    title: "At a Restaurant",
    emoji: "🍽️",
    persona: "Waiter",
    intro: "Good evening, welcome! Here is your table.",
    prompts: [
      "Can I get you something to drink to start?",
      "Are you ready to order, or do you need a few minutes?",
      "How would you like your meal cooked?",
      "Would you like to see the dessert menu?",
      "How was everything this evening?",
    ],
  },
  {
    id: "doctor",
    title: "At the Doctor",
    emoji: "🩺",
    persona: "Doctor",
    intro: "Hello, please have a seat. What brings you in today?",
    prompts: [
      "Can you describe your symptoms?",
      "How long have you been feeling like this?",
      "Are you taking any medication at the moment?",
      "On a scale of one to ten, how bad is the pain?",
      "I'll write you a prescription. Do you have any questions?",
    ],
  },
  {
    id: "friends",
    title: "Making Friends",
    emoji: "🙋",
    persona: "New Classmate",
    intro: "Hi! I don't think we've met — I just joined this class.",
    prompts: [
      "So, what do you like to do in your free time?",
      "Have you lived in this city for long?",
      "What kind of music or films are you into?",
      "Do you want to study together sometime?",
      "Let's keep in touch — how do you usually stay in contact with people?",
    ],
  },
];

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-GB";
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

export default function RoleplayPage() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [turn, setTurn] = useState(0);
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<SpeakingScore | null>(null);

  const recRef = useRef<any>(null);
  const trackedRef = useRef(false);

  const trackSpeaking = () => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    fetch("/api/activity/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "SPEAKING" }),
    }).catch(() => {
      trackedRef.current = false;
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e: any) => {
      let full = "";
      for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript + " ";
      setTranscript(full.trim());
    };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {}
    };
  }, []);

  const startScenario = (s: Scenario) => {
    setScenario(s);
    setTurn(0);
    setAnswers([]);
    setResult(null);
    setTranscript("");
    setTimeout(() => speak(`${s.intro} ${s.prompts[0]}`), 250);
  };

  const startListening = () => {
    setTranscript("");
    try {
      recRef.current?.start();
    } catch {}
    setListening(true);
  };

  const stopListening = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {}
    setListening(false);
  }, []);

  const nextTurn = () => {
    if (!scenario) return;
    const recorded = [...answers, transcript.trim()];
    setAnswers(recorded);
    setTranscript("");

    if (turn + 1 < scenario.prompts.length) {
      const nextIdx = turn + 1;
      setTurn(nextIdx);
      setTimeout(() => speak(scenario.prompts[nextIdx]), 200);
    } else {
      // Finished — score the combined conversation
      const combined = recorded.join(" ").trim();
      setResult(scoreSpeaking(combined || "", Math.max(30, recorded.length * 20)));
      trackSpeaking();
    }
  };

  const restart = () => {
    setScenario(null);
    setTurn(0);
    setAnswers([]);
    setResult(null);
    setTranscript("");
  };

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-2xl pb-24 lg:pb-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <MessagesSquare className="h-8 w-8 text-averna-pink" />
          Speaking <span className="neon-text-purple">Roleplay</span>
        </h1>
        <p className="text-gray-400 mb-6">
          Practice real-life conversations. The AI plays a role and asks questions — you answer out loud. 🎭
        </p>

        {!supported && (
          <Card className="glass border-yellow-500/40 mb-6">
            <CardContent className="py-4 text-yellow-300 text-sm">
              Speech recognition isn&apos;t supported here. Open in <strong>Google Chrome</strong> for the full experience.
            </CardContent>
          </Card>
        )}

        {/* Scenario picker */}
        {!scenario && (
          <div className="grid sm:grid-cols-2 gap-3">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => startScenario(s)}
                className="text-left p-4 rounded-xl glass border border-white/10 hover:border-averna-pink/50 hover:scale-[1.02] transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{s.emoji}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{s.title}</p>
                    <p className="text-xs text-gray-400">You talk with the {s.persona.toLowerCase()}</p>
                  </div>
                </div>
                <p className="text-xs text-averna-pink mt-3">{s.prompts.length} questions →</p>
              </button>
            ))}
          </div>
        )}

        {/* Conversation */}
        {scenario && !result && (
          <Card className="glass border-averna-pink/30">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <span className="text-2xl">{scenario.emoji}</span>
                  {scenario.title}
                </span>
                <span className="text-sm font-normal text-gray-400">
                  {turn + 1} / {scenario.prompts.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* progress */}
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-averna-pink to-averna-purple transition-all"
                  style={{ width: `${(turn / scenario.prompts.length) * 100}%` }}
                />
              </div>

              {/* AI bubble */}
              <div className="flex items-start gap-2">
                <span className="h-8 w-8 shrink-0 rounded-full bg-averna-pink/20 border border-averna-pink/40 flex items-center justify-center text-sm">
                  {scenario.emoji}
                </span>
                <div className="bg-white/10 text-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                  <p className="text-[11px] text-averna-pink font-semibold mb-0.5">{scenario.persona}</p>
                  <p className="text-sm">{scenario.prompts[turn]}</p>
                </div>
              </div>

              {/* Your answer bubble */}
              {(listening || transcript) && (
                <div className="flex items-start gap-2 justify-end">
                  <div className="bg-averna-primary text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%]">
                    <p className="text-[11px] text-white/80 font-semibold mb-0.5 flex items-center gap-1">
                      You {listening && <Loader2 className="h-3 w-3 animate-spin" />}
                    </p>
                    <p className="text-sm">{transcript || "Listening…"}</p>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={() => speak(scenario.prompts[turn])} variant="outline" className="border-averna-cyan text-averna-cyan">
                  <Volume2 className="mr-2 h-4 w-4" /> Hear again
                </Button>
                {!listening ? (
                  <Button onClick={startListening} disabled={!supported} className="neon-button bg-averna-primary hover:bg-averna-light disabled:opacity-50">
                    <Mic className="mr-2 h-4 w-4" /> {answers.length > turn ? "Re-answer" : "Answer"}
                  </Button>
                ) : (
                  <Button onClick={stopListening} variant="outline" className="border-red-500/60 text-red-300 animate-pulse">
                    <Square className="mr-2 h-4 w-4" /> Stop
                  </Button>
                )}
                <Button
                  onClick={nextTurn}
                  disabled={listening || transcript.trim().length === 0}
                  className="neon-button bg-averna-pink/80 hover:bg-averna-pink disabled:opacity-40"
                >
                  {turn + 1 < scenario.prompts.length ? "Next question" : "Finish & score"}
                </Button>
                <Button onClick={restart} variant="ghost" className="text-gray-400">
                  <RotateCcw className="mr-2 h-4 w-4" /> Change scenario
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {result && scenario && (
          <Card className="glass border-averna-neon/40">
            <CardContent className="py-8 text-center space-y-4">
              {result.overall >= 6 && <Confetti />}
              <Trophy className="h-14 w-14 text-yellow-400 mx-auto" />
              <p className="text-gray-400">{scenario.title} — Estimated Speaking Band</p>
              <p className="text-6xl font-bold neon-text">{result.overall.toFixed(1)}</p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-gray-400">Fluency</p>
                  <p className="text-averna-cyan font-bold text-lg">{result.fluency.toFixed(1)}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-gray-400">Vocabulary</p>
                  <p className="text-averna-purple font-bold text-lg">{result.vocabulary.toFixed(1)}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-gray-400">Grammar</p>
                  <p className="text-averna-pink font-bold text-lg">{result.grammar.toFixed(1)}</p>
                </div>
              </div>
              <div className="text-left bg-white/5 border border-white/10 rounded-lg p-4">
                <p className="text-sm text-averna-neon font-semibold mb-2">Feedback ({result.wordCount} words spoken):</p>
                <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
                  {result.feedback.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => startScenario(scenario)} variant="outline" className="border-averna-cyan/50 text-averna-cyan">
                  <RotateCcw className="mr-2 h-4 w-4" /> Retry this scenario
                </Button>
                <Button onClick={restart} className="neon-button bg-averna-primary hover:bg-averna-light">
                  Try another scenario
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
