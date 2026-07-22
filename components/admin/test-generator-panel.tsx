"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Sparkles, Loader2, CheckCircle2, FileText } from "lucide-react";

type Module = "reading" | "listening" | "writing" | "speaking";

interface GeneratedPreview {
  title: string;
  description: string;
  passages?: { title: string; questions: unknown[] }[];
  sections?: { title: string; questions: unknown[] }[];
  // Writing Task 2 prompt fields
  prompt?: string;
  type?: string;
  sampleAnswer?: string;
  // Speaking practice-set fields
  topic?: string;
  part1?: { name: string; questions: unknown[] };
  part2?: { topic: string };
  part3?: unknown[];
}

export function TestGeneratorPanel() {
  const router = useRouter();
  const [module, setModule] = useState<Module>("reading");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("IELTS band 6.0-7.5");
  const isWriting = module === "writing";
  const isSpeaking = module === "speaking";
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Medium");
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<GeneratedPreview | null>(null);

  const partWord = module === "listening" ? "section" : "passage";

  const generate = async () => {
    if (!topic.trim()) {
      toast.error("Enter a topic first (e.g. 'Ocean exploration').");
      return;
    }
    setLoading(true);
    setPreview(null);
    try {
      const res = await fetch("/api/admin/generate-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          module === "listening"
            ? { module, topic: topic.trim(), difficulty, count }
            : module === "writing"
            ? { module, topic: topic.trim(), level }
            : module === "speaking"
            ? { module, topic: topic.trim() }
            : { module, topic: topic.trim(), level, count }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setPreview(data.test);
      toast.success("Draft generated — review below, then publish.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const publish = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/save-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, test: preview, topic, level: module === "listening" ? difficulty : level, publish: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success("Published! Students can now take this test.");
      setPreview(null);
      setTopic("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const parts = preview?.passages ?? preview?.sections ?? [];
  const questionCount = parts.reduce((n, p) => n + (p.questions?.length || 0), 0);

  return (
    <Card className="glass border-averna-purple/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-purple">
          <Sparkles className="h-5 w-5" />
          Generate a Test
        </CardTitle>
        <CardDescription>
          Creates a brand-new, original IELTS-style test. Review it, then publish so students can take it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400">Module</label>
            <select
              value={module}
              onChange={(e) => {
                const next = e.target.value as Module;
                setModule(next);
                setPreview(null);
                if (next === "writing") setLevel("");
                else if (!level) setLevel("IELTS band 6.0-7.5");
              }}
              className="w-full h-10 rounded-md bg-background/50 border border-input px-3 text-sm text-white"
            >
              <option value="reading">Reading</option>
              <option value="listening">Listening</option>
              <option value="writing">Writing (Task 2 essay)</option>
              <option value="speaking">Speaking (full set)</option>
            </select>
          </div>
          {!isWriting && !isSpeaking && (
            <div>
              <label className="text-xs text-gray-400">{module === "listening" ? "Sections" : "Passages"}</label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full h-10 rounded-md bg-background/50 border border-input px-3 text-sm text-white"
              >
                <option value={1}>1 {partWord} (fast)</option>
                <option value={2}>2 {partWord}s</option>
                <option value={3}>3 {partWord}s{module === "reading" ? " (full test)" : ""}</option>
                {module === "listening" && <option value={4}>4 sections (full test)</option>}
              </select>
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-400">Theme / topic</label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Ocean exploration, Urban planning…" className="bg-background/50" />
          </div>
          {!isSpeaking && (
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-400">{isWriting ? "Essay type (optional)" : "Difficulty"}</label>
            {module === "listening" ? (
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as "Easy" | "Medium" | "Hard")}
                className="w-full h-10 rounded-md bg-background/50 border border-input px-3 text-sm text-white"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            ) : (
              <Input
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder={isWriting ? "e.g. Opinion, Discussion, Problem & Solution" : ""}
                className="bg-background/50"
              />
            )}
          </div>
          )}
        </div>
        <p className="text-[11px] text-gray-500">
          {isWriting
            ? "Generates one original Task 2 essay prompt with a band 7.5–8 model answer, useful phrases and a strategy tip."
            : isSpeaking
            ? "Generates a full original Speaking set: a Part 1 topic, a Part 2 cue card and Part 3 discussion questions — each with model answers, useful phrases and tips."
            : `Tip: on the Hobby plan, generate 1 ${partWord} at a time to avoid function timeouts.`}
        </p>

        <Button onClick={generate} disabled={loading} className="neon-button bg-averna-purple hover:bg-averna-purple/80">
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate draft</>}
        </Button>

        {preview && (
          <div className="mt-2 rounded-xl bg-white/5 border border-white/10 p-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-averna-cyan shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">{preview.title}</p>
                {isSpeaking ? (
                  <>
                    {preview.topic && (
                      <span className="inline-block text-xs px-2 py-0.5 mt-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-400/40">
                        {preview.topic}
                      </span>
                    )}
                    <ul className="mt-2 space-y-0.5 text-xs text-gray-400">
                      <li className="truncate">• Part 1 · {preview.part1?.name} ({preview.part1?.questions?.length ?? 0} questions)</li>
                      <li className="truncate">• Part 2 · {preview.part2?.topic}</li>
                      <li className="truncate">• Part 3 · {preview.part3?.length ?? 0} discussion question{(preview.part3?.length ?? 0) === 1 ? "" : "s"}</li>
                    </ul>
                  </>
                ) : isWriting ? (
                  <>
                    {preview.type && (
                      <span className="inline-block text-xs px-2 py-0.5 mt-1 rounded-full bg-averna-purple/20 text-averna-purple border border-averna-purple/40">
                        {preview.type}
                      </span>
                    )}
                    <p className="text-sm text-gray-300 mt-2 whitespace-pre-line line-clamp-4">{preview.prompt}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Task 2 essay prompt · {preview.sampleAnswer ? `${preview.sampleAnswer.trim().split(/\s+/).length}-word model answer` : "model answer included"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-400">{preview.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {parts.length} {partWord}{parts.length === 1 ? "" : "s"} · {questionCount} questions
                    </p>
                    <ul className="mt-2 space-y-0.5">
                      {parts.map((p, i) => (
                        <li key={i} className="text-xs text-gray-400 truncate">• {p.title} ({p.questions?.length ?? 0} Q)</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={publish} disabled={saving} className="neon-button bg-averna-primary hover:bg-averna-light">
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing…</> : <><CheckCircle2 className="mr-2 h-4 w-4" /> Publish for students</>}
              </Button>
              <Button variant="outline" onClick={() => setPreview(null)} disabled={saving}>Discard</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
