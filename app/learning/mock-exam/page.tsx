"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Timer, Volume2, Trophy, Headphones, BookOpen, PenTool, ChevronRight } from "lucide-react";
import { calculateBandScore } from "@/lib/utils";

const EXAM_SECONDS = 20 * 60; // 20-minute mini mock

const LISTENING = {
  transcript:
    "Welcome to the community library. The library opens at nine in the morning and closes at eight in the evening on weekdays. " +
    "Membership is free, but you need to bring a photo ID. You can borrow up to six books for three weeks. " +
    "There is a quiet study room on the second floor, and printing costs ten cents per page.",
  questions: [
    { q: "What time does the library close on weekdays?", options: ["6 pm", "7 pm", "8 pm", "9 pm"], a: 2 },
    { q: "How many books can you borrow?", options: ["Three", "Four", "Six", "Ten"], a: 2 },
    { q: "What do you need to become a member?", options: ["A fee", "A photo ID", "A book", "Nothing"], a: 1 },
  ],
};

const READING = {
  passage:
    "Bees play a vital role in our ecosystem. As they move from flower to flower collecting nectar, they transfer pollen, " +
    "enabling plants to reproduce. Roughly one third of the food we eat depends on pollination by bees. In recent years, " +
    "however, bee populations have declined sharply, largely due to pesticides, disease and habitat loss. Scientists warn " +
    "that protecting bees is essential for global food security.",
  questions: [
    { q: "What do bees transfer between flowers?", options: ["Water", "Pollen", "Seeds", "Soil"], a: 1 },
    { q: "How much of our food depends on bee pollination?", options: ["One tenth", "One third", "One half", "All"], a: 1 },
    { q: "Which is NOT named as a cause of bee decline?", options: ["Pesticides", "Disease", "Habitat loss", "Cold weather"], a: 3 },
  ],
};

const WRITING_PROMPT =
  "Some people think students should study subjects they enjoy, while others believe they should study subjects useful for their future career. Discuss both views and give your opinion. (Write at least 150 words.)";

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-GB";
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

export default function MockExamPage() {
  const [started, setStarted] = useState(false);
  const [section, setSection] = useState<"listening" | "reading" | "writing">("listening");
  const [lAns, setLAns] = useState<Record<number, number>>({});
  const [rAns, setRAns] = useState<Record<number, number>>({});
  const [essay, setEssay] = useState("");
  const [finished, setFinished] = useState(false);
  const [secs, setSecs] = useState(EXAM_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (started && !finished) {
      timerRef.current = setInterval(() => {
        setSecs((s) => {
          if (s <= 1) {
            clearInterval(timerRef.current!);
            setFinished(true);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [started, finished]);

  const lCorrect = LISTENING.questions.reduce((n, q, i) => n + (lAns[i] === q.a ? 1 : 0), 0);
  const rCorrect = READING.questions.reduce((n, q, i) => n + (rAns[i] === q.a ? 1 : 0), 0);
  const words = essay.trim().split(/\s+/).filter(Boolean).length;

  const lBand = calculateBandScore((lCorrect / LISTENING.questions.length) * 100);
  const rBand = calculateBandScore((rCorrect / READING.questions.length) * 100);
  const wBand = words >= 150 ? 6.5 : words >= 100 ? 5.5 : words >= 50 ? 4.5 : 3.5;
  const overall = Math.round(((lBand + rBand + wBand) / 3) * 2) / 2;

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  if (!started) {
    return (
      <div className="min-h-screen premium-gradient">
        <div className="container mx-auto px-4 py-10 max-w-2xl">
          <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">← Back to Dashboard</Link>
          <Card className="glass border-averna-neon/30 text-center">
            <CardContent className="py-10 space-y-4">
              <Trophy className="h-14 w-14 text-yellow-400 mx-auto" />
              <h1 className="text-3xl font-bold text-white">Mock IELTS Exam</h1>
              <p className="text-gray-300">A 20-minute mini mock: Listening, Reading and Writing, with an estimated overall band score at the end.</p>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>🎧 Listening — 3 questions (audio read aloud)</li>
                <li>📖 Reading — 3 questions</li>
                <li>✍️ Writing — short essay (150+ words)</li>
              </ul>
              <Button onClick={() => setStarted(true)} className="neon-button bg-averna-primary hover:bg-averna-light">
                Start Exam (20:00)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="min-h-screen premium-gradient">
        <div className="container mx-auto px-4 py-10 max-w-2xl">
          <Card className="glass border-averna-neon/40 text-center">
            <CardContent className="py-10 space-y-4">
              <Trophy className="h-16 w-16 text-yellow-400 mx-auto" />
              <h1 className="text-3xl font-bold text-white">Estimated Overall Band</h1>
              <p className="text-6xl font-bold neon-text">{overall.toFixed(1)}</p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-gray-400">Listening</p>
                  <p className="text-averna-cyan font-bold text-lg">{lBand.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">{lCorrect}/3</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-gray-400">Reading</p>
                  <p className="text-averna-purple font-bold text-lg">{rBand.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">{rCorrect}/3</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-gray-400">Writing</p>
                  <p className="text-averna-pink font-bold text-lg">{wBand.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">{words} words</p>
                </div>
              </div>
              <p className="text-sm text-gray-400">This is a practice estimate. Keep practising each skill to improve! 💪</p>
              <div className="flex gap-3 justify-center">
                <Link href="/dashboard"><Button variant="outline" className="border-averna-cyan text-averna-cyan">Dashboard</Button></Link>
                <Button onClick={() => { setStarted(false); setFinished(false); setSecs(EXAM_SECONDS); setLAns({}); setRAns({}); setEssay(""); setSection("listening"); }} className="neon-button bg-averna-primary">Retry</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Sticky timer */}
        <div className="flex items-center justify-between mb-4 sticky top-2 z-10">
          <div className="flex gap-2 text-xs">
            {(["listening", "reading", "writing"] as const).map((s) => (
              <span key={s} className={`px-2 py-1 rounded-full ${section === s ? "bg-averna-primary text-white" : "bg-white/10 text-gray-400"}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
            ))}
          </div>
          <span className={`flex items-center gap-1 font-bold ${secs < 60 ? "text-red-400" : "text-averna-neon"}`}>
            <Timer className="h-4 w-4" /> {mm}:{ss}
          </span>
        </div>

        {section === "listening" && (
          <Card className="glass border-averna-cyan/30">
            <CardHeader><CardTitle className="flex items-center gap-2 text-averna-cyan"><Headphones className="h-5 w-5" /> Section 1 · Listening</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => speak(LISTENING.transcript)} variant="outline" className="border-averna-cyan text-averna-cyan">
                <Volume2 className="mr-2 h-4 w-4" /> Play audio
              </Button>
              {LISTENING.questions.map((q, qi) => (
                <div key={qi}>
                  <p className="text-white mb-2">{qi + 1}. {q.q}</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {q.options.map((o, oi) => (
                      <button key={oi} onClick={() => setLAns({ ...lAns, [qi]: oi })}
                        className={`text-left text-sm p-2 rounded-lg border ${lAns[qi] === oi ? "border-averna-cyan bg-averna-cyan/10 text-white" : "border-white/10 bg-white/5 text-gray-200"}`}>
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <Button onClick={() => setSection("reading")} className="w-full neon-button bg-averna-primary">
                Next: Reading <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {section === "reading" && (
          <Card className="glass border-averna-purple/30">
            <CardHeader><CardTitle className="flex items-center gap-2 text-averna-purple"><BookOpen className="h-5 w-5" /> Section 2 · Reading</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-300 bg-white/5 border border-white/10 rounded-lg p-3">{READING.passage}</p>
              {READING.questions.map((q, qi) => (
                <div key={qi}>
                  <p className="text-white mb-2">{qi + 1}. {q.q}</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {q.options.map((o, oi) => (
                      <button key={oi} onClick={() => setRAns({ ...rAns, [qi]: oi })}
                        className={`text-left text-sm p-2 rounded-lg border ${rAns[qi] === oi ? "border-averna-purple bg-averna-purple/10 text-white" : "border-white/10 bg-white/5 text-gray-200"}`}>
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <Button onClick={() => setSection("writing")} className="w-full neon-button bg-averna-primary">
                Next: Writing <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {section === "writing" && (
          <Card className="glass border-averna-pink/30">
            <CardHeader><CardTitle className="flex items-center gap-2 text-averna-pink"><PenTool className="h-5 w-5" /> Section 3 · Writing</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-200">{WRITING_PROMPT}</p>
              <textarea
                value={essay}
                onChange={(e) => setEssay(e.target.value)}
                rows={10}
                placeholder="Write your essay here..."
                className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-pink"
              />
              <p className="text-xs text-gray-400">Words: {words} {words < 150 && `(aim for 150+)`}</p>
              <Button onClick={() => { if (timerRef.current) clearInterval(timerRef.current); setFinished(true); }} className="w-full neon-button bg-averna-primary hover:bg-averna-light">
                Finish Exam & See Band
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
