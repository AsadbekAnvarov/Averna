"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Sparkles, Loader2, CheckCircle2, XCircle, FileText, Layers, StopCircle } from "lucide-react";

/** Rotating "angles" so a batch on a single topic still yields varied tests. */
const BULK_ANGLES = [
  "history and origins",
  "modern developments",
  "economic impact",
  "environmental aspects",
  "social effects",
  "future trends",
  "regional differences",
  "key challenges",
  "notable examples",
  "everyday life",
  "technology and innovation",
  "education and learning",
  "health and wellbeing",
  "culture and traditions",
  "policy and regulation",
];

interface BulkLogEntry {
  topic: string;
  status: "ok" | "fail";
  title?: string;
  message?: string;
}

type Module = "reading" | "listening" | "writing" | "writing-task1" | "speaking";

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
  // Writing Task 1 chart data
  chart?: { kind: string }[];
}

export function TestGeneratorPanel() {
  const router = useRouter();
  const [module, setModule] = useState<Module>("reading");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("IELTS band 6.0-7.5");
  const isWriting = module === "writing";
  const isSpeaking = module === "speaking";
  const isTask1 = module === "writing-task1";
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Medium");
  const [chartType, setChartType] = useState<"auto" | "bar" | "line" | "pie">("auto");
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<GeneratedPreview | null>(null);

  // Bulk generation
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkThemes, setBulkThemes] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; ok: number; failed: number } | null>(null);
  const [bulkLog, setBulkLog] = useState<BulkLogEntry[]>([]);
  const cancelRef = useRef(false);

  const partWord = module === "listening" ? "section" : "passage";

  /** Build the /generate-test request body for a given topic, using the current module + params. */
  const buildGenerateBody = (topicStr: string) =>
    module === "listening"
      ? { module, topic: topicStr, difficulty, count }
      : module === "writing"
      ? { module, topic: topicStr, level }
      : module === "speaking"
      ? { module, topic: topicStr }
      : module === "writing-task1"
      ? { module, topic: topicStr, chartType }
      : { module, topic: topicStr, level, count };

  /** Build the /save-test request body for a generated test. */
  const buildSaveBody = (test: unknown, topicStr: string) => ({
    module,
    test,
    topic: topicStr,
    level: module === "listening" ? difficulty : level,
    publish: true,
  });

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
        body: JSON.stringify(buildGenerateBody(topic.trim())),
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
        body: JSON.stringify(buildSaveBody(preview, topic)),
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

  /** Resolve the list of topics for a batch: explicit themes (one per line) win;
   *  otherwise the single topic is repeated with a rotating angle for variety. */
  const resolveBulkTopics = (): string[] => {
    const themeLines = bulkThemes.split("\n").map((s) => s.trim()).filter(Boolean);
    if (themeLines.length > 0) return themeLines.slice(0, 50);
    const base = topic.trim();
    if (!base) return [];
    return Array.from({ length: bulkCount }, (_, i) =>
      bulkCount === 1 ? base : `${base}: ${BULK_ANGLES[i % BULK_ANGLES.length]}`
    );
  };

  const runBulk = async () => {
    const topics = resolveBulkTopics();
    if (topics.length === 0) {
      toast.error("Enter a topic, or a list of themes (one per line).");
      return;
    }
    cancelRef.current = false;
    setBulkRunning(true);
    setBulkLog([]);
    setBulkProgress({ done: 0, total: topics.length, ok: 0, failed: 0 });

    let ok = 0;
    let failed = 0;
    for (let i = 0; i < topics.length; i++) {
      if (cancelRef.current) break;
      const tp = topics[i];
      try {
        const gRes = await fetch("/api/admin/generate-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildGenerateBody(tp)),
        });
        const gData = await gRes.json();
        if (!gRes.ok) throw new Error(gData.error || "generation failed");

        const sRes = await fetch("/api/admin/save-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildSaveBody(gData.test, tp)),
        });
        const sData = await sRes.json();
        if (!sRes.ok) throw new Error(sData.error || "save failed");

        ok++;
        setBulkLog((l) => [{ topic: tp, status: "ok", title: gData.test?.title }, ...l]);
      } catch (e) {
        failed++;
        setBulkLog((l) => [{ topic: tp, status: "fail", message: e instanceof Error ? e.message : "error" }, ...l]);
      }
      setBulkProgress({ done: i + 1, total: topics.length, ok, failed });
      // Gentle pause between items to respect serverless limits & API rate limits.
      if (i < topics.length - 1 && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    setBulkRunning(false);
    router.refresh();
    if (cancelRef.current) toast.info(`Stopped. ${ok} published, ${failed} failed.`);
    else toast.success(`Bulk finished: ${ok} published${failed ? `, ${failed} failed` : ""}.`);
  };

  const cancelBulk = () => {
    cancelRef.current = true;
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
          Creates brand-new, original IELTS-style content. Review a single draft before publishing, or switch to Bulk to fill the bank with many at once.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Single vs Bulk mode */}
        <div className="inline-flex rounded-lg border border-white/10 p-0.5 bg-white/5">
          <button
            type="button"
            onClick={() => !bulkRunning && setBulkMode(false)}
            disabled={bulkRunning}
            className={`px-3 py-1.5 text-sm rounded-md transition ${!bulkMode ? "bg-averna-purple text-white" : "text-gray-400 hover:text-white"}`}
          >
            Single
          </button>
          <button
            type="button"
            onClick={() => !bulkRunning && setBulkMode(true)}
            disabled={bulkRunning}
            className={`px-3 py-1.5 text-sm rounded-md transition flex items-center gap-1.5 ${bulkMode ? "bg-averna-purple text-white" : "text-gray-400 hover:text-white"}`}
          >
            <Layers className="h-3.5 w-3.5" /> Bulk
          </button>
        </div>

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
              <option value="writing-task1">Writing Task 1 (chart)</option>
              <option value="speaking">Speaking (full set)</option>
            </select>
          </div>
          {isTask1 && (
            <div>
              <label className="text-xs text-gray-400">Chart type</label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as "auto" | "bar" | "line" | "pie")}
                className="w-full h-10 rounded-md bg-background/50 border border-input px-3 text-sm text-white"
              >
                <option value="auto">Auto (let AI choose)</option>
                <option value="bar">Bar chart</option>
                <option value="line">Line graph</option>
                <option value="pie">Pie chart</option>
              </select>
            </div>
          )}
          {!isWriting && !isSpeaking && !isTask1 && (
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
          {!isSpeaking && !isTask1 && (
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
        {!bulkMode && (
        <p className="text-[11px] text-gray-500">
          {isTask1
            ? "Generates one original Task 1 task with real chart data (rendered as an SVG bar/line/pie graph) plus a band 7.5–8 model answer, useful phrases and a strategy tip."
            : isWriting
            ? "Generates one original Task 2 essay prompt with a band 7.5–8 model answer, useful phrases and a strategy tip."
            : isSpeaking
            ? "Generates a full original Speaking set: a Part 1 topic, a Part 2 cue card and Part 3 discussion questions — each with model answers, useful phrases and tips."
            : `Tip: on the Hobby plan, generate 1 ${partWord} at a time to avoid function timeouts.`}
        </p>
        )}

        {!bulkMode && (
          <Button onClick={generate} disabled={loading} className="neon-button bg-averna-purple hover:bg-averna-purple/80">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate draft</>}
          </Button>
        )}

        {/* Bulk generation controls */}
        {bulkMode && (
          <div className="rounded-xl border border-averna-purple/30 bg-averna-purple/5 p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">How many (using the topic above)</label>
                <select
                  value={bulkCount}
                  onChange={(e) => setBulkCount(Number(e.target.value))}
                  disabled={bulkRunning || bulkThemes.trim().length > 0}
                  className="w-full h-10 rounded-md bg-background/50 border border-input px-3 text-sm text-white disabled:opacity-50"
                >
                  {[5, 10, 20, 30, 50].map((n) => (
                    <option key={n} value={n}>{n} items</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <p className="text-[11px] text-gray-500">
                  Each item reuses the module &amp; settings above. A rotating angle is added to the topic so the batch stays varied.
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400">…or paste specific themes (one per line — overrides the count, max 50)</label>
              <textarea
                value={bulkThemes}
                onChange={(e) => setBulkThemes(e.target.value)}
                disabled={bulkRunning}
                rows={4}
                placeholder={"Ocean exploration\nUrban planning\nRenewable energy\nSpace tourism"}
                className="w-full rounded-md bg-background/50 border border-input px-3 py-2 text-sm text-white disabled:opacity-50"
              />
            </div>

            {bulkProgress && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{bulkProgress.done} / {bulkProgress.total} processed</span>
                  <span>
                    <span className="text-averna-neon">{bulkProgress.ok} published</span>
                    {bulkProgress.failed > 0 && <span className="text-red-400"> · {bulkProgress.failed} failed</span>}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-averna-purple transition-all duration-300"
                    style={{ width: `${bulkProgress.total ? (bulkProgress.done / bulkProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {bulkRunning ? (
                <Button onClick={cancelBulk} variant="outline" className="border-red-500/50 text-red-300">
                  <StopCircle className="mr-2 h-4 w-4" /> Stop after current
                </Button>
              ) : (
                <Button onClick={runBulk} className="neon-button bg-averna-purple hover:bg-averna-purple/80">
                  <Layers className="mr-2 h-4 w-4" /> Generate &amp; publish
                </Button>
              )}
              {bulkRunning && (
                <span className="flex items-center gap-2 text-sm text-averna-purple">
                  <Loader2 className="h-4 w-4 animate-spin" /> Working… keep this tab open
                </span>
              )}
            </div>

            {bulkLog.length > 0 && (
              <ul className="mt-1 max-h-48 overflow-auto space-y-1 rounded-lg bg-black/20 p-2">
                {bulkLog.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    {e.status === "ok" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-averna-neon shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-gray-300">
                      {e.status === "ok" ? (e.title || e.topic) : `${e.topic} — ${e.message}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-[11px] text-gray-500">
              Tip: full Reading/Listening tests are slow — for large batches keep the count/sections small, or run overnight. Individual failures are skipped and logged; the rest keep going.
            </p>
          </div>
        )}

        {!bulkMode && preview && (
          <div className="mt-2 rounded-xl bg-white/5 border border-white/10 p-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-averna-cyan shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">{preview.title}</p>
                {isTask1 ? (
                  <>
                    <span className="inline-block text-xs px-2 py-0.5 mt-1 rounded-full bg-averna-cyan/20 text-averna-cyan border border-averna-cyan/40">
                      {preview.type}{preview.chart?.[0]?.kind ? ` · ${preview.chart[0].kind} chart` : ""}
                    </span>
                    <p className="text-sm text-gray-300 mt-2 whitespace-pre-line line-clamp-4">{preview.prompt}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Task 1 with auto-rendered chart · {preview.sampleAnswer ? `${preview.sampleAnswer.trim().split(/\s+/).length}-word model answer` : "model answer included"}
                    </p>
                  </>
                ) : isSpeaking ? (
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
