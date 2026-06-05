"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Mic, Square, Copy, Check, ClipboardCheck } from "lucide-react";

interface Assessment {
  taskAchievement: number;
  coherenceCohesion: number;
  lexicalResource: number;
  grammarAccuracy: number;
  overallBand: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  detailedFeedback: string;
}
interface Issue {
  text: string;
  type: string;
  suggestion: string;
}

function bandColor(b: number): string {
  if (b >= 7) return "text-averna-neon";
  if (b >= 5.5) return "text-yellow-400";
  return "text-orange-400";
}

export function GradingAssistant() {
  const [text, setText] = useState("");
  const [taskType, setTaskType] = useState<"task1" | "task2">("task2");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);

  // Dictation (idea #12 — voice notes via speech-to-text)
  const [dictating, setDictating] = useState(false);
  const [srSupported, setSrSupported] = useState(true);
  const recRef = useRef<any>(null);
  const baseRef = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSrSupported(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e: any) => {
      let full = "";
      for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript + " ";
      setFeedback((baseRef.current + " " + full).trim());
    };
    rec.onerror = () => setDictating(false);
    rec.onend = () => setDictating(false);
    recRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {}
    };
  }, []);

  const analyze = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/teacher/grade-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, taskType }),
      });
      const data = await res.json();
      if (res.ok) {
        setAssessment(data.assessment);
        setIssues(data.issues ?? []);
        setFeedback(data.draft ?? "");
      } else {
        setError(data.error ?? "Could not analyse.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  };

  const toggleDictation = () => {
    if (!recRef.current) return;
    if (dictating) {
      try {
        recRef.current.stop();
      } catch {}
      setDictating(false);
    } else {
      baseRef.current = feedback;
      try {
        recRef.current.start();
      } catch {}
      setDictating(true);
    }
  };

  const copyFeedback = async () => {
    try {
      await navigator.clipboard.writeText(feedback);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const criteria = assessment
    ? [
        { label: "Task", value: assessment.taskAchievement },
        { label: "Coherence", value: assessment.coherenceCohesion },
        { label: "Lexical", value: assessment.lexicalResource },
        { label: "Grammar", value: assessment.grammarAccuracy },
      ]
    : [];

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Input */}
      <div className="space-y-3">
        <div className="flex gap-2">
          {(["task2", "task1"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTaskType(t)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                taskType === t
                  ? "bg-averna-purple/20 border-averna-purple text-averna-purple"
                  : "bg-white/5 border-white/10 text-gray-300"
              }`}
            >
              {t === "task2" ? "Task 2 (essay)" : "Task 1 (report)"}
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the student's writing here…"
          className="w-full h-[22rem] rounded-xl border border-white/10 bg-white/5 p-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-purple resize-none leading-relaxed"
        />
        <Button onClick={analyze} disabled={busy} className="neon-button bg-averna-primary hover:bg-averna-light w-full">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Analyse & suggest a grade
        </Button>
        {error && <p className="text-sm text-orange-300">{error}</p>}
      </div>

      {/* Output */}
      <div className="space-y-4">
        {!assessment ? (
          <Card className="glass border-white/10">
            <CardContent className="py-10 text-center text-gray-400 text-sm">
              <ClipboardCheck className="h-8 w-8 text-averna-purple mx-auto mb-2" />
              Paste a student&apos;s writing and click analyse. You&apos;ll get a suggested band, a criteria
              breakdown and an editable feedback draft — then refine it (you can even dictate).
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="glass border-averna-neon/30">
              <CardContent className="py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400">Suggested overall band</p>
                    <p className={`text-5xl font-bold ${bandColor(assessment.overallBand)}`}>
                      {assessment.overallBand.toFixed(1)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {criteria.map((c) => (
                      <div key={c.label} className="text-center px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                        <p className="text-[10px] text-gray-400">{c.label}</p>
                        <p className={`text-sm font-bold ${bandColor(c.value)}`}>{c.value.toFixed(1)}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 mt-3">
                  AI suggestion — always apply your own judgement before grading.
                </p>
              </CardContent>
            </Card>

            {issues.length > 0 && (
              <Card className="glass border-orange-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-orange-300">Flagged issues ({issues.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 text-sm">
                    {issues.map((iss, i) => (
                      <li key={i} className="text-gray-300">
                        <span className="text-[10px] uppercase text-orange-300 mr-1">{iss.type}</span>
                        {iss.suggestion}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Editable feedback with dictation */}
            <Card className="glass border-averna-cyan/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-averna-cyan flex items-center justify-between">
                  <span>Feedback to the student</span>
                  <span className="flex gap-1">
                    {srSupported && (
                      <Button onClick={toggleDictation} size="sm" variant="ghost" className={dictating ? "text-red-300" : "text-averna-cyan"}>
                        {dictating ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </Button>
                    )}
                    <Button onClick={copyFeedback} size="sm" variant="ghost" className="text-averna-neon">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full h-40 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-cyan resize-none"
                />
                {dictating && <p className="text-xs text-red-300 mt-1 animate-pulse">🎙️ Dictating… speak your feedback</p>}
                <p className="text-[11px] text-gray-500 mt-1">Edit freely, then copy into your grade.</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
