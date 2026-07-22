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

  const partWord = module === "listening" ? "boʻlim" : "matn";

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
      toast.error("Avval mavzu kiriting (masalan, 'Okean tadqiqoti').");
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
      if (!res.ok) throw new Error(data.error || "Yaratishda xatolik");
      setPreview(data.test);
      toast.success("Qoralama yaratildi — quyida koʻrib chiqing va eʼlon qiling.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yaratishda xatolik");
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
      if (!res.ok) throw new Error(data.error || "Saqlashda xatolik");
      toast.success("Eʼlon qilindi! Endi oʻquvchilar bu testni yechishi mumkin.");
      setPreview(null);
      setTopic("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Saqlashda xatolik");
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
      toast.error("Mavzu yoki mavzular roʻyxatini kiriting (har birini yangi qatordan).");
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
    if (cancelRef.current) toast.info(`Toʻxtatildi. ${ok} ta eʼlon qilindi, ${failed} ta xato.`);
    else toast.success(`Yakunlandi: ${ok} ta eʼlon qilindi${failed ? `, ${failed} ta xato` : ""}.`);
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
          Test yaratish
        </CardTitle>
        <CardDescription>
          Yangi, original IELTS uslubidagi kontent yaratadi. Bitta qoralamani koʻrib chiqib eʼlon qiling yoki bankni tez toʻldirish uchun &ldquo;Koʻp&rdquo; rejimiga oʻting.
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
            Bitta
          </button>
          <button
            type="button"
            onClick={() => !bulkRunning && setBulkMode(true)}
            disabled={bulkRunning}
            className={`px-3 py-1.5 text-sm rounded-md transition flex items-center gap-1.5 ${bulkMode ? "bg-averna-purple text-white" : "text-gray-400 hover:text-white"}`}
          >
            <Layers className="h-3.5 w-3.5" /> Koʻp
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400">Modul</label>
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
              <option value="writing">Writing (Task 2 esse)</option>
              <option value="writing-task1">Writing Task 1 (grafik)</option>
              <option value="speaking">Speaking (toʻliq toʻplam)</option>
            </select>
          </div>
          {isTask1 && (
            <div>
              <label className="text-xs text-gray-400">Grafik turi</label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as "auto" | "bar" | "line" | "pie")}
                className="w-full h-10 rounded-md bg-background/50 border border-input px-3 text-sm text-white"
              >
                <option value="auto">Avto (AI tanlaydi)</option>
                <option value="bar">Ustunli grafik</option>
                <option value="line">Chiziqli grafik</option>
                <option value="pie">Doiraviy diagramma</option>
              </select>
            </div>
          )}
          {!isWriting && !isSpeaking && !isTask1 && (
            <div>
              <label className="text-xs text-gray-400">{module === "listening" ? "Boʻlimlar" : "Matnlar"}</label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full h-10 rounded-md bg-background/50 border border-input px-3 text-sm text-white"
              >
                <option value={1}>1 {partWord} (tez)</option>
                <option value={2}>2 {partWord}</option>
                <option value={3}>3 {partWord}{module === "reading" ? " (toʻliq test)" : ""}</option>
                {module === "listening" && <option value={4}>4 boʻlim (toʻliq test)</option>}
              </select>
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-400">Mavzu</label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="masalan, Okean tadqiqoti, Shaharsozlik…" className="bg-background/50" />
          </div>
          {!isSpeaking && !isTask1 && (
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-400">{isWriting ? "Esse turi (ixtiyoriy)" : "Qiyinlik"}</label>
            {module === "listening" ? (
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as "Easy" | "Medium" | "Hard")}
                className="w-full h-10 rounded-md bg-background/50 border border-input px-3 text-sm text-white"
              >
                <option value="Easy">Oson</option>
                <option value="Medium">Oʻrta</option>
                <option value="Hard">Qiyin</option>
              </select>
            ) : (
              <Input
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder={isWriting ? "masalan, Opinion, Discussion, Problem & Solution" : ""}
                className="bg-background/50"
              />
            )}
          </div>
          )}
        </div>
        {!bulkMode && (
        <p className="text-[11px] text-gray-500">
          {isTask1
            ? "Bitta original Task 1 topshirigʻini haqiqiy grafik maʼlumotlari (SVG ustunli/chiziqli/doiraviy grafik) hamda band 7.5–8 namuna javob, foydali iboralar va strategiya bilan yaratadi."
            : isWriting
            ? "Bitta original Task 2 esse topshirigʻini band 7.5–8 namuna javob, foydali iboralar va strategiya bilan yaratadi."
            : isSpeaking
            ? "Toʻliq original Speaking toʻplamini yaratadi: Part 1 mavzusi, Part 2 kartochkasi va Part 3 muhokama savollari — har biri namuna javoblar, foydali iboralar va maslahatlar bilan."
            : `Maslahat: Hobby rejasida funksiya vaqti tugamasligi uchun bir vaqtda 1 ${partWord} yarating.`}
        </p>
        )}

        {!bulkMode && (
          <Button onClick={generate} disabled={loading} className="neon-button bg-averna-purple hover:bg-averna-purple/80">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Yaratilmoqda…</> : <><Sparkles className="mr-2 h-4 w-4" /> Qoralama yaratish</>}
          </Button>
        )}

        {/* Bulk generation controls */}
        {bulkMode && (
          <div className="rounded-xl border border-averna-purple/30 bg-averna-purple/5 p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Nechta (yuqoridagi mavzu boʻyicha)</label>
                <select
                  value={bulkCount}
                  onChange={(e) => setBulkCount(Number(e.target.value))}
                  disabled={bulkRunning || bulkThemes.trim().length > 0}
                  className="w-full h-10 rounded-md bg-background/50 border border-input px-3 text-sm text-white disabled:opacity-50"
                >
                  {[5, 10, 20, 30, 50].map((n) => (
                    <option key={n} value={n}>{n} ta</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <p className="text-[11px] text-gray-500">
                  Har bir element yuqoridagi modul va sozlamalardan foydalanadi. Xilma-xillik uchun mavzuga aylanuvchi jihat qoʻshiladi.
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400">…yoki aniq mavzularni joylashtiring (har biri yangi qatordan — sonni bekor qiladi, koʻpi 50)</label>
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
                  <span>{bulkProgress.done} / {bulkProgress.total} bajarildi</span>
                  <span>
                    <span className="text-averna-neon">{bulkProgress.ok} eʼlon qilindi</span>
                    {bulkProgress.failed > 0 && <span className="text-red-400"> · {bulkProgress.failed} xato</span>}
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
                  <StopCircle className="mr-2 h-4 w-4" /> Joriysidan keyin toʻxtatish
                </Button>
              ) : (
                <Button onClick={runBulk} className="neon-button bg-averna-purple hover:bg-averna-purple/80">
                  <Layers className="mr-2 h-4 w-4" /> Yaratish va eʼlon qilish
                </Button>
              )}
              {bulkRunning && (
                <span className="flex items-center gap-2 text-sm text-averna-purple">
                  <Loader2 className="h-4 w-4 animate-spin" /> Ishlayapti… bu oynani ochiq qoldiring
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
              Maslahat: toʻliq Reading/Listening testlari sekin — katta partiyalar uchun boʻlimlar sonini kichik tuting. Alohida xatolar oʻtkazib yuboriladi va qayd etiladi; qolganlari davom etadi.
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
                      Avto-grafikli Task 1 · {preview.sampleAnswer ? `${preview.sampleAnswer.trim().split(/\s+/).length} soʻzlik namuna javob` : "namuna javob mavjud"}
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
                      <li className="truncate">• Part 1 · {preview.part1?.name} ({preview.part1?.questions?.length ?? 0} ta savol)</li>
                      <li className="truncate">• Part 2 · {preview.part2?.topic}</li>
                      <li className="truncate">• Part 3 · {preview.part3?.length ?? 0} ta muhokama savoli</li>
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
                      Task 2 esse topshirigʻi · {preview.sampleAnswer ? `${preview.sampleAnswer.trim().split(/\s+/).length} soʻzlik namuna javob` : "namuna javob mavjud"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-400">{preview.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {parts.length} {partWord} · {questionCount} ta savol
                    </p>
                    <ul className="mt-2 space-y-0.5">
                      {parts.map((p, i) => (
                        <li key={i} className="text-xs text-gray-400 truncate">• {p.title} ({p.questions?.length ?? 0} savol)</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={publish} disabled={saving} className="neon-button bg-averna-primary hover:bg-averna-light">
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Eʼlon qilinmoqda…</> : <><CheckCircle2 className="mr-2 h-4 w-4" /> Oʻquvchilar uchun eʼlon qilish</>}
              </Button>
              <Button variant="outline" onClick={() => setPreview(null)} disabled={saving}>Bekor qilish</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
