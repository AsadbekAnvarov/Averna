"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Timer, Volume2, Trophy, Headphones, BookOpen, PenTool, ChevronRight,
  Loader2, CheckCircle2, XCircle, Coins,
} from "lucide-react";
import { calculateBandScore, heuristicWritingAssessmentSafe } from "@/lib/utils";
import { Confetti } from "@/components/confetti";

const EXAM_SECONDS = 25 * 60; // 25-minute mini mock

const LISTENING = {
  transcript:
    "Welcome to the community library. The library opens at nine in the morning and closes at eight in the evening on weekdays. " +
    "Membership is completely free, but you must bring a photo ID to register. You can borrow up to six books for three weeks at a time. " +
    "There is a quiet study room on the second floor, which is very popular during exam season. Printing costs ten cents per page, " +
    "and the library also runs a free conversation club every Friday afternoon.",
  questions: [
    { q: "What time does the library close on weekdays?", options: ["6 pm", "7 pm", "8 pm", "9 pm"], a: 2 },
    { q: "How many books can you borrow?", options: ["Three", "Four", "Six", "Ten"], a: 2 },
    { q: "What do you need to become a member?", options: ["A fee", "A photo ID", "A book", "Nothing"], a: 1 },
    { q: "Where is the quiet study room?", options: ["Ground floor", "First floor", "Second floor", "Basement"], a: 2 },
    { q: "When does the free conversation club run?", options: ["Monday morning", "Friday afternoon", "Saturday evening", "Sunday"], a: 1 },
  ],
};

const READING = {
  passage:
    "Bees play a vital role in our ecosystem. As they move from flower to flower collecting nectar, they transfer pollen, " +
    "enabling plants to reproduce. Roughly one third of the food we eat depends on pollination by bees and other insects. In recent " +
    "years, however, bee populations have declined sharply, largely due to pesticides, disease and the loss of natural habitat. " +
    "Scientists warn that protecting bees is essential for global food security, and many cities have begun planting wildflowers " +
    "and reducing pesticide use to help bee numbers recover.",
  questions: [
    { q: "What do bees transfer between flowers?", options: ["Water", "Pollen", "Seeds", "Soil"], a: 1 },
    { q: "How much of our food depends on pollination?", options: ["One tenth", "One third", "One half", "All"], a: 1 },
    { q: "Which is NOT named as a cause of bee decline?", options: ["Pesticides", "Disease", "Habitat loss", "Cold weather"], a: 3 },
    { q: "Protecting bees is described as essential for…", options: ["Tourism", "Global food security", "Air quality", "Water supply"], a: 1 },
    { q: "What have many cities started doing?", options: ["Banning gardens", "Planting wildflowers", "Importing bees", "Building hives indoors"], a: 1 },
  ],
};

const WRITING_PROMPT =
  "Some people think students should study subjects they enjoy, while others believe they should study subjects useful for their future career. Discuss both views and give your opinion. (Write at least 250 words.)";

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-GB";
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

interface Result {
  listeningBand: number;
  readingBand: number;
  writingBand: number;
  overall: number;
  pointsEarned: number;
  saved: boolean;
}

export default function MockExamPage() {
  const [started, setStarted] = useState(false);
  const [section, setSection] = useState<"listening" | "reading" | "writing">("listening");
  const [lAns, setLAns] = useState<Record<number, number>>({});
  const [rAns, setRAns] = useState<Record<number, number>>({});
  const [essay, setEssay] = useState("");
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [secs, setSecs] = useState(EXAM_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lCorrect = LISTENING.questions.reduce((n, q, i) => n + (lAns[i] === q.a ? 1 : 0), 0);
  const rCorrect = READING.questions.reduce((n, q, i) => n + (rAns[i] === q.a ? 1 : 0), 0);
  const words = essay.trim().split(/\s+/).filter(Boolean).length;

  const finishExam = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setFinished(true);
    setSubmitting(true);

    const lc = LISTENING.questions.reduce((n, q, i) => n + (lAns[i] === q.a ? 1 : 0), 0);
    const rc = READING.questions.reduce((n, q, i) => n + (rAns[i] === q.a ? 1 : 0), 0);

    // Client-side fallback computation
    const lBand = calculateBandScore((lc / LISTENING.questions.length) * 100);
    const rBand = calculateBandScore((rc / READING.questions.length) * 100);
    const wBand = heuristicWritingAssessmentSafe(essay);
    const fallback: Result = {
      listeningBand: lBand,
      readingBand: rBand,
      writingBand: wBand,
      overall: Math.round(((lBand + rBand + wBand) / 3) * 2) / 2,
      pointsEarned: 0,
      saved: false,
    };

    try {
      const res = await fetch("/api/learning/mock/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listeningCorrect: lc,
          listeningTotal: LISTENING.questions.length,
          readingCorrect: rc,
          readingTotal: READING.questions.length,
          essay,
          timeSpent: EXAM_SECONDS - secs,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult({ ...data, saved: true });
      } else {
        setResult(fallback);
      }
    } catch {
      setResult(fallback);
    } finally {
      setSubmitting(false);
    }
  }, [lAns, rAns, essay, secs]);

  useEffect(() => {
    if (started && !finished) {
      timerRef.current = setInterval(() => {
        setSecs((s) => {
          if (s <= 1) {
            clearInterval(timerRef.current!);
            finishExam();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [started, finished, finishExam]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  const reset = () => {
    setStarted(false); setFinished(false); setResult(null);
    setSecs(EXAM_SECONDS); setLAns({}); setRAns({}); setEssay(""); setSection("listening");
  };

  // ---------- Intro ----------
  if (!started) {
    return (
      <div className="min-h-screen premium-gradient">
        <div className="container mx-auto px-4 py-10 max-w-2xl">
          <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">← Back to Dashboard</Link>
          <Card className="glass border-averna-neon/30 text-center">
            <CardContent className="py-10 space-y-4">
              <Trophy className="h-14 w-14 text-yellow-400 mx-auto" />
              <h1 className="text-3xl font-bold text-white">Mock IELTS Exam</h1>
              <p className="text-gray-300">A 25-minute mini mock: Listening, Reading and Writing, with an estimated overall band and points for each section.</p>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>🎧 Listening — 5 questions (audio read aloud)</li>
                <li>📖 Reading — 5 questions</li>
                <li>✍️ Writing — essay (250+ words)</li>
                <li>🪙 Earn points and save your band to your progress</li>
              </ul>
              <Button onClick={() => setStarted(true)} className="neon-button bg-averna-primary hover:bg-averna-light">
                Start Exam (25:00)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---------- Results ----------
  if (finished) {
    const r = result;
    return (
      <div className="min-h-screen premium-gradient">
        <div className="container mx-auto px-4 py-10 max-w-2xl pb-24 lg:pb-10">
          <Card className="glass border-averna-neon/40 text-center mb-6">
            <CardContent className="py-10 space-y-4">
              {submitting || !r ? (
                <>
                  <Loader2 className="h-12 w-12 animate-spin text-averna-neon mx-auto" />
                  <p className="text-gray-300">Scoring your exam…</p>
                </>
              ) : (
                <>
                  <Trophy className="h-16 w-16 text-yellow-400 mx-auto" />
                  {r.overall >= 6 && <Confetti />}
                  <h1 className="text-3xl font-bold text-white">Estimated Overall Band</h1>
                  <p className="text-6xl font-bold neon-text">{r.overall.toFixed(1)}</p>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-gray-400">Listening</p>
                      <p className="text-averna-cyan font-bold text-lg">{r.listeningBand.toFixed(1)}</p>
                      <p className="text-xs text-gray-500">{lCorrect}/{LISTENING.questions.length}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-gray-400">Reading</p>
                      <p className="text-averna-purple font-bold text-lg">{r.readingBand.toFixed(1)}</p>
                      <p className="text-xs text-gray-500">{rCorrect}/{READING.questions.length}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-gray-400">Writing</p>
                      <p className="text-averna-pink font-bold text-lg">{r.writingBand.toFixed(1)}</p>
                      <p className="text-xs text-gray-500">{words} words</p>
                    </div>
                  </div>
                  {r.saved && r.pointsEarned > 0 && (
                    <p className="inline-flex items-center gap-1 text-averna-neon font-semibold">
                      <Coins className="h-4 w-4" /> +{r.pointsEarned} points earned & saved!
                    </p>
                  )}
                  <div className="flex gap-3 justify-center pt-2">
                    <Link href="/dashboard"><Button variant="outline" className="border-averna-cyan text-averna-cyan">Dashboard</Button></Link>
                    <Button onClick={reset} className="neon-button bg-averna-primary">Retry</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Answer review */}
          {!submitting && r && (
            <Card className="glass border-white/10">
              <CardHeader><CardTitle className="text-white text-lg">Answer Review</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <ReviewBlock title="Listening" color="text-averna-cyan" qs={LISTENING.questions} ans={lAns} />
                <ReviewBlock title="Reading" color="text-averna-purple" qs={READING.questions} ans={rAns} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ---------- Exam ----------
  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center justify-between mb-4 sticky top-2 z-10">
          <div className="flex gap-2 text-xs">
            {(["listening", "reading", "writing"] as const).map((s) => (
              <span key={s} className={`px-2 py-1 rounded-full ${section === s ? "bg-averna-primary text-white" : "bg-white/10 text-gray-400"}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
            ))}
          </div>
          <span className={`flex items-center gap-1 font-bold ${secs < 60 ? "text-red-400 animate-pulse" : "text-averna-neon"}`}>
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
              <div className="flex gap-2">
                <Button onClick={() => setSection("listening")} variant="outline" className="border-white/20">Back</Button>
                <Button onClick={() => setSection("writing")} className="flex-1 neon-button bg-averna-primary">
                  Next: Writing <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
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
              <p className={`text-xs ${words >= 250 ? "text-averna-neon" : "text-gray-400"}`}>
                Words: {words} {words < 250 && "(aim for 250+)"}
              </p>
              <div className="flex gap-2">
                <Button onClick={() => setSection("reading")} variant="outline" className="border-white/20">Back</Button>
                <Button onClick={finishExam} className="flex-1 neon-button bg-averna-primary hover:bg-averna-light">
                  Finish Exam & See Band
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ReviewBlock({
  title,
  color,
  qs,
  ans,
}: {
  title: string;
  color: string;
  qs: { q: string; options: string[]; a: number }[];
  ans: Record<number, number>;
}) {
  return (
    <div>
      <p className={`font-semibold mb-2 ${color}`}>{title}</p>
      <div className="space-y-2">
        {qs.map((q, i) => {
          const correct = ans[i] === q.a;
          return (
            <div key={i} className="text-sm p-2 rounded-lg bg-white/5 border border-white/10">
              <p className="text-gray-200 flex items-start gap-2">
                {correct ? (
                  <CheckCircle2 className="h-4 w-4 text-averna-neon shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                )}
                {i + 1}. {q.q}
              </p>
              {!correct && (
                <p className="text-xs text-gray-400 ml-6 mt-1">
                  Correct: <span className="text-averna-neon">{q.options[q.a]}</span>
                  {ans[i] !== undefined && <> · You: <span className="text-red-300">{q.options[ans[i]]}</span></>}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
