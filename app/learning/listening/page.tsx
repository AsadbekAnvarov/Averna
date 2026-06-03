"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Headphones,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Trophy,
  Volume2,
} from "lucide-react";
import { calculateBandScore } from "@/lib/utils";

interface LQuestion {
  question: string;
  options: string[];
  answer: number;
}

interface Section {
  title: string;
  transcript: string;
  questions: LQuestion[];
}

// Listening test content. The transcript is read aloud by the browser
// (Text-to-Speech), so no audio files are needed.
const SECTIONS: Section[] = [
  {
    title: "Section 1 — Booking a Library Tour",
    transcript:
      "Good morning, and welcome to the city library. Our guided tour starts at ten thirty and lasts about forty five minutes. " +
      "First, we will visit the reading room on the ground floor, which is open from eight in the morning until nine at night. " +
      "Then we will go upstairs to the computer area, where you can print documents for ten cents per page. " +
      "Please remember that membership is free for students, but you must bring a photo identity card to register.",
    questions: [
      { question: "What time does the guided tour start?", options: ["Ten o'clock", "Ten thirty", "Eleven o'clock", "Nine o'clock"], answer: 1 },
      { question: "How long does the tour last?", options: ["30 minutes", "45 minutes", "60 minutes", "15 minutes"], answer: 1 },
      { question: "How much does printing cost per page?", options: ["5 cents", "10 cents", "20 cents", "It's free"], answer: 1 },
      { question: "What must you bring to register?", options: ["A photo ID card", "A passport photo", "A library book", "Cash payment"], answer: 0 },
    ],
  },
  {
    title: "Section 2 — A Lecture on Sleep",
    transcript:
      "Today's lecture is about the importance of sleep. Research shows that adults need between seven and nine hours of sleep each night. " +
      "During deep sleep, the brain processes new information and stores memories. " +
      "A lack of sleep can reduce concentration and weaken the immune system. " +
      "The speaker recommends avoiding screens at least one hour before going to bed to improve sleep quality.",
    questions: [
      { question: "How many hours of sleep do adults need?", options: ["5 to 6 hours", "6 to 7 hours", "7 to 9 hours", "9 to 10 hours"], answer: 2 },
      { question: "What does the brain do during deep sleep?", options: ["Burns calories", "Stores memories", "Grows taller", "Slows the heart only"], answer: 1 },
      { question: "What is recommended before bed?", options: ["Drink coffee", "Avoid screens for an hour", "Exercise hard", "Eat a large meal"], answer: 1 },
    ],
  },
];

const ALL_QUESTIONS = SECTIONS.flatMap((s) => s.questions);

export default function ListeningPage() {
  const [activeSection, setActiveSection] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [supported, setSupported] = useState(true);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [startTime] = useState(() => Date.now());
  const [saveMsg, setSaveMsg] = useState("");
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSupported(false);
    }
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const playSection = (idx: number) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(SECTIONS[idx].transcript);
    u.rate = 0.95;
    u.pitch = 1;
    u.lang = "en-GB";
    u.onend = () => {
      setSpeaking(false);
      setPaused(false);
    };
    utterRef.current = u;
    window.speechSynthesis.speak(u);
    setActiveSection(idx);
    setSpeaking(true);
    setPaused(false);
  };

  const togglePause = () => {
    if (!("speechSynthesis" in window)) return;
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  };

  const stopAudio = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  };

  const selectAnswer = (qIndex: number, optIndex: number) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: optIndex }));
  };

  const correctCount = ALL_QUESTIONS.reduce(
    (sum, q, i) => sum + (answers[i] === q.answer ? 1 : 0),
    0
  );
  const band = calculateBandScore((correctCount / ALL_QUESTIONS.length) * 100);

  const handleSubmit = async () => {
    stopAudio();
    setSubmitted(true);
    try {
      const res = await fetch("/api/learning/listening/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correctCount,
          totalQuestions: ALL_QUESTIONS.length,
          answers,
          timeSpent: Math.round((Date.now() - startTime) / 1000),
        }),
      });
      if (res.ok) setSaveMsg("✅ Result saved — points added to your account!");
      else setSaveMsg("Result shown below (not saved).");
    } catch {
      setSaveMsg("Result shown below (not saved).");
    }
  };

  const reset = () => {
    stopAudio();
    setAnswers({});
    setSubmitted(false);
    setSaveMsg("");
    setActiveSection(0);
  };

  let globalIndex = 0;

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Headphones className="h-9 w-9 text-averna-neon" />
          IELTS <span className="neon-text">Listening</span>
        </h1>
        <p className="text-gray-400 mb-6">
          Press play to hear each section read aloud, then answer the questions. 🎧
        </p>

        {!supported && (
          <Card className="glass border-yellow-500/40 mb-6">
            <CardContent className="py-4 text-yellow-300 text-sm">
              Your browser doesn&apos;t support speech playback. You can still read the
              transcript below and answer the questions.
            </CardContent>
          </Card>
        )}

        {/* Audio player */}
        <Card className="glass border-averna-cyan/30 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-averna-cyan">
              <Volume2 className="h-5 w-5" />
              Audio Player
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {SECTIONS.map((s, idx) => (
                <Button
                  key={idx}
                  onClick={() => playSection(idx)}
                  variant={activeSection === idx && speaking ? "default" : "outline"}
                  size="sm"
                  className={
                    activeSection === idx && speaking
                      ? "neon-button bg-averna-primary"
                      : "border-averna-cyan/40 text-averna-cyan"
                  }
                >
                  <Play className="mr-1 h-3.5 w-3.5" />
                  {s.title.split("—")[0].trim()}
                </Button>
              ))}
            </div>
            {speaking && (
              <div className="flex items-center gap-3">
                <Button onClick={togglePause} size="sm" variant="outline" className="border-white/20">
                  {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  <span className="ml-1">{paused ? "Resume" : "Pause"}</span>
                </Button>
                <Button onClick={stopAudio} size="sm" variant="outline" className="border-white/20">
                  <RotateCcw className="h-4 w-4" />
                  <span className="ml-1">Stop</span>
                </Button>
                <span className="text-sm text-averna-neon animate-pulse">▶ Playing…</span>
              </div>
            )}
            {submitted && (
              <details className="text-sm text-gray-400">
                <summary className="cursor-pointer hover:text-white">Show transcripts</summary>
                {SECTIONS.map((s, i) => (
                  <p key={i} className="mt-2">
                    <span className="text-averna-cyan">{s.title}:</span> {s.transcript}
                  </p>
                ))}
              </details>
            )}
          </CardContent>
        </Card>

        {/* Questions */}
        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-xl font-semibold text-white mb-3">{section.title}</h2>
              <div className="space-y-4">
                {section.questions.map((q) => {
                  const qi = globalIndex++;
                  return (
                    <Card key={qi} className="glass border-averna-primary/30">
                      <CardContent className="py-4">
                        <p className="text-white mb-3 font-medium">
                          {qi + 1}. {q.question}
                        </p>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {q.options.map((opt, oi) => {
                            const chosen = answers[qi] === oi;
                            const isCorrect = q.answer === oi;
                            let cls =
                              "text-left p-3 rounded-lg border text-sm transition-all ";
                            if (!submitted) {
                              cls += chosen
                                ? "border-averna-cyan bg-averna-cyan/10 text-white"
                                : "border-white/10 bg-white/5 text-gray-200 hover:border-averna-cyan/50";
                            } else if (isCorrect) {
                              cls += "border-averna-neon bg-averna-neon/10 text-averna-neon";
                            } else if (chosen) {
                              cls += "border-red-500 bg-red-500/10 text-red-300";
                            } else {
                              cls += "border-white/10 bg-white/5 text-gray-400";
                            }
                            return (
                              <button key={oi} className={cls} onClick={() => selectAnswer(qi, oi)}>
                                <span className="flex items-center justify-between">
                                  {opt}
                                  {submitted && isCorrect && <CheckCircle2 className="h-4 w-4" />}
                                  {submitted && chosen && !isCorrect && <XCircle className="h-4 w-4" />}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Submit / Result */}
        <div className="mt-8">
          {!submitted ? (
            <Button
              onClick={handleSubmit}
              disabled={Object.keys(answers).length < ALL_QUESTIONS.length}
              className="w-full neon-button bg-averna-primary hover:bg-averna-light disabled:opacity-50"
            >
              Submit Answers ({Object.keys(answers).length}/{ALL_QUESTIONS.length})
            </Button>
          ) : (
            <Card className="glass border-averna-neon/40 text-center">
              <CardContent className="py-8 space-y-3">
                <Trophy className="h-14 w-14 text-yellow-400 mx-auto" />
                <h2 className="text-3xl font-bold text-white">
                  {correctCount} / {ALL_QUESTIONS.length} correct
                </h2>
                <p className="text-xl text-averna-neon">Estimated Band: {band.toFixed(1)}</p>
                {saveMsg && <p className="text-sm text-gray-300">{saveMsg}</p>}
                <div className="flex gap-3 justify-center pt-2">
                  <Button onClick={reset} variant="outline" className="border-averna-cyan text-averna-cyan">
                    <RotateCcw className="mr-2 h-4 w-4" /> Try Again
                  </Button>
                  <Link href="/dashboard">
                    <Button className="neon-button bg-averna-primary">Back to Dashboard</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
