"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { ClipboardCheck, Loader2, Copy, RotateCcw, CheckCircle2, AlertTriangle } from "lucide-react";

interface WritingIssue {
  text: string;
  type: string;
  suggestion: string;
}
interface Assessment {
  taskAchievement: number;
  coherenceCohesion: number;
  lexicalResource: number;
  grammarAccuracy: number;
  overallBand: number;
  aiDetectionScore: number;
  strengths: string[];
  recommendations: string[];
  detailedFeedback: string;
  issues?: WritingIssue[];
}

const CRITERIA: { key: keyof Assessment; label: string }[] = [
  { key: "taskAchievement", label: "Task Achievement" },
  { key: "coherenceCohesion", label: "Coherence & Cohesion" },
  { key: "lexicalResource", label: "Lexical Resource" },
  { key: "grammarAccuracy", label: "Grammar" },
];

function bandColor(b: number) {
  if (b >= 7) return "text-averna-neon";
  if (b >= 6) return "text-averna-cyan";
  if (b >= 5) return "text-amber-400";
  return "text-red-300";
}

/**
 * F3 — Smart Essay Review. The AI reads a student's essay first: criteria bands,
 * estimated overall band, strengths, issues and a draft of feedback the teacher
 * can edit and copy. Cuts marking time while keeping the teacher in control.
 * Reuses assessWritingTask (GPT-4o with a heuristic fallback).
 */
export function SmartEssayReview() {
  const [essay, setEssay] = useState("");
  const [prompt, setPrompt] = useState("");
  const [taskType, setTaskType] = useState<"task1" | "task2">("task2");
  const [loading, setLoading] = useState(false);
  const [a, setA] = useState<Assessment | null>(null);
  const [feedback, setFeedback] = useState("");

  const analyze = async () => {
    if (essay.trim().length < 20) {
      toast.error("Paste the student's essay first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/teacher/essay-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ essay, taskType, prompt: prompt.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const assessment = data as Assessment;
      setA(assessment);
      const draft = [
        assessment.detailedFeedback,
        assessment.recommendations.length ? `\n\nTo improve:\n- ${assessment.recommendations.join("\n- ")}` : "",
      ].join("");
      setFeedback(draft.trim());
    } catch (e: any) {
      toast.error(e.message || "Couldn't review the essay.");
    } finally {
      setLoading(false);
    }
  };

  const copyFeedback = async () => {
    try {
      await navigator.clipboard.writeText(feedback);
      toast.success("Feedback copied.");
    } catch {
      toast.error("Couldn't copy.");
    }
  };

  return (
    <Card className="glass border-averna-cyan/30">
      <CardHeader>
        <CardTitle className="flex items-start gap-2 text-white">
          <ClipboardCheck aria-hidden className="mt-1 h-5 w-5 shrink-0 text-study-ink" /><span className="min-w-0">Smart Essay Review</span>
        </CardTitle>
        <p className="text-sm text-gray-400">AI marks first — you approve, edit and add the human touch</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!a ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Task:</span>
              {(["task1", "task2"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTaskType(t)}
                  aria-pressed={taskType === t}
                  className={`min-h-11 px-3 py-2 rounded-full text-sm border transition ${
                    taskType === t ? "border-averna-cyan/60 bg-averna-cyan/20 text-averna-cyan" : "border-white/10 bg-white/5 text-gray-400 hover:text-white"
                  }`}
                >
                  {t === "task1" ? "Task 1" : "Task 2"}
                </button>
              ))}
            </div>
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Optional: the task prompt for sharper marking"
              aria-label="Task prompt (optional)"
              className="bg-background/50 text-base"
            />
            <textarea
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              aria-label="Student essay"
              placeholder="Paste the student's essay here…"
              rows={8}
              className="w-full rounded-lg bg-background/50 border border-white/10 px-3 py-2 text-base text-white placeholder:text-gray-500 focus:outline-none focus:border-averna-cyan/50 resize-y"
            />
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{essay.trim().split(/\s+/).filter(Boolean).length} words</span>
              <Button onClick={analyze} disabled={loading} className="neon-button bg-averna-cyan hover:bg-averna-cyan/80 text-black">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
                {loading ? "Marking…" : "Review essay"}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            {/* Overall + criteria */}
            <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
              <div className="text-center">
                <p className="text-sm text-gray-400">Estimated band</p>
                <p className={`text-4xl font-extrabold ${bandColor(a.overallBand)}`}>{a.overallBand.toFixed(1)}</p>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                {CRITERIA.map((c) => {
                  const v = a[c.key] as number;
                  return (
                    <div key={c.key} className="flex items-center gap-2">
                      <span className="w-24 sm:w-36 shrink-0 text-sm text-gray-300">{c.label}</span>
                      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-averna-cyan to-averna-neon" style={{ width: `${(v / 9) * 100}%` }} />
                      </div>
                      <span className={`w-8 text-right text-sm font-bold ${bandColor(v)}`}>{v.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {typeof a.aiDetectionScore === "number" && a.aiDetectionScore >= 60 && (
              <p className="text-sm text-gray-300 flex items-start gap-2">
                <AlertTriangle aria-hidden className="mt-1 h-4 w-4 shrink-0" /> This model flagged writing for discussion. It is not reliable proof of AI use; do not penalise a learner on this signal.
              </p>
            )}

            {a.strengths.length > 0 && (
              <div>
                <p className="text-sm uppercase tracking-wider text-averna-neon mb-1 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Strengths</p>
                <ul className="space-y-1">
                  {a.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-gray-300">• {s}</li>
                  ))}
                </ul>
              </div>
            )}

            {a.issues && a.issues.length > 0 && (
              <div>
                <p className="text-sm uppercase tracking-wider text-amber-300 mb-1">Issues to flag</p>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                  {a.issues.map((it, i) => (
                    <div key={i} className="text-sm rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5">
                      <span className="text-white font-medium">“{it.text}”</span> <span className="text-gray-400">— {it.suggestion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Editable feedback */}
            <div>
              <p className="text-sm uppercase tracking-wider text-averna-cyan mb-1">Feedback to student (edit before sending)</p>
              <textarea
                aria-label="Feedback to student"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={6}
                className="w-full rounded-lg bg-background/50 border border-white/10 px-3 py-2 text-base text-white focus:outline-none focus:border-averna-cyan/50 resize-y"
              />
            </div>

            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <Button onClick={copyFeedback} className="neon-button bg-averna-cyan hover:bg-averna-cyan/80 text-black">
                <Copy className="mr-1.5 h-4 w-4" /> Copy feedback
              </Button>
              <Button onClick={() => { setA(null); setFeedback(""); }} variant="outline" className="border-white/20">
                <RotateCcw className="mr-1.5 h-4 w-4" /> Review another
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
