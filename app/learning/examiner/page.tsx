"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Square, Volume2, RotateCcw, Trophy, Bot, Loader2 } from "lucide-react";
import { scoreSpeaking, type SpeakingScore } from "@/lib/utils";
import { Confetti } from "@/components/confetti";
import { EXAMINER_QUESTIONS } from "@/lib/examiner-questions";
import type { SessionOutcome } from "@/lib/engine/progression/service";
import { SessionOutcomeCard } from "@/components/progression/session-outcome";

function newAttemptId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}



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
  const [outcome, setOutcome] = useState<SessionOutcome | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [saveNote, setSaveNote] = useState("");
  const transcriptRef = useRef("");
  const secondsRef = useRef(0);
  const attemptIdRef = useRef<string>("");

  const recRef = useRef<any>(null);
  const startRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const question = EXAMINER_QUESTIONS[qIndex];
  const qIndexRef = useRef(qIndex);
  qIndexRef.current = qIndex;

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
      transcriptRef.current = full.trim();
    };
    rec.onerror = () => stop();
    recRef.current = rec;
    return () => { try { rec.abort(); } catch {}; if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Saved server-side: re-scored there, earns Speaking XP, and feeds progress,
  // missions and recommendations. The attempt id makes a retry idempotent.
  const save = useCallback(async (text: string, secs: number) => {
    setSaveState("saving");
    setSaveNote("");
    try {
      const res = await fetch("/api/learning/speaking/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: EXAMINER_QUESTIONS[qIndexRef.current], transcript: text, seconds: secs, submissionId: attemptIdRef.current }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "");
      setOutcome(data?.outcome ?? null);
      setSaveNote(data?.xpAwarded > 0 ? "" : data?.xpNotes?.[0] ?? "");
      setSaveState("saved");
    } catch (e) {
      setSaveState("failed");
      setSaveNote((e instanceof Error && e.message) || "Your answer wasn't saved. Check your connection and try again.");
    }
  }, []);

  const start = () => {
    attemptIdRef.current = newAttemptId();
    transcriptRef.current = "";
    setOutcome(null);
    setSaveState("idle");
    setSaveNote("");
    setTranscript("");
    setResult(null);
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
    secondsRef.current = secs;
    const t = transcriptRef.current.trim();
    if (t.length > 0) {
      setResult(scoreSpeaking(t, secs));
      void save(t, secs);
    }
  }, [save]);

  const reset = () => {
    setTranscript(""); setResult(null); setElapsed(0); setOutcome(null); setSaveState("idle"); setSaveNote("");
    setQIndex((i) => (i + 1) % EXAMINER_QUESTIONS.length);
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
        <p className="text-gray-400 mb-6">Answer out loud for up to 2 minutes. The examiner transcribes and scores your speech — answers of 30+ seconds earn Speaking XP.</p>

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
              <div className="text-left bg-white/5 border border-white/10 rounded-lg p-4">
                <p className="text-sm text-averna-neon font-semibold mb-2">Examiner feedback ({result.wordCount} words):</p>
                <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
                  {result.feedback.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
              {saveState === "saving" && <p className="text-sm text-gray-400" role="status">Saving your answer…</p>}
              {saveNote && (
                <p role={saveState === "failed" ? "alert" : undefined} className={`text-sm ${saveState === "failed" ? "text-red-300" : "text-gray-300"}`}>
                  {saveNote}
                </p>
              )}
              <div className="flex flex-wrap justify-center gap-3">
                {saveState === "failed" && (
                  <Button onClick={() => save(transcriptRef.current, secondsRef.current)} variant="outline" className="border-red-400/50 text-red-200">
                    Try Saving Again
                  </Button>
                )}
                <Button onClick={reset} className="neon-button bg-averna-primary hover:bg-averna-light">
                  <RotateCcw className="mr-2 h-4 w-4" /> Try Another Question
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {outcome && (
          <div className="mt-6">
            <SessionOutcomeCard outcome={outcome} />
          </div>
        )}
      </div>
    </div>
  );
}
