"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Square, Volume2, RotateCcw, Trophy, Bot, Loader2 } from "lucide-react";
import { scoreSpeaking, type SpeakingScore } from "@/lib/utils";
import { Confetti } from "@/components/confetti";

const QUESTIONS = [
  "Describe your hometown and what you like about it.",
  "Talk about a hobby you enjoy and why.",
  "Describe a person who has influenced you.",
  "Do you think technology has improved education? Why or why not?",
  "Describe your ideal job and explain your choice.",
  "Talk about a memorable trip you have taken.",
];

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-GB";
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

export default function ExaminerPage() {
  const [qIndex, setQIndex] = useState(0);
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<SpeakingScore | null>(null);
  const [metrics, setMetrics] = useState<{ wpm: number; fillers: number; words: number; secs: number } | null>(null);

  const recRef = useRef<any>(null);
  const startRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackedRef = useRef(false);

  const question = QUESTIONS[qIndex];

  // Record speaking practice for the daily Learning Path (once per day).
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
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e: any) => {
      let full = "";
      for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript + " ";
      setTranscript(full.trim());
    };
    rec.onerror = () => stop();
    recRef.current = rec;
    return () => { try { rec.abort(); } catch {}; if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    setTranscript("");
    setResult(null);
    setMetrics(null);
    setElapsed(0);
    startRef.current = Date.now();
    try { recRef.current?.start(); } catch {}
    setListening(true);
    timerRef.current = setInterval(() => setElapsed(Math.round((Date.now() - startRef.current) / 1000)), 1000);
  };

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch {}
    if (timerRef.current) clearInterval(timerRef.current);
    setListening(false);
    const secs = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
    setTranscript((t) => {
      if (t.trim().length > 0) {
        setResult(scoreSpeaking(t, secs));
        // Fluency metrics
        const words = t.trim().split(/\s+/).filter(Boolean);
        const fillerList = ["um", "uh", "er", "erm", "like", "basically", "actually", "literally"];
        const fillers = words.filter((w) => fillerList.includes(w.toLowerCase().replace(/[^a-z]/g, ""))).length;
        const wpm = Math.round(words.length / (secs / 60));
        setMetrics({ wpm, fillers, words: words.length, secs });
        trackSpeaking();
      }
      return t;
    });
  }, []);

  const reset = () => {
    setTranscript(""); setResult(null); setMetrics(null); setElapsed(0);
    setQIndex((i) => (i + 1) % QUESTIONS.length);
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-2xl pb-24 lg:pb-8">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">← Back to Dashboard</Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Bot className="h-8 w-8 text-averna-cyan" />
          AI Speaking <span className="neon-text-cyan">Examiner</span>
        </h1>
        <p className="text-gray-400 mb-6">Answer the question out loud. The examiner transcribes your speech and scores it. 🎤</p>

        {!supported && (
          <Card className="glass border-yellow-500/40 mb-6">
            <CardContent className="py-4 text-yellow-300 text-sm">
              Speech recognition isn&apos;t supported here. Open in <strong>Google Chrome</strong> for the full experience.
            </CardContent>
          </Card>
        )}

        {/* Question */}
        <Card className="glass border-averna-purple/30 mb-6">
          <CardHeader><CardTitle className="text-averna-purple">Question</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xl text-white">{question}</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => speak(question)} variant="outline" className="border-averna-cyan text-averna-cyan">
                <Volume2 className="mr-2 h-4 w-4" /> Hear it
              </Button>
              {!listening ? (
                <Button onClick={start} disabled={!supported} className="neon-button bg-averna-primary hover:bg-averna-light disabled:opacity-50">
                  <Mic className="mr-2 h-4 w-4" /> Start Answering
                </Button>
              ) : (
                <Button onClick={stop} variant="outline" className="border-red-500/60 text-red-300 animate-pulse">
                  <Square className="mr-2 h-4 w-4" /> Stop ({mm}:{ss})
                </Button>
              )}
              <Button onClick={reset} variant="ghost" className="text-gray-400">
                <RotateCcw className="mr-2 h-4 w-4" /> New question
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Live transcript */}
        {(listening || transcript) && (
          <Card className="glass border-averna-cyan/30 mb-6">
            <CardHeader><CardTitle className="text-sm text-averna-cyan flex items-center gap-2">
              {listening && <Loader2 className="h-4 w-4 animate-spin" />} Transcript
            </CardTitle></CardHeader>
            <CardContent>
              <p className="text-gray-200 text-sm min-h-[40px]">{transcript || "Listening…"}</p>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {result && (
          <Card className="glass border-averna-neon/40">
            <CardContent className="py-8 text-center space-y-4">
              {result.overall >= 6 && <Confetti />}
              <Trophy className="h-14 w-14 text-yellow-400 mx-auto" />
              <p className="text-gray-400">Estimated Speaking Band</p>
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
              {metrics && (
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-gray-400">Speed</p>
                    <p className={`font-bold text-lg ${metrics.wpm >= 110 && metrics.wpm <= 160 ? "text-averna-neon" : "text-yellow-400"}`}>
                      {metrics.wpm}
                    </p>
                    <p className="text-[10px] text-gray-500">words/min</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-gray-400">Filler words</p>
                    <p className={`font-bold text-lg ${metrics.fillers <= 2 ? "text-averna-neon" : "text-orange-400"}`}>
                      {metrics.fillers}
                    </p>
                    <p className="text-[10px] text-gray-500">um, uh, like…</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-gray-400">Duration</p>
                    <p className="font-bold text-lg text-averna-cyan">{metrics.secs}s</p>
                    <p className="text-[10px] text-gray-500">{metrics.words} words</p>
                  </div>
                </div>
              )}
              {metrics && (
                <p className="text-xs text-gray-400">
                  {metrics.wpm < 110
                    ? "💡 Try to speak a little faster and more continuously."
                    : metrics.wpm > 160
                    ? "💡 Slow down slightly for clearer delivery."
                    : "👍 Great speaking pace!"}
                  {metrics.fillers > 3 && " Reduce filler words to sound more fluent."}
                </p>
              )}
              <div className="text-left bg-white/5 border border-white/10 rounded-lg p-4">
                <p className="text-sm text-averna-neon font-semibold mb-2">Examiner feedback ({result.wordCount} words):</p>
                <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
                  {result.feedback.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
              <Button onClick={reset} className="neon-button bg-averna-primary hover:bg-averna-light">
                <RotateCcw className="mr-2 h-4 w-4" /> Try another question
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
