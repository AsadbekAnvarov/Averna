"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Trophy, Users, BookOpen, Sparkles, Save, Clock, Target, ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

// Module-specific rubric hints. Keys correspond to Prisma enum values (upper-case).
const MODULE_GUIDE: Record<string, {
  targetWords?: number;
  criteria: { name: string; hint: string }[];
  tips: string[];
}> = {
  WRITING: {
    targetWords: 250,
    criteria: [
      { name: "Task Response", hint: "Address every part of the prompt with a clear position and relevant examples." },
      { name: "Coherence & Cohesion", hint: "Clear paragraphs with topic sentences and smooth linking words." },
      { name: "Lexical Resource", hint: "Paraphrase, use synonyms, avoid repeating the same words." },
      { name: "Grammar Range & Accuracy", hint: "Mix simple and complex sentences — small errors are fine at Band 7." },
    ],
    tips: [
      "Spend 3–5 minutes planning your paragraphs before you start writing.",
      "Aim for at least 250 words — going far under costs marks.",
      "Leave 3 minutes at the end to check spelling and small grammar slips.",
    ],
  },
  READING: {
    criteria: [
      { name: "Accuracy", hint: "Re-read the exact lines that support each answer." },
      { name: "Skimming & Scanning", hint: "Skim first for the gist, then scan for details." },
      { name: "Vocabulary in context", hint: "Guess unfamiliar words from the surrounding sentences." },
    ],
    tips: [
      "Read the questions before the passage — you'll know exactly what to look for.",
      "Answer the easier question types first, leave gap-fills for last.",
      "Never leave a blank — even a guess has a chance of being right.",
    ],
  },
  LISTENING: {
    criteria: [
      { name: "Prediction", hint: "Read the questions ahead and predict the type of missing answer (number, name, adjective)." },
      { name: "Signal words", hint: "Listen for 'however', 'but', 'finally' — they mark where answers appear." },
      { name: "Spelling", hint: "Common misspellings cost easy marks — double-check names and dates." },
    ],
    tips: [
      "You only hear the audio once — don't linger on a missed answer.",
      "Transfer answers exactly as heard; watch capitalisation.",
    ],
  },
  SPEAKING: {
    criteria: [
      { name: "Fluency & Coherence", hint: "Speak smoothly; use linking words to connect ideas." },
      { name: "Lexical Resource", hint: "Show vocabulary range with topic-specific words." },
      { name: "Grammar", hint: "Mix tenses and structures naturally." },
      { name: "Pronunciation", hint: "Clear stress patterns; don't rush." },
    ],
    tips: [
      "Use this box for your written script or bullet notes for practice.",
      "For Part 2 answers, follow the 4 bullet points of the cue card.",
      "Read your notes aloud at least twice to build fluency before recording.",
    ],
  },
};

function guideFor(mod?: string) {
  if (!mod) return null;
  return MODULE_GUIDE[mod.toUpperCase()] ?? null;
}

export default function HomeworkSubmissionForm({
  homework,
  studentId,
  submissionCount,
}: {
  homework: any;
  studentId: string;
  submissionCount: number;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const draftKey = `hw-draft-${homework.id}`;

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) setContent(saved);
    } catch {}
  }, [draftKey]);

  // Autosave draft on every change
  useEffect(() => {
    if (!content) return;
    try { localStorage.setItem(draftKey, content); } catch {}
  }, [content, draftKey]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const guide = guideFor(homework.module);
  const target = guide?.targetWords ?? null;
  const targetPct = target ? Math.min(100, (wordCount / target) * 100) : 0;

  const handleSubmit = async () => {
    if (!content.trim()) {
      setStatus({ type: "error", msg: "Please write your answer before submitting." });
      return;
    }
    setStatus(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/homework/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeworkId: homework.id, content }),
      });
      if (!res.ok) throw new Error("Submit failed");
      const data = await res.json();
      try { localStorage.removeItem(draftKey); } catch {}
      setStatus({ type: "success", msg: `✅ Submitted! You're #${data.position}. Points earned: ${data.points}` });
      setTimeout(() => router.push("/homework"), 1600);
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", msg: "Something went wrong. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const potentialBonus = submissionCount === 0 ? 10 : submissionCount === 1 ? 8 : submissionCount === 2 ? 6 : 0;

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/homework" className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Homework
        </Link>

        <Card className="glass border-purple-500/30 mb-6">
          <CardHeader>
            <CardTitle className="text-2xl">{homework.title}</CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">{homework.module}</span>
              <span className="text-gray-400">{'⭐'.repeat(homework.difficulty)}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-300 whitespace-pre-line">{homework.description}</p>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-gray-400">
                <Clock className="h-4 w-4" /> Due: {formatDate(homework.dueDate)}
              </span>
              <span className="flex items-center gap-1 text-averna-neon">
                <Trophy className="h-4 w-4" /> Base: {homework.points} pts
              </span>
            </div>

            {potentialBonus > 0 && (
              <div className="bg-averna-neon/10 border border-averna-neon/30 rounded-lg p-4">
                <p className="text-averna-neon font-semibold">
                  ⚡ Submit now for +{potentialBonus} bonus points!
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {submissionCount} submission{submissionCount !== 1 ? 's' : ''} so far
                </p>
              </div>
            )}

            {submissionCount >= 3 && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Users className="h-4 w-4" />
                {submissionCount} students have submitted
              </div>
            )}
          </CardContent>
        </Card>

        {guide && (
          <details className="mb-6 group">
            <summary className="cursor-pointer list-none">
              <Card className="glass border-averna-cyan/30 hover:border-averna-cyan/60 transition-colors">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-averna-cyan" />
                    <span className="text-white font-semibold">
                      How this is scored — {homework.module} rubric &amp; tips
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-averna-cyan group-open:rotate-90 transition-transform" />
                </CardContent>
              </Card>
            </summary>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <Card className="glass border-averna-cyan/30">
                <CardHeader>
                  <CardTitle className="text-averna-cyan flex items-center gap-2 text-base">
                    <Target className="h-4 w-4" /> Marking criteria
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {guide.criteria.map((c) => (
                    <div key={c.name}>
                      <p className="text-white font-semibold">{c.name}</p>
                      <p className="text-gray-400">{c.hint}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="glass border-averna-neon/30">
                <CardHeader>
                  <CardTitle className="text-averna-neon flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4" /> Quick tips
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                    {guide.tips.map((t) => <li key={t}>{t}</li>)}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </details>
        )}

        <Card className="glass border-averna-primary/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Your Answer</CardTitle>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Save className="h-3.5 w-3.5 text-averna-neon" /> Auto-saved
              </span>
              <span>
                <span className={target && wordCount >= target ? "text-averna-neon font-semibold" : "text-white"}>
                  {wordCount}
                </span>
                {target ? <span> / {target} words</span> : <span> words</span>}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {target && (
              <div className="h-1.5 w-full rounded-full bg-white/5 mb-3 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${wordCount >= target ? "bg-averna-neon" : "bg-averna-cyan"}`}
                  style={{ width: `${targetPct}%` }}
                />
              </div>
            )}
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your homework answer here..."
              className="min-h-[400px] bg-background/50"
              disabled={isSubmitting}
            />
            {status && (
              <div className={`mt-4 rounded-lg p-3 text-sm ${
                status.type === "success"
                  ? "bg-averna-neon/10 border border-averna-neon/30 text-averna-neon"
                  : "bg-red-500/10 border border-red-500/30 text-red-300"
              }`}>
                {status.msg}
              </div>
            )}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !content.trim()}
              className="w-full mt-4 neon-button bg-purple-500 hover:bg-purple-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit Homework
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
