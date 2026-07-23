"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ScanLine, Sparkles, Loader2, Lightbulb } from "lucide-react";

interface Issue {
  text: string;
  type: string;
  suggestion: string;
}
interface XrayResult {
  issues: Issue[];
  summary: string;
  topFixes: string[];
}

const TYPE_STYLE: Record<string, { chip: string; mark: string; label: string }> = {
  grammar: { chip: "bg-red-500/20 text-red-300 border-red-500/40", mark: "bg-red-500/20 border-b-2 border-red-400", label: "Grammar" },
  vocabulary: { chip: "bg-averna-purple/20 text-averna-purple border-averna-purple/40", mark: "bg-averna-purple/20 border-b-2 border-averna-purple", label: "Vocabulary" },
  spelling: { chip: "bg-amber-500/20 text-amber-400 border-amber-500/40", mark: "bg-amber-500/20 border-b-2 border-amber-400", label: "Spelling" },
  cohesion: { chip: "bg-averna-cyan/20 text-averna-cyan border-averna-cyan/40", mark: "bg-averna-cyan/20 border-b-2 border-averna-cyan", label: "Cohesion" },
  punctuation: { chip: "bg-averna-pink/20 text-averna-pink border-averna-pink/40", mark: "bg-averna-pink/20 border-b-2 border-averna-pink", label: "Punctuation" },
  style: { chip: "bg-blue-500/20 text-blue-300 border-blue-500/40", mark: "bg-blue-500/20 border-b-2 border-blue-400", label: "Style" },
  good: { chip: "bg-averna-neon/20 text-averna-neon border-averna-neon/40", mark: "bg-averna-neon/20 border-b-2 border-averna-neon", label: "Strong" },
};

function styleFor(type: string) {
  return TYPE_STYLE[type] ?? TYPE_STYLE.style;
}

interface Segment {
  text: string;
  type?: string;
  suggestion?: string;
}

/** Build non-overlapping highlighted segments by locating each issue's verbatim text. */
function buildSegments(essay: string, issues: Issue[]): Segment[] {
  const lower = essay.toLowerCase();
  const ranges: { start: number; end: number; type: string; suggestion: string }[] = [];

  for (const it of issues) {
    const t = (it.text || "").trim();
    if (!t) continue;
    let from = 0;
    while (from <= lower.length) {
      const idx = lower.indexOf(t.toLowerCase(), from);
      if (idx === -1) break;
      const end = idx + t.length;
      const overlaps = ranges.some((r) => idx < r.end && end > r.start);
      if (!overlaps) {
        ranges.push({ start: idx, end, type: it.type, suggestion: it.suggestion });
        break;
      }
      from = idx + 1;
    }
  }

  ranges.sort((a, b) => a.start - b.start);
  const segs: Segment[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start > cursor) segs.push({ text: essay.slice(cursor, r.start) });
    segs.push({ text: essay.slice(r.start, r.end), type: r.type, suggestion: r.suggestion });
    cursor = r.end;
  }
  if (cursor < essay.length) segs.push({ text: essay.slice(cursor) });
  return segs;
}

/**
 * Essay X-Ray — paste an essay and get an instant, examiner-style diagnosis with
 * the problems highlighted inline (hover for the fix), a summary of the biggest
 * band-limiters, and the highest-impact fixes. Powered by GPT-4o when a key is
 * configured, with a safe heuristic fallback so it always returns something.
 */
export function EssayXray() {
  const [essay, setEssay] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<XrayResult | null>(null);
  const [analyzedEssay, setAnalyzedEssay] = useState("");

  const wordCount = essay.trim().split(/\s+/).filter(Boolean).length;

  const segments = useMemo(
    () => (result ? buildSegments(analyzedEssay, result.issues) : []),
    [result, analyzedEssay],
  );

  const usedTypes = useMemo(() => {
    const s = new Set<string>();
    result?.issues.forEach((i) => s.add(i.type));
    return Array.from(s);
  }, [result]);

  const run = async () => {
    if (essay.trim().length < 20) {
      toast.error("Paste at least a few sentences to X-ray.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/learning/writing/xray", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ essay, prompt: prompt.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to analyze");
      setAnalyzedEssay(essay);
      setResult(data as XrayResult);
      if ((data.issues?.length ?? 0) === 0) toast.success("Clean scan — no obvious issues found! ✨");
    } catch (e: any) {
      toast.error(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass border-averna-cyan/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-cyan">
          <ScanLine className="h-5 w-5" /> Essay X-Ray
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result ? (
          <>
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Optional: paste the task prompt for sharper feedback"
              className="w-full rounded-lg bg-background/50 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-averna-cyan/50"
            />
            <textarea
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              placeholder="Paste your essay here and let the X-ray find what's holding your band back…"
              rows={8}
              className="w-full rounded-lg bg-background/50 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-averna-cyan/50 resize-y"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{wordCount} words</span>
              <Button onClick={run} disabled={loading} className="neon-button bg-averna-cyan hover:bg-averna-cyan/80 text-black">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
                {loading ? "Scanning…" : "X-Ray my essay"}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Summary */}
            {result.summary && (
              <div className="rounded-xl border border-averna-cyan/30 bg-averna-cyan/5 p-3">
                <p className="text-sm text-gray-200">{result.summary}</p>
              </div>
            )}

            {/* Legend */}
            {usedTypes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {usedTypes.map((t) => (
                  <span key={t} className={`text-[10px] px-2 py-0.5 rounded-full border ${styleFor(t).chip}`}>
                    {styleFor(t).label}
                  </span>
                ))}
              </div>
            )}

            {/* Highlighted essay */}
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 max-h-72 overflow-y-auto">
              <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                {segments.map((s, i) =>
                  s.type ? (
                    <span key={i} className={`rounded px-0.5 cursor-help ${styleFor(s.type).mark}`} title={s.suggestion}>
                      {s.text}
                    </span>
                  ) : (
                    <span key={i}>{s.text}</span>
                  ),
                )}
              </p>
            </div>

            {/* Top fixes */}
            {result.topFixes.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-averna-neon mb-1.5 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Highest-impact fixes
                </p>
                <ul className="space-y-1">
                  {result.topFixes.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-200">
                      <Lightbulb className="h-4 w-4 text-averna-neon shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Issue list */}
            {result.issues.length > 0 && (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {result.issues.map((it, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5">
                    <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border ${styleFor(it.type).chip}`}>
                      {styleFor(it.type).label}
                    </span>
                    <span className="min-w-0">
                      <span className="text-white font-medium">“{it.text}”</span>{" "}
                      <span className="text-gray-400">— {it.suggestion}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={() => {
                setResult(null);
              }}
              variant="outline"
              className="w-full border-white/20"
            >
              X-Ray another essay
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
