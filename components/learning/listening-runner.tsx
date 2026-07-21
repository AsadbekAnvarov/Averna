"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Headphones, Play, Pause, RotateCcw, CheckCircle2, XCircle, Trophy, Volume2, ArrowLeft,
} from "lucide-react";
import { calculateBandScore } from "@/lib/utils";
import type { ListeningTest } from "@/lib/listening-tests-data";

const DIFF_COLORS: Record<string, string> = {
  Easy: "text-averna-neon border-averna-neon/40 bg-averna-neon/10",
  Medium: "text-averna-cyan border-averna-cyan/40 bg-averna-cyan/10",
  Hard: "text-averna-pink border-averna-pink/40 bg-averna-pink/10",
};

export function ListeningRunner({ tests }: { tests: ListeningTest[] }) {
  const [testId, setTestId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [supported, setSupported] = useState(true);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [startTime, setStartTime] = useState(() => Date.now());
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) setSupported(false);
    return () => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, []);

  const test = tests.find((t) => t.id === testId) || null;
  const sections = test?.sections ?? [];
  const allQuestions = sections.flatMap((s) => s.questions);

  const playSection = (idx: number) => {
    if (!("speechSynthesis" in window) || !test) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(test.sections[idx].transcript);
    u.rate = test.difficulty === "Hard" ? 1.05 : 0.95;
    u.lang = "en-GB";
    u.onend = () => { setSpeaking(false); setPaused(false); };
    window.speechSynthesis.speak(u);
    setActiveSection(idx); setSpeaking(true); setPaused(false);
  };

  const togglePause = () => {
    if (!("speechSynthesis" in window)) return;
    if (paused) { window.speechSynthesis.resume(); setPaused(false); }
    else { window.speechSynthesis.pause(); setPaused(true); }
  };
  const stopAudio = () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); setSpeaking(false); setPaused(false); };

  const selectAnswer = (qi: number, oi: number) => { if (!submitted) setAnswers((p) => ({ ...p, [qi]: oi })); };

  const correctCount = allQuestions.reduce((sum, q, i) => sum + (answers[i] === q.answer ? 1 : 0), 0);
  const band = calculateBandScore((correctCount / Math.max(1, allQuestions.length)) * 100);

  const openTest = (id: string) => {
    setTestId(id); setAnswers({}); setSubmitted(false); setSaveMsg("");
    setActiveSection(0); setStartTime(Date.now());
  };

  const backToBank = () => { stopAudio(); setTestId(null); setAnswers({}); setSubmitted(false); setSaveMsg(""); };

  const handleSubmit = async () => {
    stopAudio();
    setSubmitted(true);
    try {
      const res = await fetch("/api/learning/listening/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correctCount, totalQuestions: allQuestions.length, answers, timeSpent: Math.round((Date.now() - startTime) / 1000) }),
      });
      setSaveMsg(res.ok ? "✅ Result saved — points added to your account!" : "Result shown below (not saved).");
    } catch {
      setSaveMsg("Result shown below (not saved).");
    }
  };

  // ---------- Test bank (selector) ----------
  if (!test) {
    return (
      <div className="min-h-screen premium-gradient">
        <div className="container mx-auto px-4 py-8 max-w-3xl pb-24 lg:pb-8">
          <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">← Back to Dashboard</Link>
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Headphones className="h-9 w-9 text-averna-neon" />
            IELTS <span className="neon-text">Listening</span>
          </h1>
          <p className="text-gray-400 mb-6">Choose a test. The audio is read aloud by your browser — no downloads needed. 🎧</p>

          {!supported && (
            <Card className="glass border-yellow-500/40 mb-6">
              <CardContent className="py-4 text-yellow-300 text-sm">
                Your browser doesn&apos;t support speech playback, but you can still read the transcript and answer.
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {tests.map((t) => (
              <Card key={t.id} className="glass border-averna-cyan/30 hover:border-averna-neon/40 transition-colors">
                <CardContent className="py-5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-lg font-bold text-white">{t.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${DIFF_COLORS[t.difficulty]}`}>{t.difficulty}</span>
                    </div>
                    <p className="text-sm text-gray-400">{t.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t.sections.length} section{t.sections.length > 1 ? "s" : ""} · {t.sections.flatMap((s) => s.questions).length} questions
                    </p>
                  </div>
                  <Button onClick={() => openTest(t.id)} className="neon-button bg-averna-primary hover:bg-averna-light shrink-0">
                    <Play className="mr-2 h-4 w-4" /> Start
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Test runner ----------
  let globalIndex = 0;
  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-3xl pb-24 lg:pb-8">
        <button onClick={backToBank} className="text-averna-neon hover:underline text-sm mb-4 flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to tests
        </button>
        <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-3">
          <Headphones className="h-8 w-8 text-averna-neon" />
          {test.title}
        </h1>
        <p className="text-gray-400 mb-6">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${DIFF_COLORS[test.difficulty]}`}>{test.difficulty}</span>
        </p>

        {/* Audio player */}
        <Card className="glass border-averna-cyan/30 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-averna-cyan"><Volume2 className="h-5 w-5" /> Audio Player</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {sections.map((s, idx) => (
                <Button key={idx} onClick={() => playSection(idx)}
                  variant={activeSection === idx && speaking ? "default" : "outline"} size="sm"
                  className={activeSection === idx && speaking ? "neon-button bg-averna-primary" : "border-averna-cyan/40 text-averna-cyan"}>
                  <Play className="mr-1 h-3.5 w-3.5" /> {s.title.split("—")[0].trim()}
                </Button>
              ))}
            </div>
            {speaking && (
              <div className="flex items-center gap-3">
                <Button onClick={togglePause} size="sm" variant="outline" className="border-white/20">
                  {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  <span className="ml-1">{paused ? "Resume" : "Pause"}</span>
                </Button>
                <Button onClick={stopAudio} size="sm" variant="outline" className="border-white/20"><RotateCcw className="h-4 w-4" /><span className="ml-1">Stop</span></Button>
                <span className="text-sm text-averna-neon animate-pulse">▶ Playing…</span>
              </div>
            )}
            {submitted && (
              <details className="text-sm text-gray-400">
                <summary className="cursor-pointer hover:text-white">Show transcripts</summary>
                {sections.map((s, i) => (
                  <p key={i} className="mt-2"><span className="text-averna-cyan">{s.title}:</span> {s.transcript}</p>
                ))}
              </details>
            )}
          </CardContent>
        </Card>

        {/* Questions */}
        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-xl font-semibold text-white mb-3">{section.title}</h2>
              <div className="space-y-4">
                {section.questions.map((q) => {
                  const qi = globalIndex++;
                  return (
                    <Card key={qi} className="glass border-averna-primary/30">
                      <CardContent className="py-4">
                        <p className="text-white mb-3 font-medium">{qi + 1}. {q.question}</p>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {q.options.map((opt, oi) => {
                            const chosen = answers[qi] === oi;
                            const isCorrect = q.answer === oi;
                            let cls = "text-left p-3 rounded-lg border text-sm transition-all ";
                            if (!submitted) cls += chosen ? "border-averna-cyan bg-averna-cyan/10 text-white" : "border-white/10 bg-white/5 text-gray-200 hover:border-averna-cyan/50";
                            else if (isCorrect) cls += "border-averna-neon bg-averna-neon/10 text-averna-neon";
                            else if (chosen) cls += "border-red-500 bg-red-500/10 text-red-300";
                            else cls += "border-white/10 bg-white/5 text-gray-400";
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
            <Button onClick={handleSubmit} disabled={Object.keys(answers).length < allQuestions.length}
              className="w-full neon-button bg-averna-primary hover:bg-averna-light disabled:opacity-50">
              Submit Answers ({Object.keys(answers).length}/{allQuestions.length})
            </Button>
          ) : (
            <Card className="glass border-averna-neon/40 text-center">
              <CardContent className="py-8 space-y-3">
                <Trophy className="h-14 w-14 text-yellow-400 mx-auto" />
                <h2 className="text-3xl font-bold text-white">{correctCount} / {allQuestions.length} correct</h2>
                <p className="text-xl text-averna-neon">Estimated Band: {band.toFixed(1)}</p>
                {saveMsg && <p className="text-sm text-gray-300">{saveMsg}</p>}
                <div className="flex gap-3 justify-center pt-2 flex-wrap">
                  <Button onClick={() => openTest(test.id)} variant="outline" className="border-averna-cyan text-averna-cyan">
                    <RotateCcw className="mr-2 h-4 w-4" /> Retry
                  </Button>
                  <Button onClick={backToBank} className="neon-button bg-averna-primary">Other tests</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
