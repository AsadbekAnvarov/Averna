"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PenTool, ArrowLeft, Sparkles, AlertTriangle, CheckCircle2, Link2, Repeat } from "lucide-react";
import { heuristicWritingAssessmentSafe } from "@/lib/utils";

const PROMPTS = [
  "Some people think university students should pay all the cost of their studies. To what extent do you agree or disagree?",
  "Many believe that technology has made our lives more complicated rather than simpler. Discuss both views and give your opinion.",
  "In some countries, people work long hours. What are the causes, and what effects does this have on individuals and society?",
  "Some argue that governments should invest more in public transport than in roads. Do you agree or disagree?",
];

const WEAK_WORDS: Record<string, string> = {
  "very": "extremely, remarkably, considerably",
  "really": "genuinely, truly, significantly",
  "good": "beneficial, effective, valuable",
  "bad": "detrimental, harmful, undesirable",
  "big": "significant, substantial, considerable",
  "a lot of": "numerous, a great deal of, considerable",
  "lots of": "numerous, a wide range of",
  "thing": "aspect, factor, element",
  "things": "aspects, factors, elements",
  "get": "obtain, receive, acquire",
  "nice": "pleasant, appealing, favourable",
  "stuff": "material, content, items",
};

const LINKERS = [
  "however", "moreover", "furthermore", "therefore", "consequently",
  "in addition", "nevertheless", "for instance", "for example",
  "on the other hand", "as a result", "in contrast", "overall",
  "firstly", "secondly", "finally", "in conclusion",
];

const CONTRACTIONS = ["don't", "can't", "won't", "it's", "i'm", "they're", "we're", "isn't", "aren't", "didn't", "doesn't", "you're", "that's"];

function bandColor(b: number): string {
  if (b >= 7) return "text-averna-neon";
  if (b >= 5.5) return "text-yellow-400";
  return "text-orange-400";
}

export default function WritingLabPage() {
  const [text, setText] = useState("");
  const [prompt, setPrompt] = useState(PROMPTS[0]);

  const analysis = useMemo(() => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.match(/\b[\w']+\b/g) ?? [] : [];
    const wordCount = words.length;
    const sentences = trimmed.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    const paragraphs = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const avgSentenceLen = sentences.length ? Math.round(wordCount / sentences.length) : 0;
    const band = trimmed.length > 20 ? heuristicWritingAssessmentSafe(trimmed) : 0;

    const lower = trimmed.toLowerCase();

    // Weak / informal words
    const weakFound: { word: string; suggestion: string }[] = [];
    for (const [w, sug] of Object.entries(WEAK_WORDS)) {
      const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(lower)) weakFound.push({ word: w, suggestion: sug });
    }

    // Repeated content words (length > 4, used >= 4 times)
    const freq: Record<string, number> = {};
    for (const w of words) {
      const lw = w.toLowerCase();
      if (lw.length > 4) freq[lw] = (freq[lw] ?? 0) + 1;
    }
    const repeated = Object.entries(freq)
      .filter(([, n]) => n >= 4)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    // Linking words used
    const linkersUsed = LINKERS.filter((l) => lower.includes(l));

    // Contractions (informal for academic writing)
    const contractionsFound = CONTRACTIONS.filter((c) => new RegExp(`\\b${c.replace("'", "['']?")}\\b`, "i").test(lower));

    // Overly long sentences
    const longSentences = sentences.filter((s) => (s.match(/\b[\w']+\b/g)?.length ?? 0) > 40).length;

    // Heuristic IELTS criteria estimates, anchored to the overall band
    const clamp = (n: number) => Math.max(4, Math.min(9, Math.round(n * 2) / 2));
    const b = band || 5;
    const has = trimmed.length > 20;
    const taskScore = has
      ? clamp(b + (wordCount >= 250 ? 0.5 : wordCount >= 150 ? 0 : -1) + (paragraphs.length >= 3 ? 0.5 : -0.5))
      : 0;
    const coherenceScore = has
      ? clamp(b + (linkersUsed.length >= 4 ? 0.5 : linkersUsed.length >= 2 ? 0 : -0.5) + (paragraphs.length >= 4 ? 0.5 : 0) - (longSentences > 0 ? 0.5 : 0))
      : 0;
    const lexicalScore = has ? clamp(b - weakFound.length * 0.25 - repeated.length * 0.25) : 0;
    const grammarScore = has
      ? clamp(b - (contractionsFound.length > 0 ? 0.5 : 0) - longSentences * 0.25 + (avgSentenceLen >= 12 && avgSentenceLen <= 22 ? 0.5 : 0))
      : 0;

    return {
      wordCount,
      sentenceCount: sentences.length,
      paragraphs: paragraphs.length,
      avgSentenceLen,
      band,
      weakFound,
      repeated,
      linkersUsed,
      contractionsFound,
      longSentences,
      taskScore,
      coherenceScore,
      lexicalScore,
      grammarScore,
    };
  }, [text]);

  const targetWords = 250;
  const wordPct = Math.min(100, Math.round((analysis.wordCount / targetWords) * 100));

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Link href="/learning/writing" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Writing
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <PenTool className="h-8 w-8 text-purple-400" />
          Writing <span className="neon-text-purple">Lab</span>
        </h1>
        <p className="text-gray-400 mb-6">
          A live coach for practice writing. Type and get instant suggestions — no grading, no pressure. ✍️
        </p>

        {/* Prompt picker */}
        <div className="mb-4">
          <label className="text-xs text-gray-400 mb-1 block">Practice prompt (optional)</label>
          <select
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-purple"
          >
            {PROMPTS.map((p, i) => (
              <option key={i} value={p} className="bg-averna-dark">
                {p.slice(0, 70)}…
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-300 mt-2 italic">&ldquo;{prompt}&rdquo;</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Editor */}
          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Start writing your essay here…"
              className="w-full h-[28rem] rounded-xl border border-white/10 bg-white/5 p-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-purple resize-none leading-relaxed"
            />
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{analysis.wordCount} words</span>
                <span>{analysis.wordCount >= targetWords ? "✓ target reached" : `target ${targetWords}`}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    analysis.wordCount >= targetWords ? "bg-averna-neon" : "bg-averna-purple"
                  }`}
                  style={{ width: `${wordPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Live feedback */}
          <div className="space-y-4">
            {/* Stat row */}
            <div className="grid grid-cols-4 gap-2">
              <Stat label="Band*" value={analysis.band ? analysis.band.toFixed(1) : "—"} color={analysis.band ? bandColor(analysis.band) : "text-gray-500"} />
              <Stat label="Sentences" value={String(analysis.sentenceCount)} color="text-averna-cyan" />
              <Stat label="Paragraphs" value={String(analysis.paragraphs)} color="text-averna-purple" />
              <Stat label="Avg len" value={String(analysis.avgSentenceLen)} color="text-averna-pink" />
            </div>

            {analysis.wordCount < 20 ? (
              <Card className="glass border-white/10">
                <CardContent className="py-8 text-center text-gray-400 text-sm">
                  <Sparkles className="h-8 w-8 text-averna-purple mx-auto mb-2" />
                  Start typing and suggestions will appear here in real time.
                </CardContent>
              </Card>
            ) : (
              <>
                {/* IELTS criteria breakdown */}
                <Card className="glass border-averna-purple/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-averna-purple">Estimated IELTS criteria*</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {[
                      { label: "Task Response", value: analysis.taskScore },
                      { label: "Coherence & Cohesion", value: analysis.coherenceScore },
                      { label: "Lexical Resource", value: analysis.lexicalScore },
                      { label: "Grammar & Accuracy", value: analysis.grammarScore },
                    ].map((c) => (
                      <div key={c.label} className="flex items-center gap-2">
                        <span className="w-40 text-xs text-gray-300 shrink-0">{c.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-averna-purple to-averna-neon"
                            style={{ width: `${(c.value / 9) * 100}%` }}
                          />
                        </div>
                        <span className={`w-8 text-right text-xs font-bold ${bandColor(c.value)}`}>
                          {c.value.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Linking words */}
                <SuggestionCard
                  icon={<Link2 className="h-4 w-4" />}
                  title="Linking words"
                  ok={analysis.linkersUsed.length >= 3}
                  okText={`Great cohesion — you used ${analysis.linkersUsed.length} linkers.`}
                >
                  {analysis.linkersUsed.length < 3 && (
                    <p className="text-sm text-gray-300">
                      Add more connectors to improve flow. Try:{" "}
                      <span className="text-averna-cyan">however, moreover, as a result, in contrast</span>.
                    </p>
                  )}
                  {analysis.linkersUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {analysis.linkersUsed.map((l) => (
                        <span key={l} className="text-[11px] px-2 py-0.5 rounded-full bg-averna-cyan/15 text-averna-cyan border border-averna-cyan/25">
                          {l}
                        </span>
                      ))}
                    </div>
                  )}
                </SuggestionCard>

                {/* Weak words */}
                {analysis.weakFound.length > 0 && (
                  <SuggestionCard icon={<AlertTriangle className="h-4 w-4" />} title="Upgrade weak words" warn>
                    <ul className="space-y-1.5 text-sm">
                      {analysis.weakFound.map((w) => (
                        <li key={w.word} className="text-gray-300">
                          <span className="text-orange-300 font-medium">&ldquo;{w.word}&rdquo;</span> →{" "}
                          <span className="text-averna-neon">{w.suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </SuggestionCard>
                )}

                {/* Repeated words */}
                {analysis.repeated.length > 0 && (
                  <SuggestionCard icon={<Repeat className="h-4 w-4" />} title="Repeated words" warn>
                    <p className="text-sm text-gray-300 mb-2">Vary these with synonyms:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.repeated.map(([w, n]) => (
                        <span key={w} className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/25">
                          {w} ×{n}
                        </span>
                      ))}
                    </div>
                  </SuggestionCard>
                )}

                {/* Contractions */}
                {analysis.contractionsFound.length > 0 && (
                  <SuggestionCard icon={<AlertTriangle className="h-4 w-4" />} title="Avoid contractions" warn>
                    <p className="text-sm text-gray-300">
                      Academic writing prefers full forms. Found:{" "}
                      <span className="text-orange-300">{analysis.contractionsFound.join(", ")}</span>{" "}
                      (e.g. write &ldquo;do not&rdquo; instead of &ldquo;don&apos;t&rdquo;).
                    </p>
                  </SuggestionCard>
                )}

                {/* Long sentences */}
                {analysis.longSentences > 0 && (
                  <SuggestionCard icon={<AlertTriangle className="h-4 w-4" />} title="Very long sentences" warn>
                    <p className="text-sm text-gray-300">
                      {analysis.longSentences} sentence{analysis.longSentences > 1 ? "s are" : " is"} over 40 words.
                      Consider splitting for clarity.
                    </p>
                  </SuggestionCard>
                )}

                {/* All good */}
                {analysis.weakFound.length === 0 &&
                  analysis.repeated.length === 0 &&
                  analysis.contractionsFound.length === 0 &&
                  analysis.longSentences === 0 &&
                  analysis.linkersUsed.length >= 3 && (
                    <Card className="glass border-averna-neon/30">
                      <CardContent className="py-4 flex items-center gap-2 text-averna-neon text-sm">
                        <CheckCircle2 className="h-5 w-5" /> Clean writing — strong vocabulary and cohesion. Keep going!
                      </CardContent>
                    </Card>
                  )}

                <p className="text-[11px] text-gray-500">
                  *Band is a rough, instant estimate based on length, vocabulary range and cohesion. For an
                  official AI assessment, submit a real{" "}
                  <Link href="/learning/writing" className="text-averna-cyan hover:underline">
                    Writing task
                  </Link>
                  .
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  );
}

function SuggestionCard({
  icon,
  title,
  children,
  warn,
  ok,
  okText,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  warn?: boolean;
  ok?: boolean;
  okText?: string;
}) {
  return (
    <Card className={`glass ${warn ? "border-orange-500/30" : ok ? "border-averna-neon/30" : "border-averna-cyan/30"}`}>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm flex items-center gap-2 ${warn ? "text-orange-300" : ok ? "text-averna-neon" : "text-averna-cyan"}`}>
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {ok && okText ? <p className="text-sm text-averna-neon">{okText}</p> : children}
      </CardContent>
    </Card>
  );
}
