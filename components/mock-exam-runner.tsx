"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Timer, Volume2, Trophy, Headphones, BookOpen, PenTool, ChevronRight,
  Loader2, CheckCircle2, XCircle, Coins, ArrowLeft,
} from "lucide-react";
import { calculateBandScore, heuristicWritingAssessmentSafe } from "@/lib/utils";
import { Confetti } from "@/components/confetti";
import type { MockExam, MockQuestion } from "@/lib/mock-exams-data";

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

interface Props {
  exam: MockExam;
}

export function MockExamRunner({ exam }: Props) {
  const examSeconds = exam.durationMinutes * 60;
  const listeningQs = exam.listening.questions;
  const readingQs = exam.reading.questions;

  const [started, setStarted] = useState(false);
  const [section, setSection] = useState<"listening" | "reading" | "writing">("listening");
  const [lAns, setLAns] = useState<Record<number, number>>({});
  const [rAns, setRAns] = useState<Record<number, number>>({});
  const [essay, setEssay] = useState("");
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [secs, setSecs] = useState(examSeconds);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lCorrect = listeningQs.reduce((n, q, i) => n + (lAns[i] === q.a ? 1 : 0), 0);
  const rCorrect = readingQs.reduce((n, q, i) => n + (rAns[i] === q.a ? 1 : 0), 0);
  const words = essay.trim().split(/\s+/).filter(Boolean).length;

  const finishExam = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setFinished(true);
    setSubmitting(true);

    const lc = listeningQs.reduce((n, q, i) => n + (lAns[i] === q.a ? 1 : 0), 0);
    const rc = readingQs.reduce((n, q, i) => n + (rAns[i] === q.a ? 1 : 0), 0);

    const lBand = calculateBandScore((lc / listeningQs.length) * 100);
    const rBand = calculateBandScore((rc / readingQs.length) * 100);
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
          listeningTotal: listeningQs.length,
          readingCorrect: rc,
          readingTotal: readingQs.length,
          essay,
          timeSpent: examSeconds - secs,
          examId: exam.id,
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
  }, [lAns, rAns, essay, secs, examSeconds, exam.id, listeningQs, readingQs]);

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
    setSecs(examSeconds); setLAns({}); setRAns({}); setEssay(""); setSection("listening");
  };

  const DIFF_PILL: Record<string, string> = {
    Easy: "text-averna-neon border-averna-neon/40 bg-averna-neon/10",
    Medium: "text-averna-cyan border-averna-cyan/40 bg-averna-cyan/10",
    Hard: "text-averna-pink border-averna-pink/40 bg-averna-pink/10",
  };

  // ---------- Intro ----------
  if (!started) {
    return (
      <div className="min-h-screen premium-gradient">
        <div className="container mx-auto px-4 py-10 max-w-2xl">
          <Link href="/learning/mock-exam" className="text-averna-neon hover:underline text-sm mb-4 inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to exams
          </Link>
          <Card className="glass border-averna-neon/30 text-center">
            <CardContent className="py-10 space-y-4">
              <Trophy className="h-14 w-14 text-yellow-400 mx-auto" />
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">{exam.title}</h1>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${DIFF_PILL[exam.difficulty]}`}>{exam.difficulty}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-averna-primary/20 text-averna-neon">{exam.theme}</span>
                </div>
              </div>
              <p className="text-gray-300">{exam.description}</p>
              <ul className="text-sm text-gray-400 space-y-1 text-left inline-block">
                <li>🎧 Listening — {listeningQs.length} questions (audio read aloud)</li>
                <li>📖 Reading — {readingQs.length} questions</li>
                <li>✍️ Writing — {exam.writing.type.replace("-", " ")} essay (250+ words)</li>
                <li>⏱️ Time limit — {exam.durationMinutes} minutes</li>
                <li>🪙 Earn points and save your band to your progress</li>
              </ul>
              <Button onClick={() => setStarted(true)} className="neon-button bg-averna-primary hover:bg-averna-light">
                Start Exam ({exam.durationMinutes}:00)
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
                  <p className="text-gray-400 text-sm">{exam.title}</p>
                  <h1 className="text-3xl font-bold text-white">Estimated Overall Band</h1>
                  <p className="text-6xl font-bold neon-text">{r.overall.toFixed(1)}</p>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-gray-400">Listening</p>
                      <p className="text-averna-cyan font-bold text-lg">{r.listeningBand.toFixed(1)}</p>
                      <p className="text-xs text-gray-500">{lCorrect}/{listeningQs.length}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-gray-400">Reading</p>
                      <p className="text-averna-purple font-bold text-lg">{r.readingBand.toFixed(1)}</p>
                      <p className="text-xs text-gray-500">{rCorrect}/{readingQs.length}</p>
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
                  <div className="flex gap-3 justify-center pt-2 flex-wrap">
                    <Link href="/learning/mock-exam"><Button variant="outline" className="border-averna-cyan text-averna-cyan">Other exams</Button></Link>
                    <Button onClick={reset} className="neon-button bg-averna-primary">Retry this one</Button>
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
                <ReviewBlock title="Listening" color="text-averna-cyan" qs={listeningQs} ans={lAns} />
                <ReviewBlock title="Reading" color="text-averna-purple" qs={readingQs} ans={rAns} />
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
              <Button onClick={() => speak(exam.listening.transcript)} variant="outline" className="border-averna-cyan text-averna-cyan">
                <Volume2 className="mr-2 h-4 w-4" /> Play audio
              </Button>
              {listeningQs.map((q, qi) => (
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
              <p className="text-sm text-gray-300 bg-white/5 border border-white/10 rounded-lg p-3 leading-relaxed">{exam.reading.passage}</p>
              {readingQs.map((q, qi) => (
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
              <p className="text-sm text-gray-200 leading-relaxed">{exam.writing.prompt}</p>
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
  qs: MockQuestion[];
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
