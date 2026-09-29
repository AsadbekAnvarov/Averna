"use client";

/**
 * Admin manager for pre-rendered Listening audio (/api/admin/listening-audio/*).
 *
 * The browser drives rendering: every request renders ONE part (≈ 20–50
 * text-to-speech calls) so it fits the serverless time limit. The queue runs
 * 1–2 parts at a time, can be paused, waits out AI limits (429 countdown, then
 * carries on by itself), retries a timed-out part once, and stops on setup
 * problems (no OpenAI key / Blob store). All state comes from the server list —
 * after a reload, "Hammasini yaratish" simply continues with what's missing.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Headphones,
  Info,
  Loader2,
  Lock,
  Pause,
  Play,
  RefreshCw,
  Search,
  Trash2,
  Wand2,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  DEFAULT_BYTES_PER_SECOND,
  FULL_TEST_MINUTES,
  HOBBY_BLOB_BYTES,
  TTS_USD_PER_MINUTE,
  type AudioErrorBody,
  type AudioOverview,
  type PartAudioInfo,
  type PartAudioStatus,
  type RenderOk,
  type TestAudioInfo,
} from "@/lib/ielts/audio/admin-types";

type SetState<T> = (value: T | ((prev: T) => T)) => void;
type State<T> = [T, SetState<T>];
type Box<T> = { current: T };
type Job = "queued" | "rendering";
type Filter = "all" | "todo" | "ready";
type Progress = { total: number; done: number; failed: number };

/** One render ≤ 60 s on the server; give the network some slack. */
const RENDER_TIMEOUT_MS = 100_000;
/** Consecutive network / server errors after which the queue stops itself. */
const MAX_ERROR_STREAK = 3;

const BTN_PRIMARY = "neon-button bg-averna-primary text-white hover:bg-averna-light";
const BTN_OUTLINE = "border border-white/15 bg-transparent text-gray-200 hover:bg-white/5 hover:text-white";
const BTN_GHOST = "bg-transparent text-gray-300 hover:bg-white/5 hover:text-white";
const BTN_DANGER = "bg-transparent text-gray-400 hover:bg-red-500/10 hover:text-red-300";
const FIELD =
  "h-9 rounded-lg border border-white/15 bg-white/[0.04] px-3 text-sm text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60";

const keyOf = (testId: string, index: number) => `${testId}#${index}`;
function splitKey(key: string): [string, number] {
  const at = key.lastIndexOf("#");
  return [key.slice(0, at), Number(key.slice(at + 1))];
}

const needsAudio = (p: PartAudioInfo) => p.status !== "ready";

/** The placement (entry) test's Listening is listed under its admin name. */
const PLACEMENT_TITLE = "Kirish testi · Listening";
const testTitle = (t: TestAudioInfo) => (t.placement ? PLACEMENT_TITLE : t.title);

function sizeText(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  const mb = bytes / 1024 ** 2;
  return `${mb >= 100 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
}

function clockText(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

function minutesText(seconds: number): string {
  const m = Math.max(1, Math.round(seconds / 60));
  return m >= 90 ? `${(m / 60).toFixed(1)} soat` : `${m} daqiqa`;
}

function usd(v: number): string {
  return `$${v < 10 ? v.toFixed(2) : v.toFixed(0)}`;
}

function whenText(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleString("en-GB", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

function errorText(body: unknown, status: number): string {
  const e = body && typeof body === "object" ? (body as { error?: unknown }).error : null;
  if (typeof e === "string" && e) return e;
  if (status === 0) return "Tarmoq xatosi — internet aloqasini tekshiring.";
  if (status === 401 || status === 403) return "Ruxsat yoʻq — admin sifatida qayta kiring.";
  return `Server xatosi (${status}).`;
}

const STATUS_UI: Record<PartAudioStatus | Job, { label: string; tone: string; hint?: string }> = {
  none: { label: "yoʻq", tone: "border-white/15 bg-white/[0.04] text-gray-300", hint: "Oʻquvchilar brauzer ovozini eshitadi." },
  ready: { label: "tayyor", tone: "border-averna-neon/40 bg-averna-neon/10 text-averna-neon", hint: "Oʻquvchilar shu yozuvni eshitadi." },
  stale: {
    label: "eskirgan",
    tone: "border-amber-400/40 bg-amber-400/10 text-amber-200",
    hint: "Skript yoki ovoz sozlamalari oʻzgargan — oʻquvchilar hozir brauzer ovozini eshitadi. Qayta yarating.",
  },
  failed: { label: "xato", tone: "border-red-400/40 bg-red-500/10 text-red-200", hint: "Oxirgi urinish muvaffaqiyatsiz — qayta urinib koʻring." },
  queued: { label: "navbatda", tone: "border-averna-cyan/40 bg-averna-cyan/10 text-averna-cyan" },
  rendering: { label: "yaratilmoqda…", tone: "border-averna-purple/40 bg-averna-purple/10 text-averna-purple" },
};

function StatusBadge({ status }: { status: PartAudioStatus | Job }) {
  const ui = STATUS_UI[status];
  return (
    <span
      title={ui.hint}
      className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", ui.tone)}
    >
      {status === "rendering" && <Loader2 className="h-3 w-3 motion-safe:animate-spin" aria-hidden />}
      {ui.label}
    </span>
  );
}

function pauseOtherPlayers(e: { currentTarget: HTMLAudioElement }) {
  document.querySelectorAll<HTMLAudioElement>("audio[data-la-player]").forEach((a) => {
    if (a !== e.currentTarget && !a.paused) a.pause();
  });
}

export function ListeningAudioManager({ initial }: { initial: AudioOverview | null }) {
  const [data, setData]: State<AudioOverview | null> = useState<AudioOverview | null>(initial);
  const [loading, setLoading]: State<boolean> = useState<boolean>(!initial);
  const [refreshing, setRefreshing]: State<boolean> = useState<boolean>(false);
  const [loadError, setLoadError]: State<string | null> = useState<string | null>(null);
  const [jobs, setJobs]: State<Record<string, Job>> = useState<Record<string, Job>>({});
  const [errors, setErrors]: State<Record<string, string>> = useState<Record<string, string>>({});
  const [running, setRunning]: State<boolean> = useState<boolean>(false);
  const [concurrency, setConcurrency]: State<number> = useState<number>(1);
  const [pausedUntil, setPausedUntil]: State<number> = useState<number>(0);
  const [clock, setClock]: State<number> = useState<number>(0);
  const [progress, setProgressState]: State<Progress> = useState<Progress>({ total: 0, done: 0, failed: 0 });
  const [queueError, setQueueError]: State<string | null> = useState<string | null>(null);
  const [deleting, setDeleting]: State<Record<string, boolean>> = useState<Record<string, boolean>>({});
  const [filter, setFilter]: State<Filter> = useState<Filter>("all");
  const [query, setQuery]: State<string> = useState<string>("");
  const [announcement, setAnnouncement]: State<string> = useState<string>("");

  const queueRef: Box<string[]> = useRef<string[]>([]);
  const activeRef: Box<Set<string>> = useRef<Set<string>>(new Set<string>());
  const runningRef: Box<boolean> = useRef<boolean>(false);
  const concurrencyRef: Box<number> = useRef<number>(1);
  const pausedUntilRef: Box<number> = useRef<number>(0);
  const streakRef: Box<number> = useRef<number>(0);
  const retriedRef: Box<Set<string>> = useRef<Set<string>>(new Set<string>());
  const mountedRef: Box<boolean> = useRef<boolean>(false);
  const progressRef: Box<Progress> = useRef<Progress>({ total: 0, done: 0, failed: 0 });
  const dataRef: Box<AudioOverview | null> = useRef<AudioOverview | null>(initial);
  dataRef.current = data;

  /** Progress lives in a ref (read synchronously by the queue) mirrored into state for rendering. */
  const setProgress = (next: (p: Progress) => Progress) => {
    progressRef.current = next(progressRef.current);
    setProgressState({ ...progressRef.current });
  };

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------

  const load = async (quiet = false): Promise<void> => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/admin/listening-audio", { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as AudioOverview | null;
      if (!res.ok || !body || !Array.isArray(body.tests)) throw new Error(errorText(body, res.status));
      if (!mountedRef.current) return;
      setData(body);
      setLoadError(null);
    } catch (e) {
      if (!mountedRef.current) return;
      setLoadError(e instanceof Error && e.message ? e.message : "Roʻyxatni yuklab boʻlmadi.");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    if (!initial) void load();
    return () => {
      mountedRef.current = false;
      runningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePart = (testId: string, part: PartAudioInfo) =>
    setData((d: AudioOverview | null) =>
      d
        ? {
            ...d,
            tests: d.tests.map((t) => (t.id !== testId ? t : { ...t, parts: t.parts.map((p) => (p.index === part.index ? part : p)) })),
          }
        : d
    );

  const setJob = (key: string, job: Job | null) =>
    setJobs((j: Record<string, Job>) => {
      const next = { ...j };
      if (job) next[key] = job;
      else delete next[key];
      return next;
    });

  const setError = (key: string, message: string | null) =>
    setErrors((m: Record<string, string>) => {
      const next = { ...m };
      if (message) next[key] = message;
      else delete next[key];
      return next;
    });

  // ---------------------------------------------------------------------------
  // Queue (mutable queue state lives in refs so in-flight requests never see stale values)
  // ---------------------------------------------------------------------------

  const titleOf = (key: string): string => {
    const [testId, index] = splitKey(key);
    const t = dataRef.current?.tests.find((x) => x.id === testId);
    return `${t ? testTitle(t) : testId} · ${t?.parts[index]?.title ?? `Part ${index + 1}`}`;
  };

  const stopQueue = (message: string | null) => {
    runningRef.current = false;
    setRunning(false);
    const dropped = queueRef.current.splice(0);
    if (dropped.length) setJobs((j: Record<string, Job>) => Object.fromEntries(Object.entries(j).filter(([k]) => !dropped.includes(k))));
    if (message) {
      setQueueError(message);
      setAnnouncement(`Navbat toʻxtatildi: ${message}`);
    }
  };

  const finishRun = () => {
    runningRef.current = false;
    setRunning(false);
    const p = progressRef.current;
    const text = `Navbat tugadi: ${p.done} ta qism yaratildi${p.failed ? `, ${p.failed} ta xato` : ""}.`;
    setAnnouncement(text);
    if (p.failed) toast.info(text);
    else if (p.done) toast.success(text);
    void load(true); // fresh totals
  };

  const renderOne = async (key: string): Promise<void> => {
    const [testId, partIndex] = splitKey(key);
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), RENDER_TIMEOUT_MS);
    let status = 0;
    let body: RenderOk | AudioErrorBody | null = null;
    try {
      const res = await fetch("/api/admin/listening-audio/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, partIndex }),
        signal: ctrl.signal,
      });
      status = res.status;
      body = (await res.json().catch(() => null)) as RenderOk | AudioErrorBody | null;
    } catch {
      status = 0;
    } finally {
      window.clearTimeout(timer);
    }
    if (!mountedRef.current) return;

    if (status === 200 && body && body.ok === true) {
      streakRef.current = 0;
      updatePart(testId, body.part);
      setJob(key, null);
      setError(key, null);
      setProgress((p) => ({ ...p, done: p.done + 1 }));
      setAnnouncement(`${titleOf(key)}: audio tayyor.`);
      return;
    }

    const err = body && body.ok !== true && typeof body.error === "string" ? body : null;
    if (err?.part) updatePart(testId, err.part);
    const code = err?.code;

    if (status === 429 || code === "rate_limit") {
      // AI limit: wait, then carry on with this part first.
      const wait = Math.max(5, Math.min(3600, Number(err?.retryAfterSec) || 60));
      pausedUntilRef.current = Date.now() + wait * 1000;
      setPausedUntil(pausedUntilRef.current);
      setClock(Date.now());
      queueRef.current.unshift(key);
      setJob(key, "queued");
      setAnnouncement(`AI limiti tugadi — ${clockText(wait * 1000)} dan keyin davom etadi.`);
      return;
    }

    const message = errorText(body, status);
    // One automatic retry for timeouts and transient failures (finished lines are cached on the server).
    const transient = status === 0 || code === "timeout" || code === "upstream" || code === "server" || (status >= 500 && !code);
    if (transient && !retriedRef.current.has(key) && runningRef.current) {
      retriedRef.current.add(key);
      queueRef.current.push(key);
      setJob(key, "queued");
      return;
    }

    setJob(key, null);
    setError(key, message);
    setProgress((p) => ({ ...p, failed: p.failed + 1 }));
    if (code === "config" || code === "storage") {
      stopQueue(message);
      return;
    }
    if (status === 0 || status >= 500) {
      streakRef.current += 1;
      if (streakRef.current >= MAX_ERROR_STREAK) stopQueue("Ketma-ket xatolar — navbat toʻxtatildi. Aloqani tekshirib, qayta boshlang.");
    } else {
      streakRef.current = 0;
    }
  };

  const pump = () => {
    if (!mountedRef.current) return;
    while (runningRef.current && activeRef.current.size < concurrencyRef.current && queueRef.current.length) {
      if (Date.now() < pausedUntilRef.current) return; // the countdown resumes it
      const key = queueRef.current.shift() as string;
      activeRef.current.add(key);
      setJob(key, "rendering");
      void renderOne(key).finally(() => {
        activeRef.current.delete(key);
        if (!mountedRef.current) return;
        if (!queueRef.current.length && !activeRef.current.size) {
          if (runningRef.current) finishRun();
        } else pump();
      });
    }
  };

  const enqueue = (keys: string[]): number => {
    const fresh = keys.filter((k) => !queueRef.current.includes(k) && !activeRef.current.has(k));
    if (!fresh.length) return 0;
    const idle = !runningRef.current && activeRef.current.size === 0;
    queueRef.current.push(...fresh);
    setJobs((j: Record<string, Job>) => {
      const next = { ...j };
      fresh.forEach((k) => {
        next[k] = "queued";
      });
      return next;
    });
    fresh.forEach((k) => setError(k, null));
    setProgress((p) => (idle ? { total: fresh.length, done: 0, failed: 0 } : { ...p, total: p.total + fresh.length }));
    return fresh.length;
  };

  const start = () => {
    if (!queueRef.current.length && !activeRef.current.size) return;
    if (!runningRef.current) {
      streakRef.current = 0;
      if (!activeRef.current.size) retriedRef.current = new Set<string>();
    }
    runningRef.current = true;
    setRunning(true);
    setQueueError(null);
    pump();
  };

  const pauseQueue = () => {
    runningRef.current = false;
    setRunning(false);
    setAnnouncement("Navbat toʻxtatildi. Boshlangan qismlar tugaydi.");
  };

  const clearQueue = () => {
    stopQueue(null);
    setPausedUntil(0);
    pausedUntilRef.current = 0;
    setAnnouncement("Navbat tozalandi.");
  };

  const changeConcurrency = (n: number) => {
    const v = n === 2 ? 2 : 1;
    concurrencyRef.current = v;
    setConcurrency(v);
    pump();
  };

  // 429 countdown: tick, then resume by itself.
  useEffect(() => {
    if (!pausedUntil) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      setClock(now);
      if (now >= pausedUntilRef.current) {
        pausedUntilRef.current = 0;
        setPausedUntil(0);
        pump();
      }
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pausedUntil]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const canRender = !!data?.blobConfigured && !!data?.openAiConfigured && !data?.dbError;

  const queueParts = (keys: string[]) => {
    if (!canRender) return;
    const n = enqueue(keys);
    if (n) {
      setAnnouncement(`${n} ta qism navbatga qoʻshildi.`);
      start();
    }
  };

  const renderAll = () => {
    const keys = (dataRef.current?.tests ?? []).flatMap((t) => t.parts.filter(needsAudio).map((p) => keyOf(t.id, p.index)));
    if (!keys.length) return;
    const secs = (dataRef.current?.tests ?? []).flatMap((t) => t.parts.filter(needsAudio)).reduce((s, p) => s + (p.durationMs ? p.durationMs / 1000 : p.estimatedSeconds), 0);
    const bps = totals.bytesPerSecond ?? DEFAULT_BYTES_PER_SECOND;
    const ok = window.confirm(
      `${keys.length} ta qism uchun audio yaratilsinmi?\n\nTaxminan ${minutesText(secs)} audio · ${sizeText(secs * bps)} · OpenAI narxi ≈ ${usd((secs / 60) * TTS_USD_PER_MINUTE)}.`
    );
    if (ok) queueParts(keys);
  };

  const removeParts = async (testId: string, partIndex: number | null, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    const busyKey = partIndex == null ? testId : keyOf(testId, partIndex);
    setDeleting((d: Record<string, boolean>) => ({ ...d, [busyKey]: true }));
    try {
      const res = await fetch("/api/admin/listening-audio/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partIndex == null ? { testId } : { testId, partIndex }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; filesKept?: number; error?: string } | null;
      if (!res.ok || !body?.ok) throw new Error(errorText(body, res.status));
      if (!mountedRef.current) return;
      setData((d: AudioOverview | null) => {
        if (!d) return d;
        const clear = (p: PartAudioInfo): PartAudioInfo =>
          partIndex == null || p.index === partIndex ? { ...p, status: "none", url: null, bytes: 0, durationMs: 0, error: null, updatedAt: null } : p;
        return {
          ...d,
          tests: d.tests.map((t) => (t.id === testId ? { ...t, parts: t.parts.map(clear) } : t)),
          orphans:
            partIndex == null
              ? d.orphans.filter((o) => o.testId !== testId)
              : d.orphans.map((o) => (o.testId === testId ? { ...o, parts: o.parts.filter((p) => p.index !== partIndex) } : o)),
        };
      });
      const kept = body.filesKept ?? 0;
      if (kept) toast.info(`Yozuvlar oʻchirildi, lekin ${kept} ta fayl Blob xotirasida qoldi (BLOB_READ_WRITE_TOKEN yoʻq).`);
      else toast.success("Audio oʻchirildi.");
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Oʻchirib boʻlmadi.");
    } finally {
      if (mountedRef.current) {
        setDeleting((d: Record<string, boolean>) => {
          const next = { ...d };
          delete next[busyKey];
          return next;
        });
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const totals = useMemo(() => {
    let bytes = 0;
    let files = 0;
    let ready = 0;
    let stale = 0;
    let failed = 0;
    let missing = 0;
    let readyMs = 0;
    let measuredBytes = 0;
    let measuredMs = 0;
    let todoSeconds = 0;
    for (const t of data?.tests ?? []) {
      for (const p of t.parts) {
        if (p.url) {
          bytes += p.bytes;
          files += 1;
          if (p.bytes > 0 && p.durationMs > 0) {
            measuredBytes += p.bytes;
            measuredMs += p.durationMs;
          }
        }
        if (p.status === "ready") {
          ready += 1;
          readyMs += p.durationMs;
          continue;
        }
        if (p.status === "stale") stale += 1;
        else if (p.status === "failed") failed += 1;
        else missing += 1;
        todoSeconds += p.durationMs ? p.durationMs / 1000 : p.estimatedSeconds;
      }
    }
    for (const o of data?.orphans ?? []) {
      bytes += o.bytes;
      files += o.parts.filter((p) => p.url).length;
    }
    const bytesPerSecond = measuredMs > 0 ? (measuredBytes * 1000) / measuredMs : data?.totals.bytesPerSecond ?? null;
    return { bytes, files, ready, stale, failed, missing, readyMs, todoSeconds, todoParts: stale + failed + missing, bytesPerSecond };
  }, [data]);

  const visible: TestAudioInfo[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.tests ?? []).filter((t) => {
      if (q && !testTitle(t).toLowerCase().includes(q) && !t.title.toLowerCase().includes(q) && !t.id.toLowerCase().includes(q)) return false;
      if (filter === "todo") return t.parts.some(needsAudio);
      if (filter === "ready") return t.parts.length > 0 && t.parts.every((p) => p.status === "ready");
      return true;
    });
  }, [data, filter, query]);

  const queued = Object.values(jobs).filter((j) => j === "queued").length;
  const rendering = Object.keys(jobs).filter((k) => jobs[k] === "rendering");
  const waitLeft = pausedUntil > 0 ? Math.max(0, pausedUntil - clock) : 0;
  const busyQueue = running || rendering.length > 0;
  const pct = progress.total ? Math.round(((progress.done + progress.failed) / progress.total) * 100) : 0;
  const bps = totals.bytesPerSecond ?? DEFAULT_BYTES_PER_SECOND;
  const fullTestBytes = FULL_TEST_MINUTES * 60 * bps;
  // Recorded Speaking answers share the store (and its 1 GB).
  const speaking = data?.speaking ?? null;
  const usedBytes = totals.bytes + (speaking?.bytes ?? 0);
  const usedPct = Math.min(100, (usedBytes / HOBBY_BLOB_BYTES) * 100);
  const fits = Math.max(0, Math.floor((HOBBY_BLOB_BYTES - usedBytes) / fullTestBytes));

  // ---------------------------------------------------------------------------

  if (loading && !data) {
    return (
      <Card className="glass border-white/10">
        <CardContent className="flex items-center gap-3 p-6 text-sm text-gray-300">
          <Loader2 className="h-5 w-5 text-averna-cyan motion-safe:animate-spin" aria-hidden />
          Listening testlari yuklanmoqda…
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <div role="alert" className="flex flex-wrap items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden />
        <p className="min-w-0 flex-1">{loadError ?? "Roʻyxatni yuklab boʻlmadi."}</p>
        <Button type="button" size="sm" onClick={() => void load()} className={BTN_OUTLINE}>
          <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
          Qayta yuklash
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {data.dbError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
          <Database className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-red-200">Maʼlumotlar bazasi tayyor emas</p>
            <p className="mt-1 text-sm text-red-100/80">{data.dbError}</p>
          </div>
        </div>
      )}

      {loadError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden />
          <p className="min-w-0 flex-1">{loadError}</p>
        </div>
      )}

      {data.audioOff && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4">
          <Pause className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-amber-200">Tayyor yozuvlar oʻquvchilarga eshittirilmayapti (LISTENING_AUDIO=off)</p>
            <p className="mt-1 text-sm text-amber-100/80">
              Amaliyotda, mock imtihonda va kirish testida barcha qismlar brauzer ovozida oʻqiladi. Yozuvlar oʻchirilmagan — ularni qayta
              yoqish uchun LISTENING_AUDIO oʻzgaruvchisini olib tashlang va loyihani qayta deploy qiling.
            </p>
          </div>
        </div>
      )}

      {/* ---------------- Setup ---------------- */}
      {(!data.blobConfigured || !data.openAiConfigured) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {!data.blobConfigured && (
            <SetupCard
              icon={<Database className="h-5 w-5" aria-hidden />}
              title="Vercel Blob ulanmagan"
              text="Audio fayllar Vercel Blob xotirasida saqlanadi va oʻquvchilarga CDN orqali eshittiriladi."
              steps={[
                "Vercel → loyihangiz → Storage → Create → Blob.",
                "Kirish turini Public qilib yarating va shu loyihaga ulang (Connect Project).",
                "BLOB_READ_WRITE_TOKEN muhit oʻzgaruvchisi avtomatik qoʻshiladi — loyihani qayta deploy qiling.",
              ]}
            />
          )}
          {!data.openAiConfigured && (
            <SetupCard
              icon={<Lock className="h-5 w-5" aria-hidden />}
              title="OPENAI_API_KEY sozlanmagan"
              text="Ovozlar OpenAI text-to-speech (gpt-4o-mini-tts) bilan yaratiladi."
              steps={[
                "Vercel → Settings → Environment Variables → OPENAI_API_KEY qoʻshing.",
                "Ixtiyoriy: OPENAI_TTS_MODEL (standart: gpt-4o-mini-tts).",
                "Loyihani qayta deploy qiling.",
              ]}
            />
          )}
          <p className="flex items-start gap-2 text-xs text-gray-400 md:col-span-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-averna-cyan" aria-hidden />
            Sozlanmaguncha oʻquvchilar avvalgidek brauzer ovozini eshitadi — hech narsa buzilmaydi. Mavjud yozuvlar eshittirilishda davom etadi.
          </p>
        </div>
      )}

      {/* ---------------- Overview + queue ---------------- */}
      <Card className="glass border-averna-cyan/30">
        <CardHeader className="space-y-2">
          <h2 className="flex items-center gap-2 text-xl font-semibold leading-tight text-averna-cyan">
            <Headphones className="h-5 w-5 shrink-0" aria-hidden />
            Tayyor audio yozuvlar
          </h2>
          <CardDescription className="text-gray-400">
            Har bir qism — bitta MP3: diktor eʼlonlari, 30 soniyalik oʻqish vaqti va pauzalar ichida; har bir spiker oʻz ovozida (Britaniya,
            Amerika yoki Avstraliya talaffuzi). Yozuv skriptga bogʻlangan: skript oʻzgarsa, u “eskirgan” boʻladi va oʻquvchilar qayta
            yaratilmaguncha brauzer ovozini eshitadi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Stat label="tayyor" value={totals.ready} tone="text-averna-neon" />
            <Stat label="eskirgan" value={totals.stale} tone="text-amber-200" />
            <Stat label="xato" value={totals.failed} tone="text-red-200" />
            <Stat label="yoʻq" value={totals.missing} tone="text-gray-200" />
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-gray-400">
              <span>
                Xotira: <span className="font-semibold tabular-nums text-white">{sizeText(usedBytes)}</span> / 1 GB (Vercel Hobby) ·
                Listening {sizeText(totals.bytes)} ({totals.files} ta fayl)
                {speaking ? ` · Speaking yozuvlari ${sizeText(speaking.bytes)} (${speaking.files} ta fayl)` : ""}
              </span>
              <span>Tayyor audio: {clockText(totals.readyMs)}</span>
            </div>
            <div
              role="progressbar"
              aria-label="Blob xotirasidan foydalanish"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(usedPct)}
              aria-valuetext={`${sizeText(usedBytes)} / 1 GB`}
              className="h-2 overflow-hidden rounded-full bg-white/10"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
                  usedPct > 95 ? "bg-red-400" : usedPct > 80 ? "bg-amber-400" : "bg-gradient-to-r from-averna-primary to-averna-cyan"
                )}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            {usedPct > 80 && (
              <p className="text-xs text-amber-200">
                Xotira deyarli toʻldi — keraksiz yozuvlarni oʻchiring yoki Vercel tarifini oshiring.
              </p>
            )}
            {speaking && (
              <p className="text-xs text-gray-400">
                Bu oy saqlangan Speaking javoblari:{" "}
                <span className="font-semibold tabular-nums text-white">{speaking.uploadsThisMonth}</span>
                {speaking.monthlyLimit > 0 ? ` / ${speaking.monthlyLimit}` : ""} (Hobby: oyiga 2 000 ta yuklash; chegaradan keyin javoblar
                matn sifatida saqlanadi, audio saqlanmaydi).
              </p>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-gray-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
            <p>
              Taxminiy hisob: toʻliq test ≈ {FULL_TEST_MINUTES} daqiqa audio ≈ {sizeText(fullTestBytes)}
              {totals.bytesPerSecond ? " (yaratilgan yozuvlar boʻyicha)" : ""} · OpenAI narxi ≈ {usd(FULL_TEST_MINUTES * TTS_USD_PER_MINUTE)} (
              {data.voiceModel} ≈ ${TTS_USD_PER_MINUTE} / daqiqa). Boʻsh joyga yana ≈ {fits} ta toʻliq test sigʻadi.
              {totals.todoParts > 0 && (
                <>
                  {" "}
                  Qolgan {totals.todoParts} ta qism: ≈ {minutesText(totals.todoSeconds)} · {sizeText(totals.todoSeconds * bps)} ·{" "}
                  {usd((totals.todoSeconds / 60) * TTS_USD_PER_MINUTE)}.
                </>
              )}
            </p>
          </div>

          {/* Queue */}
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Wand2 className="h-4 w-4 shrink-0 text-averna-purple" aria-hidden />
                <h3 className="text-sm font-semibold text-white">Yaratish navbati</h3>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    waitLeft > 0
                      ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                      : busyQueue
                        ? "border-averna-neon/40 bg-averna-neon/10 text-averna-neon"
                        : queued
                          ? "border-white/15 text-gray-300"
                          : "border-white/10 text-gray-500"
                  )}
                >
                  {waitLeft > 0 ? "AI limitini kutmoqda" : running ? "ishlamoqda" : rendering.length ? "toʻxtatilmoqda…" : queued ? "toʻxtatilgan" : "boʻsh"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="la-concurrency" className="text-xs text-gray-400">
                  Parallel soʻrovlar
                </label>
                <select
                  id="la-concurrency"
                  value={concurrency}
                  onChange={(e: { target: { value: string } }) => changeConcurrency(Number(e.target.value))}
                  className={cn(FIELD, "w-16 px-2")}
                >
                  {[1, 2].map((n) => (
                    <option key={n} value={n} className="bg-averna-dark">
                      {n}
                    </option>
                  ))}
                </select>
                {queued > 0 || running ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => (running ? pauseQueue() : start())}
                    disabled={!canRender && !running}
                    className={cn("min-w-[9rem]", running ? "border border-amber-400/40 bg-transparent text-amber-200 hover:bg-amber-400/10" : BTN_PRIMARY)}
                  >
                    {running ? <Pause className="mr-1.5 h-4 w-4" aria-hidden /> : <Play className="mr-1.5 h-4 w-4" aria-hidden />}
                    {running ? "Toʻxtatish" : "Davom ettirish"}
                  </Button>
                ) : (
                  <Button type="button" size="sm" onClick={renderAll} disabled={!canRender || totals.todoParts === 0} className={cn("min-w-[9rem]", BTN_PRIMARY)}>
                    <Wand2 className="mr-1.5 h-4 w-4" aria-hidden />
                    Hammasini yaratish
                  </Button>
                )}
                {queued > 0 && !running && (
                  <Button type="button" size="sm" onClick={clearQueue} className={BTN_GHOST}>
                    Navbatni tozalash
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void load(true)}
                  disabled={refreshing}
                  aria-label="Roʻyxatni yangilash"
                  title="Roʻyxatni yangilash"
                  className={cn(BTN_GHOST, "h-9 w-9 p-0")}
                >
                  <RefreshCw className={cn("h-4 w-4", refreshing && "motion-safe:animate-spin")} aria-hidden />
                </Button>
              </div>
            </div>

            {progress.total > 0 && (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-gray-400">
                  <span>
                    <span className="font-semibold tabular-nums text-white">{progress.done}</span> / {progress.total} qism tayyor
                    {progress.failed > 0 && <span className="text-red-300"> · {progress.failed} ta xato</span>}
                  </span>
                  {queued > 0 && <span>{queued} ta navbatda</span>}
                </div>
                <div
                  role="progressbar"
                  aria-label="Navbat jarayoni"
                  aria-valuemin={0}
                  aria-valuemax={progress.total}
                  aria-valuenow={progress.done + progress.failed}
                  className="h-2 overflow-hidden rounded-full bg-white/10"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-averna-purple to-averna-cyan transition-[width] duration-500 motion-reduce:transition-none"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}

            {waitLeft > 0 && (
              <p role="status" className="flex items-center gap-2 text-xs text-amber-200">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                AI limiti tugadi — {clockText(waitLeft)} dan keyin avtomatik davom etadi.
              </p>
            )}
            {rendering.length > 0 && (
              <ul className="space-y-1 text-xs text-gray-300">
                {rendering.map((k) => (
                  <li key={k} className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 shrink-0 text-averna-purple motion-safe:animate-spin" aria-hidden />
                    {titleOf(k)} — yaratilmoqda (≈ 20–50 soniya)
                  </li>
                ))}
              </ul>
            )}
            {queueError && (
              <p role="alert" className="flex items-start gap-2 text-xs text-red-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-300" aria-hidden />
                {queueError}
              </p>
            )}
            {!canRender && (
              <p className="text-xs text-gray-500">Yaratish uchun Vercel Blob va OPENAI_API_KEY sozlangan boʻlishi kerak.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Filters ---------------- */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e: { target: { value: string } }) => setQuery(e.target.value)}
            placeholder="Test nomi boʻyicha qidirish"
            aria-label="Test nomi boʻyicha qidirish"
            className={cn(FIELD, "w-full pl-9")}
          />
        </div>
        <div role="radiogroup" aria-label="Filtr" className="flex overflow-hidden rounded-lg border border-white/15">
          {(
            [
              ["all", "Hammasi"],
              ["todo", "Audio kerak"],
              ["ready", "Tayyor"],
            ] as [Filter, string][]
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "h-9 px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-averna-neon/60 motion-reduce:transition-none",
                filter === f ? "bg-averna-neon/15 text-averna-neon" : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ---------------- Tests ---------------- */}
      {visible.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-gray-400">
          {data.tests.length ? "Filtrga mos test yoʻq." : "Katalogda Listening testlari yoʻq."}
        </p>
      ) : (
        <ul className="space-y-4">
          {visible.map((t) => {
            const todo = t.parts.filter(needsAudio);
            const readyCount = t.parts.length - todo.length;
            const bytes = t.parts.reduce((n, p) => n + (p.url ? p.bytes : 0), 0);
            const ms = t.parts.reduce((n, p) => n + (p.status === "ready" ? p.durationMs : 0), 0);
            const hasFiles = t.parts.some((p) => p.url || p.status === "failed");
            const queuedHere = todo.some((p) => jobs[keyOf(t.id, p.index)]);
            const title = testTitle(t);
            return (
              <li key={t.id}>
                <Card className={cn("glass", t.placement ? "border-averna-purple/30" : "border-white/10")}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white">{title}</h3>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
                          {t.placement ? (
                            <span className="rounded-full border border-averna-purple/40 bg-averna-purple/10 px-2 py-0.5 text-[10px] font-semibold text-averna-purple">
                              Kirish testi
                            </span>
                          ) : (
                            <span>{t.source === "averna" ? "Averna" : "AI yaratgan"}</span>
                          )}
                          <span aria-hidden>·</span>
                          <span>{t.difficulty}</span>
                          {t.full && (
                            <span className="rounded-full border border-averna-cyan/40 bg-averna-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-averna-cyan">
                              Toʻliq test
                            </span>
                          )}
                          <span aria-hidden>·</span>
                          <span className={readyCount === t.parts.length ? "text-averna-neon" : undefined}>
                            {readyCount}/{t.parts.length} qism tayyor
                          </span>
                          {bytes > 0 && (
                            <>
                              <span aria-hidden>·</span>
                              <span className="tabular-nums">
                                {sizeText(bytes)}
                                {ms > 0 ? ` · ${clockText(ms)}` : ""}
                              </span>
                            </>
                          )}
                        </p>
                        {t.placement && (
                          <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-gray-400">
                            Kirish testida oʻquvchilar shu yozuvni eshitadi. Yozuv tayyor boʻlsa, javoblar yozilgan skript brauzerga yuborilmaydi.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => queueParts(todo.map((p) => keyOf(t.id, p.index)))}
                          disabled={!canRender || todo.length === 0 || queuedHere}
                          className={todo.length ? BTN_PRIMARY : BTN_OUTLINE}
                        >
                          {todo.length === 0 ? <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden /> : <Wand2 className="mr-1.5 h-4 w-4" aria-hidden />}
                          {todo.length === 0 ? "Hammasi tayyor" : "Audio yaratish"}
                        </Button>
                        {hasFiles && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              void removeParts(t.id, null, `“${title}” testining barcha audiolari oʻchirilsinmi?\n\nOʻquvchilar bu testda yana brauzer ovozini eshitadi.`)
                            }
                            disabled={!!deleting[t.id] || t.parts.some((p) => jobs[keyOf(t.id, p.index)] === "rendering")}
                            className={BTN_DANGER}
                          >
                            {deleting[t.id] ? (
                              <Loader2 className="mr-1.5 h-4 w-4 motion-safe:animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                            )}
                            Oʻchirish
                          </Button>
                        )}
                      </div>
                    </div>

                    <ul className="mt-3 divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.02]">
                      {t.parts.map((p) => {
                        const k = keyOf(t.id, p.index);
                        const job = jobs[k];
                        const err = errors[k] ?? (p.status !== "none" ? p.error : null);
                        const again = p.status === "ready" || p.status === "stale";
                        return (
                          <li key={k} className="px-3 py-2.5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="w-14 shrink-0 text-sm font-semibold text-white">{p.title}</span>
                                <StatusBadge status={job ?? p.status} />
                                <span className="text-xs tabular-nums text-gray-400">
                                  {p.durationMs > 0 ? clockText(p.durationMs) : `≈ ${clockText(p.estimatedSeconds * 1000)}`}
                                  {p.bytes > 0 ? ` · ${sizeText(p.bytes)}` : ""}
                                  {p.updatedAt && p.url ? ` · ${whenText(p.updatedAt)}` : ""}
                                </span>
                              </div>
                              {p.url && (
                                <audio
                                  controls
                                  preload="none"
                                  src={p.url}
                                  data-la-player=""
                                  onPlay={pauseOtherPlayers}
                                  aria-label={`${title}, ${p.title}: yozuvni tinglash`}
                                  className="h-9 w-full min-w-0 sm:w-60"
                                />
                              )}
                              <div className="flex shrink-0 items-center gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => {
                                    // A current recording costs money to redo — ask first.
                                    if (p.status === "ready" && !window.confirm(`“${title}” — ${p.title} tayyor. Qayta yaratilsinmi?`)) return;
                                    queueParts([k]);
                                  }}
                                  disabled={!canRender || !!job}
                                  aria-label={`${title}, ${p.title}: ${again ? "qayta yaratish" : "audio yaratish"}`}
                                  className={cn("h-9", p.status === "stale" ? BTN_PRIMARY : BTN_OUTLINE)}
                                >
                                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                  {again ? "Qayta yaratish" : "Yaratish"}
                                </Button>
                                {(p.url || p.status === "failed") && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() =>
                                      void removeParts(t.id, p.index, `“${title}” — ${p.title} audiosi oʻchirilsinmi?\n\nOʻquvchilar bu qismda yana brauzer ovozini eshitadi.`)
                                    }
                                    disabled={!!deleting[k] || !!deleting[t.id] || job === "rendering"}
                                    aria-label={`${title}, ${p.title}: audioni oʻchirish`}
                                    title="Oʻchirish"
                                    className={cn(BTN_DANGER, "h-9 w-9 p-0")}
                                  >
                                    {deleting[k] ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
                                  </Button>
                                )}
                              </div>
                            </div>
                            {err && !job && (
                              <p className={cn("mt-1.5 text-xs", p.status === "ready" ? "text-amber-200/80" : "text-red-200")}>
                                {p.status === "ready" || p.status === "stale" ? "Oxirgi qayta yaratish muvaffaqiyatsiz (eski yozuv saqlandi): " : ""}
                                {err}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* ---------------- Orphans ---------------- */}
      {data.orphans.length > 0 && (
        <Card className="glass border-amber-400/30">
          <CardHeader className="space-y-1">
            <h2 className="flex items-center gap-2 text-base font-semibold text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              Katalogda yoʻq testlar audiosi
            </h2>
            <CardDescription className="text-gray-400">
              Bu yozuvlar katalogdan olib tashlangan (yoki nashrdan olingan) testlarga tegishli va xotirada joy egallaydi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-white/5 rounded-xl border border-white/10">
              {data.orphans.map((o) => (
                <li key={o.testId} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate font-mono text-xs text-gray-300">{o.testId}</span>
                  <span className="text-xs text-gray-400">
                    {o.parts.length} ta qism · {sizeText(o.bytes)}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void removeParts(o.testId, null, `“${o.testId}” audiolari oʻchirilsinmi?`)}
                    disabled={!!deleting[o.testId]}
                    className={BTN_DANGER}
                  >
                    {deleting[o.testId] ? (
                      <Loader2 className="mr-1.5 h-4 w-4 motion-safe:animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                    )}
                    Oʻchirish
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className={cn("text-2xl font-bold tabular-nums", tone)}>{value}</p>
      <p className="text-xs text-gray-400">qism {label}</p>
    </div>
  );
}

function SetupCard({ icon, title, text, steps }: { icon: React.ReactNode; title: string; text: string; steps: string[] }) {
  return (
    <div role="status" className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4">
      <p className="flex items-center gap-2 font-semibold text-amber-200">
        <span className="text-amber-300">{icon}</span>
        {title}
      </p>
      <p className="mt-1 text-sm text-amber-100/80">{text}</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-amber-50/80">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </div>
  );
}

export default ListeningAudioManager;
