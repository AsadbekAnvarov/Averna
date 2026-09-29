"use client";

/**
 * Admin bulk generator for the exam library (/api/admin/exam-gen/*).
 *
 * The browser drives generation: every /step request generates ONE step of
 * one draft (a Reading passage, a Listening part, or a whole Writing task /
 * Speaking set), so each request fits the serverless time limit. All queue
 * state is derived from the server's draft list — after a reload, loading
 * the drafts is enough to continue.
 */

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Eye,
  FileText,
  Gauge,
  Headphones,
  Info,
  Layers,
  Loader2,
  Mic,
  Pause,
  PenLine,
  Play,
  RefreshCw,
  RotateCcw,
  ScrollText,
  ShieldAlert,
  Target,
  Timer,
  Trash2,
  Upload,
  Wand2,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { AVERNA_TZ, cn } from "@/lib/utils";
import {
  STEPS_FOR,
  type DraftStatus,
  type DraftSummary,
  type GenDifficulty,
  type GenSkill,
} from "@/lib/ielts/generation-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Tests per skill the library should reach. */
const TARGET = 70;
const MAX_PLAN = 100;
const PAGE_SIZE = 50;
/** Idle re-fetch while unfinished drafts exist (another tab/admin may be generating them). */
const IDLE_REFRESH_MS = 15_000;
/** "Another request is generating this draft" — its lock lasts up to ~70 s. */
const BUSY_COOLDOWN_MS = 30_000;
/** Pause before the queue retries a draft whose step just failed (1st, 2nd, 3rd … failure). */
const RETRY_DELAYS_MS = [3_000, 10_000, 30_000, 60_000];
/** Network errors / 5xx: the draft waits this long, the whole queue backs off a little. */
const TRANSIENT_COOLDOWN_MS = 30_000;
/** Consecutive transport / server errors after which the queue stops itself. */
const MAX_ERROR_STREAK = 6;
/** One step is ≤ 60 s on the server; give the network some slack. */
const STEP_TIMEOUT_MS = 100_000;

const JSON_HEADERS = { "Content-Type": "application/json" };
const NO_OPENAI = "OPENAI_API_KEY sozlanmagan — generatsiya oʻchirilgan.";
const UNEXPECTED = "Serverdan kutilmagan javob keldi.";

type DifficultyChoice = GenDifficulty | "mixed";
type FilterKey = DraftStatus | "all";
type Obj = Record<string, unknown>;
/** Explicit hook result types (same shapes as React's MutableRefObject / useState tuple). */
type Box<T> = { current: T };
type State<T> = [T, (next: T | ((prev: T) => T)) => void];

interface SkillMeta {
  id: GenSkill;
  label: string;
  icon: LucideIcon;
  /** How one test is generated (shown under the skill title). */
  howItWorks: string;
}

const SKILLS: SkillMeta[] = [
  { id: "READING", label: "Reading", icon: BookOpen, howItWorks: "3 bosqich: har bir soʻrovda bitta matn va uning savollari (jami 40 savol)." },
  { id: "LISTENING", label: "Listening", icon: Headphones, howItWorks: "4 bosqich: har bir soʻrovda bitta qism — ssenariy va 10 ta savol (jami 40 savol)." },
  { id: "WRITING_TASK1", label: "Writing Task 1", icon: BarChart3, howItWorks: "1 bosqich: grafik maʼlumotlari, namuna javob va foydali iboralar." },
  { id: "WRITING_TASK2", label: "Writing Task 2", icon: PenLine, howItWorks: "1 bosqich: esse topshirigʻi, namuna javob va foydali iboralar." },
  { id: "SPEAKING", label: "Speaking", icon: Mic, howItWorks: "1 bosqich: Part 1 mavzulari, Part 2 kartochkasi va Part 3 savollari." },
];
const SKILL_IDS: GenSkill[] = SKILLS.map((s) => s.id);
const skillMeta = (id: GenSkill): SkillMeta => SKILLS.find((s) => s.id === id) ?? SKILLS[0];

const STATUSES: DraftStatus[] = ["queued", "generating", "ready", "failed", "published"];
const STATUS_META: Record<DraftStatus, { label: string; chip: string }> = {
  queued: { label: "navbatda", chip: "border-white/15 bg-white/5 text-gray-300" },
  generating: { label: "yaratilmoqda", chip: "border-averna-purple/40 bg-averna-purple/10 text-averna-purple" },
  ready: { label: "tayyor", chip: "border-averna-cyan/40 bg-averna-cyan/10 text-averna-cyan" },
  failed: { label: "xato", chip: "border-red-500/40 bg-red-500/10 text-red-300" },
  published: { label: "nashr qilingan", chip: "border-averna-neon/40 bg-averna-neon/10 text-averna-neon" },
};
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: "queued", label: "Navbatda" },
  { key: "generating", label: "Yaratilmoqda" },
  { key: "ready", label: "Tayyor" },
  { key: "failed", label: "Xato" },
  { key: "published", label: "Nashr qilingan" },
];
const DIFFICULTY_LABEL: Record<GenDifficulty, string> = { Easy: "Oson", Medium: "Oʻrtacha", Hard: "Qiyin" };
const DIFFICULTY_OPTIONS: { value: DifficultyChoice; label: string }[] = [
  { value: "Easy", label: "Oson" },
  { value: "Medium", label: "Oʻrtacha" },
  { value: "Hard", label: "Qiyin" },
  { value: "mixed", label: "Aralash" },
];

/** Shared control styles (keyboard focus stays clearly visible). */
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-cyan/70 focus-visible:ring-offset-0";
const FIELD =
  "h-10 rounded-md border border-input bg-background/50 px-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50 " + FOCUS_RING;
const CHIP_BUTTON =
  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 " +
  FOCUS_RING;

// ---------------------------------------------------------------------------
// Small helpers (pure)
// ---------------------------------------------------------------------------

const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const asText = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const asNum = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const clampInt = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, Math.round(n)));
const isSkill = (v: unknown): v is GenSkill => typeof v === "string" && (SKILL_IDS as string[]).includes(v);
const isStatus = (v: unknown): v is DraftStatus => typeof v === "string" && (STATUSES as string[]).includes(v);
const isDifficulty = (v: unknown): v is GenDifficulty => v === "Easy" || v === "Medium" || v === "Hard";
/** Still has steps to generate (the queue works on these). */
const isPending = (r: DraftSummary | undefined): boolean => !!r && (r.status === "queued" || r.status === "generating");
const byNewest = (a: DraftSummary, b: DraftSummary): number => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);

/** A DraftSummary from untrusted JSON, or null when the shape is unusable. */
function parseDraft(v: unknown): DraftSummary | null {
  if (!isObj(v) || typeof v.id !== "string" || !v.id || !isSkill(v.skill) || !isStatus(v.status)) return null;
  const steps = Math.max(1, Math.round(asNum(v.steps, STEPS_FOR[v.skill])));
  const draft: DraftSummary = {
    id: v.id,
    skill: v.skill,
    title: asText(v.title) || "Nomsiz test",
    topic: asText(v.topic),
    difficulty: isDifficulty(v.difficulty) ? v.difficulty : "Medium",
    status: v.status,
    stepsDone: clampInt(asNum(v.stepsDone, 0), 0, steps),
    steps,
    questions: Math.max(0, Math.round(asNum(v.questions, 0))),
    warnings: Array.isArray(v.warnings) ? v.warnings.filter((w): w is string => typeof w === "string") : [],
    failures: Math.max(0, Math.round(asNum(v.failures, 0))),
    createdAt: asText(v.createdAt),
  };
  const lastError = asText(v.lastError);
  if (lastError) draft.lastError = lastError;
  return draft;
}

const parseDrafts = (v: unknown): DraftSummary[] =>
  Array.isArray(v) ? v.map(parseDraft).filter((d): d is DraftSummary => d !== null) : [];

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** "45 s", "3 daq 20 s", "1 soat 5 daq". */
function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m < 60) return rest ? `${m} daq ${rest} s` : `${m} daq`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h} soat ${mm} daq` : `${h} soat`;
}

/** Countdown clock: "04:09" or "1:02:03". */
function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.ceil(totalSec));
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

const UZ_MONTHS = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];
let createdFormatter: Intl.DateTimeFormat | null = null;
let currentYear = "";

/** "27-sen, 14:05" in Tashkent time (year added when it is not the current one). */
function formatCreated(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "—";
  try {
    if (!createdFormatter) {
      createdFormatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: AVERNA_TZ,
        day: "numeric",
        month: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      });
      currentYear = createdFormatter.formatToParts(new Date()).find((p) => p.type === "year")?.value ?? "";
    }
    const parts = createdFormatter.formatToParts(d);
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const month = UZ_MONTHS[Number(part("month")) - 1] ?? part("month");
    const year = part("year");
    return `${part("day")}-${month}${year && year !== currentYear ? ` ${year}` : ""}, ${part("hour")}:${part("minute")}`;
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

/** Resolves after `ms`, or immediately when `signal` aborts (never rejects). */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, Math.max(0, ms));
    signal.addEventListener("abort", done);
  });
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

/** Thrown when the component unmounted (or the request was cancelled on purpose) — never shown. */
class Cancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "Cancelled";
  }
}

/** A request that failed with a readable (Uzbek) message. */
class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const isCancelled = (e: unknown): boolean => e instanceof Error && e.name === "Cancelled";
const errorText = (e: unknown, fallback: string): string => (e instanceof Error && e.message ? e.message : fallback);

interface JsonResult {
  status: number;
  ok: boolean;
  body: unknown;
}

/**
 * fetch + JSON with a timeout; aborts when `parent` aborts (unmount). Network
 * failures become ApiError(0) with an Uzbek message; HTTP errors are returned
 * (not thrown) so callers can react to 401 / 403 / 429 themselves.
 */
async function requestJson(url: string, init: RequestInit, parent: AbortSignal, timeoutMs: number): Promise<JsonResult> {
  if (parent.aborted) throw new Cancelled();
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  parent.addEventListener("abort", onAbort);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctl.abort();
  }, timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal, cache: "no-store", credentials: "same-origin" });
    const raw = await res.text();
    let body: unknown = null;
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = null;
      }
    }
    return { status: res.status, ok: res.ok, body };
  } catch {
    if (parent.aborted) throw new Cancelled();
    if (timedOut) throw new ApiError(0, "Server juda uzoq javob bermadi — birozdan soʻng yana urinib koʻring.");
    throw new ApiError(0, "Server bilan bogʻlanib boʻlmadi — internet aloqasini tekshiring.");
  } finally {
    clearTimeout(timer);
    parent.removeEventListener("abort", onAbort);
  }
}

type Action = "load" | "plan" | "step" | "publish" | "delete" | "preview";

const ACTION_FAILED: Record<Action, string> = {
  load: "Roʻyxatni yuklab boʻlmadi",
  plan: "Rejalashtirib boʻlmadi",
  step: "Qadam bajarilmadi",
  publish: "Nashr holatini oʻzgartirib boʻlmadi",
  delete: "Oʻchirib boʻlmadi",
  preview: "Testni ochib boʻlmadi",
};

const serverError = (body: unknown): string => (isObj(body) && typeof body.error === "string" ? body.error.trim() : "");
const retryAfterOf = (body: unknown): number => {
  const v = isObj(body) ? Number(body.retryAfterSec) : NaN;
  return Number.isFinite(v) && v > 0 ? Math.ceil(v) : 60;
};
/**
 * OpenAI configuration problems (missing / rejected key, unknown model) — every further step would fail the
 * same way. Messages about one draft ("This draft failed 3 times (…)") may quote model errors, so they never count.
 */
const isConfigError = (msg: string): boolean =>
  !/^(this (draft|test|row)|draft not found)/i.test(msg) &&
  /not configured|OPENAI_API_KEY|OPENAI_EXAM_MODEL|rejected the (api key|request)/i.test(msg);
/** The key is missing altogether (as opposed to set but rejected). */
const isMissingKey = (msg: string): boolean => /not configured/i.test(msg);

/** Readable Uzbek message for an HTTP error (the server's English detail is appended when useful). */
function httpError(status: number, body: unknown, action: Action): string {
  const detail = serverError(body);
  if (status === 401) return "Sessiya muddati tugagan — sahifani yangilab, qayta tizimga kiring.";
  if (status === 403) {
    return action === "publish" || action === "delete"
      ? "Nashr qilish va oʻchirish faqat administratorlar uchun."
      : "Bu boʻlim uchun oʻqituvchi yoki administrator huquqi kerak.";
  }
  if (status === 429) return `AI limiti tugadi — ${formatDuration(retryAfterOf(body))} kuting va qayta urinib koʻring.`;
  if (status === 400 && isConfigError(detail)) return isMissingKey(detail) ? NO_OPENAI : `OpenAI sozlamasida muammo: ${detail}`;
  if (status === 404) return action === "preview" ? "Test topilmadi — u oʻchirilgan boʻlishi mumkin." : `${ACTION_FAILED[action]}: maʼlumot topilmadi.`;
  if (status >= 500) return `Serverda xatolik yuz berdi${detail ? `: ${detail}` : " — birozdan soʻng yana urinib koʻring."}`;
  return detail ? `${ACTION_FAILED[action]}: ${detail}` : `${ACTION_FAILED[action]} (HTTP ${status}).`;
}

async function loadSkill(skill: GenSkill, signal: AbortSignal): Promise<{ drafts: DraftSummary[]; openAiConfigured: boolean }> {
  const r = await requestJson(`/api/admin/exam-gen/drafts?skill=${skill}`, { method: "GET" }, signal, 30_000);
  if (!r.ok) throw new ApiError(r.status, httpError(r.status, r.body, "load"));
  if (!isObj(r.body) || !Array.isArray(r.body.drafts)) throw new ApiError(r.status, UNEXPECTED);
  return { drafts: parseDrafts(r.body.drafts), openAiConfigured: r.body.openAiConfigured === true };
}

// ---------------------------------------------------------------------------
// Derived statistics
// ---------------------------------------------------------------------------

interface SkillStats {
  queued: number;
  generating: number;
  ready: number;
  failed: number;
  published: number;
  total: number;
  /** Steps still to generate for queued / generating drafts. */
  remainingSteps: number;
}

const emptyStats = (): SkillStats => ({ queued: 0, generating: 0, ready: 0, failed: 0, published: 0, total: 0, remainingSteps: 0 });

function computeStats(rows: DraftSummary[]): Record<GenSkill, SkillStats> {
  const out: Record<GenSkill, SkillStats> = {
    READING: emptyStats(),
    LISTENING: emptyStats(),
    WRITING_TASK1: emptyStats(),
    WRITING_TASK2: emptyStats(),
    SPEAKING: emptyStats(),
  };
  for (const r of rows) {
    const s = out[r.skill];
    s.total += 1;
    s[r.status] += 1;
    if (isPending(r)) s.remainingSteps += Math.max(0, r.steps - r.stepsDone);
  }
  return out;
}

/** How many new drafts bring the skill to TARGET (published + ready + in progress). */
const fillToTarget = (s: SkillStats): number =>
  Math.min(MAX_PLAN, Math.max(0, TARGET - s.published - s.ready - s.queued - s.generating));

type StepKind = "ok" | "step-error" | "busy" | "rate-limited" | "stopped" | "gone" | "skipped" | "transient" | "cancelled";
interface StepResult {
  kind: StepKind;
  message?: string;
}

type BusyAction = "publish" | "unpublish" | "delete" | "publish-all";

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function StatusChip({ status, active, retrying }: { status: DraftStatus; active?: boolean; retrying?: boolean }) {
  // While a request is running the row is "yaratilmoqda" even if the server still says "navbatda".
  const shown: DraftStatus = active ? "generating" : retrying ? "queued" : status;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium",
        STATUS_META[shown].chip
      )}
    >
      {active && <Loader2 className="h-3 w-3 motion-safe:animate-spin" aria-hidden />}
      {retrying && !active && <RotateCcw className="h-3 w-3" aria-hidden />}
      {retrying && !active ? "qayta navbatda" : STATUS_META[shown].label}
    </span>
  );
}

const isErrorWarning = (w: string): boolean => /^error:/i.test(w.trim());

function WarningList({ id, warnings }: { id: string; warnings: string[] }) {
  return (
    <ul id={id} className="space-y-1 text-xs">
      {warnings.map((w, i) => (
        <li key={i} className={cn("flex gap-2", isErrorWarning(w) ? "text-red-300" : "text-amber-100/90")}>
          {isErrorWarning(w) ? (
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
          )}
          <span className="min-w-0 break-words">{w}</span>
        </li>
      ))}
    </ul>
  );
}

function StepsMeter({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular-nums text-gray-200">
        {done}/{total}
      </span>
      <span className="hidden h-1 w-10 overflow-hidden rounded-full bg-white/10 sm:inline-block" aria-hidden>
        <span className="block h-full rounded-full bg-averna-purple transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal: role=dialog + aria-modal, labelled, focus moves in
 * ([data-autofocus] or the panel), Tab stays inside, Esc / backdrop close,
 * and focus returns to the opener (or `fallbackFocus`) when it closes.
 */
function Modal({
  labelledBy,
  describedBy,
  onClose,
  children,
  className,
  fallbackFocus,
}: {
  labelledBy: string;
  describedBy?: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  fallbackFocus?: Box<HTMLElement | null>;
}) {
  const panelRef: Box<HTMLDivElement | null> = useRef<HTMLDivElement | null>(null);
  const onCloseRef: Box<() => void> = useRef(onClose);
  onCloseRef.current = onClose;
  const fallbackRef: Box<Box<HTMLElement | null> | undefined> = useRef(fallbackFocus);
  fallbackRef.current = fallbackFocus;

  useEffect(() => {
    const panel = panelRef.current;
    const active = document.activeElement;
    const opener = active instanceof HTMLElement && active !== document.body ? active : null;
    const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel;
    first?.focus({ preventScroll: true });
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
      if (!items.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === firstItem || current === panel || !panel.contains(current))) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && (current === lastItem || !panel.contains(current))) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.overflow = previousOverflow;
      const target = opener && opener.isConnected && !opener.matches(":disabled") ? opener : fallbackRef.current?.current ?? null;
      target?.focus({ preventScroll: true });
    };
  }, []);

  if (typeof document === "undefined") return null;
  // Portalled to <body> so no transformed / blurred ancestor can trap the fixed overlay.
  return createPortal(
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center bg-black/70 p-2 sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={cn(
          "glass-strong relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl outline-none animate-fade-in",
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Preview dialog
// ---------------------------------------------------------------------------

interface PreviewState {
  loading: boolean;
  error: string | null;
  data: { draft: DraftSummary | null; test: unknown } | null;
}

function PreviewDialog({
  id,
  row,
  canManage,
  busy,
  onPublish,
  onClose,
  fallbackFocus,
}: {
  id: string;
  row: DraftSummary | undefined;
  canManage: boolean;
  busy: boolean;
  onPublish: (id: string, publish: boolean) => void;
  onClose: () => void;
  fallbackFocus?: Box<HTMLElement | null>;
}) {
  const baseId: string = useId();
  const titleId = `${baseId}-title`;
  const [state, setState]: State<PreviewState> = useState<PreviewState>({ loading: true, error: null, data: null });
  const [showJson, setShowJson]: State<boolean> = useState(false);
  const [attempt, setAttempt]: State<number> = useState(0);

  useEffect(() => {
    const ctl = new AbortController();
    setState({ loading: true, error: null, data: null });
    requestJson(`/api/admin/exam-gen/preview?id=${encodeURIComponent(id)}`, { method: "GET" }, ctl.signal, 30_000)
      .then((r) => {
        if (ctl.signal.aborted) return;
        if (!r.ok) throw new ApiError(r.status, httpError(r.status, r.body, "preview"));
        if (!isObj(r.body) || !("test" in r.body)) throw new ApiError(r.status, UNEXPECTED);
        setState({ loading: false, error: null, data: { draft: parseDraft(r.body.draft), test: r.body.test } });
      })
      .catch((err: unknown) => {
        if (ctl.signal.aborted || isCancelled(err)) return;
        setState({ loading: false, error: errorText(err, `${ACTION_FAILED.preview}.`), data: null });
      });
    return () => ctl.abort();
  }, [id, attempt]);

  const summary = row ?? state.data?.draft ?? null;
  const title = summary?.title ?? "Test";
  const test = state.data?.test;
  // Built eagerly (plain functions, not components) so any surprise in the data is caught → raw JSON instead.
  const body: React.ReactNode | null = useMemo(
    () => (state.data ? renderPreviewBody(summary, test, baseId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.data, summary, baseId]
  );

  return (
    <Modal labelledBy={titleId} onClose={onClose} className="max-w-3xl" fallbackFocus={fallbackFocus}>
      <div className="flex items-start gap-3 border-b border-white/10 p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-base font-bold leading-snug text-white sm:text-lg">
            {title}
          </h2>
          {summary && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400">
              <span className="rounded-full border border-averna-cyan/40 bg-averna-cyan/10 px-2 py-0.5 text-averna-cyan">{skillMeta(summary.skill).label}</span>
              <StatusChip status={summary.status} />
              <span className="rounded-full border border-white/10 px-2 py-0.5">{DIFFICULTY_LABEL[summary.difficulty]}</span>
              <span className="tabular-nums">
                {summary.stepsDone}/{summary.steps} qadam
              </span>
              {summary.questions > 0 && <span>· {summary.questions} ta savol</span>}
              {summary.topic && <span className="min-w-0 truncate">· {summary.topic}</span>}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          data-autofocus
          className={cn("shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white", FOCUS_RING)}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
        {state.loading ? (
          <p className="flex items-center gap-2 py-10 text-sm text-gray-400" role="status">
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> Test yuklanmoqda…
          </p>
        ) : state.error ? (
          <div role="alert" className="space-y-3 py-6">
            <p className="flex items-start gap-2 text-sm text-red-300">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {state.error}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Qayta urinish
            </Button>
          </div>
        ) : showJson || body === null ? (
          <div className="space-y-2">
            {!showJson && (
              <p className="flex items-start gap-2 text-xs text-gray-400">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Bu maʼlumotni oʻqiladigan koʻrinishda chiqarib boʻlmadi — xom JSON koʻrsatilmoqda.
              </p>
            )}
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed text-gray-300">
              {safeJson(test)}
            </pre>
          </div>
        ) : (
          body
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 p-3 sm:p-4">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setShowJson((v) => !v)}
          aria-pressed={showJson}
          disabled={!state.data}
          className="mr-auto"
        >
          <ScrollText className="mr-1.5 h-3.5 w-3.5" aria-hidden /> JSON
        </Button>
        {canManage && summary?.status === "ready" && (
          <Button type="button" size="sm" onClick={() => onPublish(id, true)} disabled={busy} className="neon-button bg-averna-primary text-white hover:bg-averna-light">
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden /> : <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
            Nashr qilish
          </Button>
        )}
        {canManage && summary?.status === "published" && (
          <Button type="button" size="sm" variant="outline" onClick={() => onPublish(id, false)} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden /> : <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
            Nashrdan olish
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Yopish
        </Button>
      </div>
    </Modal>
  );
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2) ?? "null";
  } catch {
    return String(v);
  }
}

// ---- Defensive readers for preview JSON (unknown shapes never throw) ----
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objs = (v: unknown): Obj[] => arr(v).filter(isObj);
const strs = (v: unknown): string[] => arr(v).map(asText).filter((s) => s.trim().length > 0);

const KIND_LABEL: Record<string, string> = {
  tfng: "TRUE / FALSE / NOT GIVEN",
  ynng: "YES / NO / NOT GIVEN",
  mcq: "Bitta javobli test",
  "mcq-multi": "Bir nechta javobli test",
  matching: "Moslashtirish",
  gap: "Boʻsh joyni toʻldirish",
  "gap-box": "Roʻyxatdan soʻz tanlash",
};

/** Text with [[n]] answer gaps shown as numbered boxes. */
function withGaps(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\[\[(\d+)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null = re.exec(text);
  while (m !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <span
        key={`gap-${m.index}`}
        className="mx-0.5 inline-block min-w-[2.25rem] rounded border border-averna-cyan/40 bg-averna-cyan/10 px-1 text-center text-[11px] font-semibold text-averna-cyan"
      >
        {m[1]}
      </span>
    );
    last = m.index + m[0].length;
    m = re.exec(text);
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function renderDataTable(head: string[], rows: string[][]): React.ReactNode {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="border border-white/10 bg-white/5 px-2 py-1 text-left font-semibold text-gray-200">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) =>
                ci === 0 ? (
                  <th key={ci} scope="row" className="border border-white/10 px-2 py-1 text-left font-medium text-gray-200">
                    {c}
                  </th>
                ) : (
                  <td key={ci} className="border border-white/10 px-2 py-1 tabular-nums text-gray-300">
                    {c}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** gap / gap-box layout: "# heading", "- bullet", "| table | row |", plain lines — gaps highlighted. */
function renderTemplate(template: string): React.ReactNode {
  const blocks: React.ReactNode[] = [];
  let table: string[][] = [];
  const flushTable = (key: string) => {
    if (!table.length) return;
    const [head, ...body] = table;
    blocks.push(
      <div key={key} className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {head.map((c, i) => (
                <th key={i} className="border border-white/10 bg-white/5 px-2 py-1 text-left font-semibold text-gray-200">
                  {withGaps(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td key={ci} className="border border-white/10 px-2 py-1 text-gray-300">
                    {withGaps(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    table = [];
  };
  template.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith("|")) {
      if (!/^\|[\s:|-]+\|?$/.test(line)) table.push(line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
      return;
    }
    flushTable(`table-${i}`);
    if (!line) return;
    if (line.startsWith("#")) {
      blocks.push(
        <p key={i} className="font-semibold text-white">
          {withGaps(line.replace(/^#+\s*/, ""))}
        </p>
      );
    } else if (/^[-•]\s+/.test(line)) {
      blocks.push(
        <p key={i} className="flex gap-2 pl-2">
          <span aria-hidden>•</span>
          <span>{withGaps(line.replace(/^[-•]\s+/, ""))}</span>
        </p>
      );
    } else {
      blocks.push(<p key={i}>{withGaps(line)}</p>);
    }
  });
  flushTable("table-end");
  return <div className="space-y-1 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-gray-200">{blocks}</div>;
}

function renderOptions(options: Obj[]): React.ReactNode {
  return (
    <ul className="grid gap-1 text-xs text-gray-300 sm:grid-cols-2">
      {options.map((o, i) => (
        <li key={i} className="flex gap-1.5">
          <span className="shrink-0 font-semibold text-averna-cyan">{asText(o.key)}</span>
          <span className="min-w-0">{asText(o.text)}</span>
        </li>
      ))}
    </ul>
  );
}

function renderQuestion(q: Obj, key: string, multi: boolean): React.ReactNode {
  const text = asText(q.text);
  const options = objs(q.options);
  const answers = strs(q.answer);
  const explanation = asText(q.explanation);
  return (
    <li key={key} className="flex gap-2 text-sm">
      <span className="w-7 shrink-0 text-right font-semibold tabular-nums text-gray-400">{asText(q.n) || "?"}.</span>
      <div className="min-w-0 flex-1 space-y-1">
        {text && <p className="text-gray-100">{withGaps(text)}</p>}
        {options.length > 0 && renderOptions(options)}
        <p className="text-xs">
          <span className="text-gray-400">Javob: </span>
          <span className="font-semibold text-averna-neon">{answers.length ? answers.join(multi ? ", " : " / ") : "—"}</span>
        </p>
        {explanation && (
          <p className="text-xs text-gray-400">
            <span className="text-gray-500">Izoh: </span>
            {explanation}
          </p>
        )}
      </div>
    </li>
  );
}

function renderGroup(g: Obj, key: string): React.ReactNode {
  const questions = objs(g.questions);
  const numbers = questions.map((q) => asNum(q.n, NaN)).filter((n) => Number.isFinite(n));
  const range = numbers.length
    ? numbers.length > 1
      ? `Questions ${Math.min(...numbers)}–${Math.max(...numbers)}`
      : `Question ${numbers[0]}`
    : "Questions";
  const kind = asText(g.kind);
  const options = objs(g.options);
  const template = asText(g.template);
  const rule = asText(g.answerRule) || (typeof g.wordLimit === "number" ? `NO MORE THAN ${g.wordLimit} WORD(S)${g.allowNumber === true ? " AND/OR A NUMBER" : ""}` : "");
  return (
    <div key={key} className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-white">{range}</p>
        {kind && <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-gray-400">{KIND_LABEL[kind] ?? kind}</span>}
      </div>
      {asText(g.instructions) && <p className="whitespace-pre-line text-xs text-gray-300">{asText(g.instructions)}</p>}
      {rule && <p className="text-xs font-bold text-gray-100">{rule}</p>}
      {asText(g.title) && <p className="text-sm font-semibold text-gray-100">{asText(g.title)}</p>}
      {options.length > 0 && renderOptions(options)}
      {g.allowReuse === true && <p className="text-[11px] italic text-gray-400">NB You may use any letter more than once.</p>}
      {template && renderTemplate(template)}
      <ol className="space-y-2">{questions.map((q, i) => renderQuestion(q, `${key}-q${i}`, kind === "mcq-multi"))}</ol>
    </div>
  );
}

function renderReadingPart(p: Obj, index: number): React.ReactNode {
  const paragraphs = objs(p.paragraphs);
  const groups = objs(p.groups);
  return (
    <section key={`reading-${index}`} className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-averna-cyan">Reading Passage {index + 1}</p>
        <h3 className="text-base font-bold text-white">{asText(p.title) || `Passage ${index + 1}`}</h3>
        {asText(p.subtitle) && <p className="text-xs italic text-gray-400">{asText(p.subtitle)}</p>}
      </div>
      <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-relaxed text-gray-200">
        {paragraphs.length ? (
          paragraphs.map((para, i) => (
            <p key={i} className="flex gap-2">
              {asText(para.label) && <span className="w-5 shrink-0 font-bold text-averna-cyan">{asText(para.label)}</span>}
              <span className="min-w-0 whitespace-pre-line">{asText(para.text)}</span>
            </p>
          ))
        ) : (
          <p className="text-xs text-gray-500">Matn yoʻq.</p>
        )}
      </div>
      <div className="space-y-3">{groups.map((g, i) => renderGroup(g, `reading-${index}-g${i}`))}</div>
    </section>
  );
}

function renderListeningPart(p: Obj, index: number): React.ReactNode {
  const speakers = objs(p.speakers);
  const script = objs(p.script);
  const groups = objs(p.groups);
  return (
    <section key={`listening-${index}`} className="space-y-3">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-averna-cyan">{asText(p.title) || `Part ${index + 1}`}</p>
        {asText(p.context) && <p className="text-sm italic text-gray-300">{asText(p.context)}</p>}
        {speakers.length > 0 && (
          <p className="text-[11px] text-gray-400">
            Ishtirokchilar: {speakers.map((s) => [asText(s.name), asText(s.gender), asText(s.accent)].filter(Boolean).join(" · ")).join("; ")}
          </p>
        )}
      </div>
      <div className="space-y-1.5 rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-relaxed text-gray-200">
        {script.length ? (
          script.map((line, i) => (
            <p key={i}>
              <span className="font-bold text-white">{asText(line.speaker) || "—"}:</span> {asText(line.text)}
              {asNum(line.pauseAfter, 0) > 0 && <span className="ml-1 text-[10px] text-gray-500">[pauza {asNum(line.pauseAfter, 0)} s]</span>}
            </p>
          ))
        ) : (
          <p className="text-xs text-gray-500">Ssenariy yoʻq.</p>
        )}
      </div>
      <div className="space-y-3">{groups.map((g, i) => renderGroup(g, `listening-${index}-g${i}`))}</div>
    </section>
  );
}

function renderBlock(title: string, content: React.ReactNode): React.ReactNode {
  return (
    <section className="space-y-1.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{title}</h4>
      <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">{content}</div>
    </section>
  );
}

function renderChart(c: Obj, index: number): React.ReactNode {
  const kind = asText(c.kind);
  const unit = asText(c.unit);
  const caption = [asText(c.title), unit ? `birlik: ${unit}` : ""].filter(Boolean).join(" · ");
  if (kind === "pie") {
    const slices = objs(c.slices);
    return (
      <div key={index} className="space-y-1">
        <p className="text-xs text-gray-400">Doiraviy diagramma{caption ? ` · ${caption}` : ""}</p>
        {renderDataTable(["Qism", "Qiymat"], slices.map((s) => [asText(s.label), asText(s.value)]))}
      </div>
    );
  }
  const labels = strs(kind === "line" ? c.xLabels : c.groups);
  const series = objs(c.series);
  if (!labels.length && !series.length) {
    return (
      <pre key={index} className="overflow-auto whitespace-pre-wrap break-words text-[11px] text-gray-300">
        {safeJson(c)}
      </pre>
    );
  }
  const kindLabel = kind === "line" ? "Chiziqli grafik" : kind === "bar" ? "Ustunli grafik" : kind || "Grafik";
  return (
    <div key={index} className="space-y-1">
      <p className="text-xs text-gray-400">
        {kindLabel}
        {caption ? ` · ${caption}` : ""}
      </p>
      {renderDataTable(["", ...labels], series.map((s) => [asText(s.name), ...arr(s.values).map(asText)]))}
    </div>
  );
}

function renderWriting(t: Obj): React.ReactNode {
  const charts = objs(t.chart);
  const phrases = strs(t.usefulPhrases);
  const sample = asText(t.sampleAnswer).trim();
  const words = sample ? sample.split(/\s+/).length : 0;
  const strategyEn = asText(t.strategyEn);
  const strategyUz = asText(t.strategyUz);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {asText(t.title) && <h3 className="text-base font-bold text-white">{asText(t.title)}</h3>}
        {asText(t.type) && (
          <span className="rounded-full border border-averna-purple/40 bg-averna-purple/10 px-2 py-0.5 text-[10px] text-averna-purple">{asText(t.type)}</span>
        )}
      </div>
      {renderBlock("Topshiriq", <p className="whitespace-pre-line text-sm text-gray-100">{asText(t.prompt)}</p>)}
      {charts.length > 0 && renderBlock("Grafik maʼlumotlari", charts.map((c, i) => renderChart(c, i)))}
      {sample &&
        renderBlock(`Namuna javob · ${words} soʻz`, <p className="whitespace-pre-line text-sm leading-relaxed text-gray-200">{sample}</p>)}
      {phrases.length > 0 &&
        renderBlock(
          "Foydali iboralar",
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-200">
            {phrases.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        )}
      {(strategyEn || strategyUz) &&
        renderBlock(
          "Strategiya",
          <>
            {strategyEn && <p className="text-sm text-gray-200">{strategyEn}</p>}
            {strategyUz && (
              <p lang="uz" className="text-sm text-gray-400">
                {strategyUz}
              </p>
            )}
          </>
        )}
    </div>
  );
}

function renderSpeaking(t: Obj): React.ReactNode {
  const part1 = objs(t.part1);
  const part2: Obj = isObj(t.part2) ? t.part2 : {};
  const part3: Obj = isObj(t.part3) ? t.part3 : {};
  const points = strs(part2.points);
  const part3Questions = strs(part3.questions);
  return (
    <div className="space-y-4">
      {asText(t.title) && <h3 className="text-base font-bold text-white">{asText(t.title)}</h3>}
      {renderBlock(
        "Part 1 — tanishuv savollari",
        part1.length ? (
          part1.map((topic, i) => (
            <div key={i} className="space-y-1">
              <p className="text-sm font-semibold text-white">{asText(topic.topic) || `Mavzu ${i + 1}`}</p>
              <ol className="list-decimal space-y-0.5 pl-5 text-sm text-gray-200">
                {strs(topic.questions).map((q, j) => (
                  <li key={j}>{q}</li>
                ))}
              </ol>
            </div>
          ))
        ) : (
          <p className="text-xs text-gray-500">Savollar yoʻq.</p>
        )
      )}
      {renderBlock(
        "Part 2 — kartochka",
        <>
          <p className="text-sm font-semibold text-white">{asText(part2.cue) || "—"}</p>
          {points.length > 0 && (
            <>
              <p className="text-xs text-gray-400">You should say:</p>
              <ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-200">
                {points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </>
          )}
          {asText(part2.closing) && <p className="text-sm text-gray-200">{asText(part2.closing)}</p>}
          {asText(part2.followUp) && <p className="text-xs text-gray-400">Qoʻshimcha savol: {asText(part2.followUp)}</p>}
        </>
      )}
      {renderBlock(
        "Part 3 — muhokama",
        <>
          {asText(part3.theme) && <p className="text-sm font-semibold text-white">{asText(part3.theme)}</p>}
          {part3Questions.length ? (
            <ol className="list-decimal space-y-0.5 pl-5 text-sm text-gray-200">
              {part3Questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-gray-500">Savollar yoʻq.</p>
          )}
        </>
      )}
    </div>
  );
}

/** An unfinished draft: the parts generated so far (Reading passages / Listening parts). */
function renderDraft(summary: DraftSummary | null, t: Obj, idBase: string): React.ReactNode {
  const skill: GenSkill | null = isSkill(t.skill) ? t.skill : summary?.skill ?? null;
  const parts = objs(t.parts);
  const warnings = strs(t.warnings);
  const lastError = asText(t.lastError);
  const total = skill ? STEPS_FOR[skill] : summary?.steps ?? parts.length;
  const renderPart = skill === "LISTENING" ? renderListeningPart : skill === "READING" ? renderReadingPart : null;
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-averna-purple/30 bg-averna-purple/10 p-3 text-xs text-gray-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-averna-purple" aria-hidden />
        <p>
          Bu hali qoralama: {Math.min(parts.length, total)}/{total} qadam tayyor. Test barcha qadamlari yaratilib, tekshiruvdan
          oʻtgandan keyingina nashr qilinadi.
        </p>
      </div>
      {lastError && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">Oxirgi xato: {lastError}</p>}
      {warnings.length > 0 && renderBlock(`Ogohlantirishlar (${warnings.length})`, <WarningList id={`${idBase}-draft-warnings`} warnings={warnings} />)}
      {parts.length === 0 ? (
        <p className="text-sm text-gray-400">Hali hech qanday qism yaratilmagan.</p>
      ) : renderPart ? (
        <div className="space-y-6">{parts.map((p, i) => renderPart(p, i))}</div>
      ) : (
        <pre className="overflow-auto whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] text-gray-300">
          {safeJson(parts)}
        </pre>
      )}
    </div>
  );
}

/** Readable preview WITH answers; null when the shape is unknown (the dialog then shows raw JSON). */
function renderPreviewBody(summary: DraftSummary | null, test: unknown, idBase: string): React.ReactNode | null {
  if (!isObj(test)) return null;
  try {
    if (test.format === "draft") return renderDraft(summary, test, idBase);
    const skill: GenSkill | null = summary?.skill ?? (isSkill(test.skill) ? test.skill : null);
    let body: React.ReactNode | null = null;
    if (skill === "READING" || skill === "LISTENING") {
      const parts = objs(test.parts);
      if (parts.length) {
        const description = asText(test.description);
        const minutes = asNum(test.timeLimit, 0);
        body = (
          <div className="space-y-6">
            {(description || minutes > 0) && (
              <p className="text-xs text-gray-400">
                {description}
                {minutes > 0 ? `${description ? " · " : ""}Vaqt: ${minutes} daqiqa` : ""}
              </p>
            )}
            {parts.map((p, i) => (skill === "READING" ? renderReadingPart(p, i) : renderListeningPart(p, i)))}
          </div>
        );
      }
    } else if (skill === "WRITING_TASK1" || skill === "WRITING_TASK2") {
      if (typeof test.prompt === "string") body = renderWriting(test);
    } else if (skill === "SPEAKING") {
      if (Array.isArray(test.part1) || isObj(test.part2)) body = renderSpeaking(test);
    }
    if (body === null) return null;
    const warnings = summary?.warnings ?? [];
    return (
      <div className="space-y-5">
        {warnings.length > 0 && renderBlock(`Tekshiruv natijasi (${warnings.length})`, <WarningList id={`${idBase}-warnings`} warnings={warnings} />)}
        {body}
      </div>
    );
  } catch (err) {
    console.error("exam-bulk-generator preview:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExamBulkGenerator({ canManage = true }: { canManage?: boolean }) {
  const uid: string = useId();

  // ---- Server data. Rows live in a ref (the queue reads it synchronously); `version` re-renders. ----
  const rowsRef: Box<Map<string, DraftSummary>> = useRef(new Map<string, DraftSummary>());
  /** When each row was last changed locally (step / plan / delete) — older list responses never overwrite it. */
  const touchedRef: Box<Map<string, number>> = useRef(new Map<string, number>());
  /** Deleted ids: a late step response must not bring them back. */
  const deletedRef: Box<Set<string>> = useRef(new Set<string>());
  const loadedRef: Box<Set<GenSkill>> = useRef(new Set<GenSkill>());
  const [version, setVersion]: State<number> = useState(0);
  const commit = () => setVersion((v) => v + 1);

  const [initialLoading, setInitialLoading]: State<boolean> = useState(true);
  const [refreshing, setRefreshing]: State<boolean> = useState(false);
  const [loadError, setLoadError]: State<string | null> = useState<string | null>(null);
  const [openAi, setOpenAi]: State<boolean | null> = useState<boolean | null>(null);
  const openAiRef: Box<boolean | null> = useRef<boolean | null>(null);
  const refreshCountRef: Box<number> = useRef(0);
  const mountedRef: Box<boolean> = useRef(false);
  const lifeRef: Box<AbortController | null> = useRef<AbortController | null>(null);
  /** Signal aborted on unmount — every request uses it. */
  const life = (): AbortSignal => {
    if (!lifeRef.current) lifeRef.current = new AbortController();
    return lifeRef.current.signal;
  };

  // ---- Queue (all mutable queue state is in refs so worker loops never see stale values). ----
  const [running, setRunning]: State<boolean> = useState(false);
  const runningRef: Box<boolean> = useRef(false);
  const [concurrency, setConcurrency]: State<number> = useState(2);
  const concurrencyRef: Box<number> = useRef(2);
  const slotsRef: Box<Set<number>> = useRef(new Set<number>());
  const inFlightRef: Box<Set<string>> = useRef(new Set<string>());
  const cooldownRef: Box<Map<string, number>> = useRef(new Map<string, number>());
  const attemptsRef: Box<Map<string, number>> = useRef(new Map<string, number>());
  /** Failed drafts the admin asked to retry (sent once with retry: true). */
  const retryRef: Box<Set<string>> = useRef(new Set<string>());
  /** Drafts of the current run — the overall progress bar measures these. */
  const runIdsRef: Box<Set<string>> = useRef(new Set<string>());
  const pausedUntilRef: Box<number> = useRef(0);
  const [pausedUntil, setPausedUntil]: State<number> = useState(0);
  const [clock, setClock]: State<number> = useState(0);
  const backoffUntilRef: Box<number> = useRef(0);
  const errorStreakRef: Box<number> = useRef(0);
  const pausedByUserRef: Box<boolean> = useRef(false);
  const durationsRef: Box<number[]> = useRef<number[]>([]);
  const [avgStepMs, setAvgStepMs]: State<number | null> = useState<number | null>(null);
  const [queueError, setQueueError]: State<string | null> = useState<string | null>(null);
  const [announcement, setAnnouncement]: State<string> = useState("");
  const announce = (message: string) => setAnnouncement(message);

  // ---- View state ----
  const [skill, setSkill]: State<GenSkill> = useState<GenSkill>("READING");
  const [countText, setCountText]: State<string> = useState("10");
  const [difficulty, setDifficulty]: State<DifficultyChoice> = useState<DifficultyChoice>("mixed");
  const [planning, setPlanning]: State<boolean> = useState(false);
  const [planError, setPlanError]: State<string | null> = useState<string | null>(null);
  const [filter, setFilter]: State<FilterKey> = useState<FilterKey>("all");
  const [limit, setLimit]: State<number> = useState(PAGE_SIZE);
  const [selected, setSelected]: State<Set<string>> = useState<Set<string>>(() => new Set<string>());
  const [expanded, setExpanded]: State<Set<string>> = useState<Set<string>>(() => new Set<string>());
  const [busy, setBusy]: State<BusyAction | null> = useState<BusyAction | null>(null);
  const busyRef: Box<boolean> = useRef(false);
  const [confirmIds, setConfirmIds]: State<string[] | null> = useState<string[] | null>(null);
  const [previewId, setPreviewId]: State<string | null> = useState<string | null>(null);
  const tabRefs: Box<(HTMLButtonElement | null)[]> = useRef<(HTMLButtonElement | null)[]>([]);
  /** Where focus goes when a dialog closes and its opener is gone (e.g. after deleting). */
  const listHeadingRef: Box<HTMLElement | null> = useRef<HTMLElement | null>(null);

  // -------------------------------------------------------------------------
  // Rows
  // -------------------------------------------------------------------------

  const upsert = (d: DraftSummary) => {
    if (deletedRef.current.has(d.id)) return;
    rowsRef.current.set(d.id, d);
    touchedRef.current.set(d.id, Date.now());
  };

  /** Rows that no longer exist on the server. */
  const forget = (ids: string[]) => {
    const t = Date.now();
    ids.forEach((id) => {
      rowsRef.current.delete(id);
      deletedRef.current.add(id);
      touchedRef.current.set(id, t);
      retryRef.current.delete(id);
      cooldownRef.current.delete(id);
      attemptsRef.current.delete(id);
      runIdsRef.current.delete(id);
    });
  };

  /** Replace one skill's rows with a list fetched at `startedAt`, keeping newer local changes and in-flight rows. */
  const applySkill = (target: GenSkill, drafts: DraftSummary[], startedAt: number) => {
    const map = rowsRef.current;
    const keepLocal = (id: string) => (touchedRef.current.get(id) ?? 0) > startedAt || inFlightRef.current.has(id);
    const incoming = new Set(drafts.map((d) => d.id));
    Array.from(map.values()).forEach((row) => {
      if (row.skill === target && !incoming.has(row.id) && !keepLocal(row.id)) map.delete(row.id);
    });
    for (const d of drafts) {
      if (!keepLocal(d.id) && !deletedRef.current.has(d.id)) map.set(d.id, d);
    }
    loadedRef.current.add(target);
  };

  /** Re-fetch the given skills (in parallel). Never rejects. */
  const refresh = async (skills: GenSkill[], quiet = false): Promise<void> => {
    const signal = life();
    const startedAt = Date.now();
    refreshCountRef.current += 1;
    setRefreshing(true);
    try {
      const results = await Promise.allSettled(skills.map((s) => loadSkill(s, signal)));
      if (signal.aborted) return;
      let failure: string | null = null;
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled") {
          applySkill(skills[i], result.value.drafts, startedAt);
          openAiRef.current = result.value.openAiConfigured;
          setOpenAi(result.value.openAiConfigured);
        } else if (failure === null && !isCancelled(result.reason)) {
          failure = errorText(result.reason, `${ACTION_FAILED.load}.`);
        }
      }
      commit();
      setLoadError(failure);
      if (failure && !quiet) toast.error(failure);
    } catch (err) {
      if (!signal.aborted) setLoadError(errorText(err, `${ACTION_FAILED.load}.`));
    } finally {
      refreshCountRef.current -= 1;
      if (!signal.aborted) {
        if (refreshCountRef.current === 0) setRefreshing(false);
        setInitialLoading(false);
      }
    }
  };

  // -------------------------------------------------------------------------
  // Queue
  // -------------------------------------------------------------------------

  /** Rows the queue may still generate: queued / generating, plus failed drafts marked for retry. */
  const workRows = (): DraftSummary[] =>
    Array.from(rowsRef.current.values()).filter((r) => isPending(r) || (r.status === "failed" && retryRef.current.has(r.id)));

  const recordDuration = (ms: number) => {
    const list = durationsRef.current;
    list.push(ms);
    if (list.length > 20) list.shift();
    setAvgStepMs(list.reduce((a, b) => a + b, 0) / list.length);
  };

  /** Stop for a reason the admin must fix (sign-in, permissions, configuration, repeated errors). */
  const stopQueue = (reason: string) => {
    runningRef.current = false;
    pausedByUserRef.current = false;
    setRunning(false);
    setQueueError(reason);
    announce(reason);
  };

  /** HTTP 429: every worker waits until the budget window reopens, then continues on its own. */
  const rateLimited = (sec: number) => {
    const until = Date.now() + Math.max(1, sec) * 1000;
    if (until > pausedUntilRef.current) {
      pausedUntilRef.current = until;
      setPausedUntil(until);
      setClock(Date.now());
    }
    announce(
      runningRef.current
        ? `AI limiti tugadi — navbat ${formatDuration(sec)} kutadi va keyin avtomatik davom etadi.`
        : `AI limiti tugadi — ${formatDuration(sec)} kuting.`
    );
  };

  /** Network error / 5xx / malformed answer: back off, and stop after too many in a row. */
  const transientFailure = (id: string, message: string) => {
    errorStreakRef.current += 1;
    const streak = errorStreakRef.current;
    const now = Date.now();
    cooldownRef.current.set(id, now + TRANSIENT_COOLDOWN_MS);
    backoffUntilRef.current = Math.max(backoffUntilRef.current, now + Math.min(60_000, 2_000 * 2 ** Math.min(streak, 5)));
    if (streak >= MAX_ERROR_STREAK && runningRef.current) {
      stopQueue(`${message} Ketma-ket ${streak} marta xato — navbat toʻxtatildi. Muammo hal boʻlgach, «Boshlash»ni bosing.`);
    } else {
      announce(`${message} Birozdan soʻng qayta urinamiz…`);
    }
  };

  /** HTTP 400 for one draft (already failed / published / not a bulk draft): leave it and resync its skill. */
  const markSkipped = (id: string, detail: string) => {
    cooldownRef.current.set(id, Date.now() + 60_000);
    const row = rowsRef.current.get(id);
    if (!row) return;
    if (/failed/i.test(detail)) upsert({ ...row, status: "failed", lastError: row.lastError ?? detail });
    else if (/published/i.test(detail)) upsert({ ...row, status: "published" });
    void refresh([row.skill], true);
  };

  /** One /step request for one draft. Never throws; never runs twice in parallel for the same draft. */
  const runStep = async (id: string, retry: boolean): Promise<StepResult> => {
    if (inFlightRef.current.has(id)) return { kind: "busy" };
    inFlightRef.current.add(id);
    commit();
    const started = Date.now();
    try {
      const r = await requestJson(
        "/api/admin/exam-gen/step",
        { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(retry ? { draftId: id, retry: true } : { draftId: id }) },
        life(),
        STEP_TIMEOUT_MS
      );
      if (r.status === 429) {
        rateLimited(retryAfterOf(r.body));
        return { kind: "rate-limited", message: httpError(429, r.body, "step") };
      }
      if (r.status === 401 || r.status === 403) {
        const message = httpError(r.status, r.body, "step");
        stopQueue(message);
        return { kind: "stopped", message };
      }
      if (r.status === 404) {
        forget([id]);
        return { kind: "gone", message: "Qoralama topilmadi — u oʻchirilgan boʻlishi mumkin." };
      }
      if (r.status === 400) {
        retryRef.current.delete(id);
        const detail = serverError(r.body);
        if (isConfigError(detail)) {
          const missing = isMissingKey(detail);
          if (missing) {
            openAiRef.current = false;
            setOpenAi(false);
          }
          const message = missing ? NO_OPENAI : `OpenAI sozlamasida muammo — navbat toʻxtatildi: ${detail}`;
          stopQueue(message);
          return { kind: "stopped", message };
        }
        markSkipped(id, detail);
        return { kind: "skipped", message: detail ? `${ACTION_FAILED.step}: ${detail}` : `${ACTION_FAILED.step}.` };
      }
      const body = r.body;
      const draft = isObj(body) ? parseDraft(body.draft) : null;
      if (!r.ok || !isObj(body) || typeof body.ok !== "boolean" || !draft) {
        const message = r.ok ? UNEXPECTED : httpError(r.status, body, "step");
        transientFailure(id, message);
        return { kind: "transient", message };
      }

      errorStreakRef.current = 0;
      retryRef.current.delete(id);
      upsert(draft);
      if (body.ok) {
        attemptsRef.current.delete(id);
        cooldownRef.current.delete(id);
        recordDuration(Date.now() - started);
        if (draft.status === "ready") announce(`Tayyor: «${draft.title}».`);
        return { kind: "ok" };
      }
      const error = asText(body.error) || `${ACTION_FAILED.step}.`;
      if (/another request/i.test(error)) {
        // Someone else holds this draft right now — come back to it later.
        cooldownRef.current.set(id, Date.now() + BUSY_COOLDOWN_MS);
        return { kind: "busy", message: "Bu qoralama hozir boshqa soʻrovda yaratilmoqda — keyinroq qaytamiz." };
      }
      recordDuration(Date.now() - started);
      const attempts = (attemptsRef.current.get(id) ?? 0) + 1;
      attemptsRef.current.set(id, attempts);
      cooldownRef.current.set(id, Date.now() + RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length) - 1]);
      if (draft.status === "failed") {
        announce(`«${draft.title}» ${draft.failures} marta muvaffaqiyatsiz boʻldi va oʻtkazib yuborildi. «Qayta urinish» bilan qayta yaratish mumkin.`);
      }
      return { kind: "step-error", message: error };
    } catch (err) {
      if (isCancelled(err)) return { kind: "cancelled" };
      const message = errorText(err, "Server bilan bogʻlanib boʻlmadi.");
      transientFailure(id, message);
      return { kind: "transient", message };
    } finally {
      inFlightRef.current.delete(id);
      if (mountedRef.current) commit();
    }
  };

  /** Next draft for a worker: retries first, then drafts already under way, then plan order. */
  const pickNext = (now: number): { id: string; retry: boolean } | "wait" | "none" => {
    let best: DraftSummary | null = null;
    let bestRank = Number.POSITIVE_INFINITY;
    let bestRetry = false;
    let blocked = false;
    for (const r of Array.from(rowsRef.current.values())) {
      const retry = r.status === "failed" && retryRef.current.has(r.id);
      if (!retry && !isPending(r)) continue;
      if (inFlightRef.current.has(r.id) || (cooldownRef.current.get(r.id) ?? 0) > now) {
        blocked = true;
        continue;
      }
      // A "generating" draft without progress or failures is most likely locked by another request: try it last.
      const rank = retry ? 0 : r.status === "generating" ? (r.stepsDone > 0 || r.failures > 0 ? 1 : 3) : 2;
      if (best === null || rank < bestRank || (rank === bestRank && r.createdAt < best.createdAt)) {
        best = r;
        bestRank = rank;
        bestRetry = retry;
      }
    }
    if (best) return { id: best.id, retry: bestRetry };
    return blocked ? "wait" : "none";
  };

  const workerLoop = async (slot: number): Promise<void> => {
    try {
      while (runningRef.current && mountedRef.current && slot < concurrencyRef.current) {
        const now = Date.now();
        const hold = Math.max(pausedUntilRef.current, backoffUntilRef.current) - now;
        if (hold > 0) {
          await sleep(Math.min(hold, 1000), life());
          continue;
        }
        const next = pickNext(now);
        if (next === "none") return;
        if (next === "wait") {
          await sleep(1000, life());
          continue;
        }
        await runStep(next.id, next.retry);
      }
    } catch (err) {
      // runStep never throws; this only guards against a programming error leaving a rejection behind.
      console.error("exam-bulk-generator worker:", err);
    }
  };

  const finishRun = () => {
    runningRef.current = false;
    setRunning(false);
    let finished = 0;
    let failed = 0;
    const skills = new Set<GenSkill>();
    runIdsRef.current.forEach((id) => {
      const r = rowsRef.current.get(id);
      if (!r) return;
      skills.add(r.skill);
      if (r.status === "ready" || r.status === "published") finished += 1;
      else if (r.status === "failed") failed += 1;
    });
    const message = failed
      ? `Navbat yakunlandi: ${finished} ta test tayyor, ${failed} tasida xato.`
      : `Navbat yakunlandi: ${finished} ta test tayyor — koʻrib chiqib, nashr qiling.`;
    announce(message);
    if (failed) toast.info(message);
    else toast.success(message);
    commit();
    if (skills.size) void refresh(Array.from(skills), true);
  };

  /** Start worker loops for free slots up to the concurrency (idempotent). */
  const ensureWorkers = () => {
    for (let slot = 0; slot < concurrencyRef.current; slot++) {
      if (slotsRef.current.has(slot)) continue;
      slotsRef.current.add(slot);
      void workerLoop(slot).finally(() => {
        slotsRef.current.delete(slot);
        if (slotsRef.current.size > 0 || !mountedRef.current) return;
        if (runningRef.current) {
          finishRun();
        } else {
          if (pausedByUserRef.current) announce("Navbat toʻxtatildi.");
          pausedByUserRef.current = false;
          commit();
        }
      });
    }
    commit();
  };

  const startQueue = (extraIds: string[] = []) => {
    if (!mountedRef.current) return;
    if (openAiRef.current !== true) {
      announce(NO_OPENAI);
      return;
    }
    const work = workRows();
    const wasRunning = runningRef.current;
    if (!wasRunning) {
      // Resuming a paused run keeps its progress; otherwise a new run starts.
      const carry = Array.from(runIdsRef.current).some((id) => isPending(rowsRef.current.get(id)) || retryRef.current.has(id));
      if (!carry) runIdsRef.current = new Set<string>();
      cooldownRef.current.clear();
      attemptsRef.current.clear();
      errorStreakRef.current = 0;
      backoffUntilRef.current = 0;
      pausedByUserRef.current = false;
      setQueueError(null);
    }
    work.forEach((r) => runIdsRef.current.add(r.id));
    extraIds.forEach((id) => runIdsRef.current.add(id));
    if (!work.length) {
      if (!wasRunning) announce("Navbatda yaratiladigan qoralama yoʻq.");
      commit();
      return;
    }
    runningRef.current = true;
    setRunning(true);
    if (!wasRunning) {
      const steps = work.reduce((n, r) => n + Math.max(0, r.steps - r.stepsDone), 0);
      announce(`Navbat boshlandi: ${work.length} ta qoralama, ${steps} ta qadam.`);
    }
    ensureWorkers();
  };

  const pauseQueue = () => {
    if (!runningRef.current) return;
    runningRef.current = false;
    setRunning(false);
    const inFlight = inFlightRef.current.size;
    pausedByUserRef.current = inFlight > 0;
    announce(inFlight ? `Navbat toʻxtatilmoqda — ${inFlight} ta joriy qadam yakunlanmoqda…` : "Navbat toʻxtatildi.");
    commit();
  };

  const changeConcurrency = (value: number) => {
    const n = clampInt(Number.isFinite(value) ? value : 2, 1, 3);
    concurrencyRef.current = n;
    setConcurrency(n);
    if (runningRef.current) ensureWorkers();
  };

  /** "Qayta urinish" on a failed draft: one /step with retry: true, then it is back in the queue. */
  const retryDraft = (id: string) => {
    const row = rowsRef.current.get(id);
    if (!row || row.status !== "failed" || inFlightRef.current.has(id) || retryRef.current.has(id)) return;
    if (openAiRef.current !== true) {
      toast.error(NO_OPENAI);
      return;
    }
    if (runningRef.current) {
      retryRef.current.add(id);
      runIdsRef.current.add(id);
      cooldownRef.current.delete(id);
      attemptsRef.current.delete(id);
      ensureWorkers();
      announce(`«${row.title}» qayta urinish uchun navbatga qoʻshildi.`);
      return;
    }
    announce(`«${row.title}» qayta yaratilmoqda…`);
    void runStep(id, true)
      .then((res) => {
        if (!mountedRef.current) return;
        const after = rowsRef.current.get(id);
        if (res.kind === "ok" && after) {
          if (after.status === "ready") toast.success(`«${after.title}» tayyor — koʻrib chiqib, nashr qiling.`);
          else toast.info(`«${after.title}» navbatga qaytdi (${after.stepsDone}/${after.steps} qadam). Qolgan qadamlar uchun «Boshlash»ni bosing.`);
        } else if (res.kind === "step-error") {
          toast.error(`Qayta urinishda xato: ${res.message ?? ""} Qoralama navbatda qoldi — «Boshlash» bosilganda yana urinib koʻriladi.`);
        } else if (res.message && res.kind !== "cancelled") {
          toast.error(res.message);
        }
      })
      .catch(() => undefined);
  };

  /** Put every failed draft of the list back into the queue (each gets one retry: true) and run it. */
  const retryFailed = (ids: string[]) => {
    const todo = ids.filter((id) => rowsRef.current.get(id)?.status === "failed" && !inFlightRef.current.has(id));
    if (!todo.length) return;
    if (openAiRef.current !== true) {
      toast.error(NO_OPENAI);
      return;
    }
    const wasRunning = runningRef.current;
    todo.forEach((id) => {
      retryRef.current.add(id);
      cooldownRef.current.delete(id);
      attemptsRef.current.delete(id);
    });
    startQueue(todo);
    if (wasRunning) announce(`${todo.length} ta xato qoralama qayta urinish uchun navbatga qoʻshildi.`);
  };

  // -------------------------------------------------------------------------
  // Plan
  // -------------------------------------------------------------------------

  const plan = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (planning) return;
    const n = Number(countText);
    if (!Number.isInteger(n) || n < 1 || n > MAX_PLAN) {
      setPlanError(`1 dan ${MAX_PLAN} gacha butun son kiriting.`);
      return;
    }
    if (openAiRef.current !== true) {
      setPlanError(NO_OPENAI);
      return;
    }
    const target = skill;
    const label = skillMeta(target).label;
    setPlanError(null);
    setPlanning(true);
    try {
      const r = await requestJson(
        "/api/admin/exam-gen/plan",
        { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ skill: target, count: n, difficulty }) },
        life(),
        60_000
      );
      if (r.status === 429) rateLimited(retryAfterOf(r.body));
      if (!r.ok) throw new ApiError(r.status, httpError(r.status, r.body, "plan"));
      if (!isObj(r.body) || !Array.isArray(r.body.drafts)) throw new ApiError(r.status, UNEXPECTED);
      const drafts = parseDrafts(r.body.drafts);
      drafts.forEach(upsert);
      commit();
      if (!drafts.length) {
        toast.info("Server hech qanday qoralama yaratmadi.");
        return;
      }
      toast.success(`${drafts.length} ta ${label} qoralamasi rejalashtirildi — generatsiya boshlandi.`);
      // Make the new drafts visible if a filter would hide them.
      setFilter((f) => (f === "all" || f === "queued" ? f : "all"));
      startQueue(drafts.map((d) => d.id));
    } catch (err) {
      if (isCancelled(err)) return;
      const message = errorText(err, `${ACTION_FAILED.plan}.`);
      setPlanError(message);
      toast.error(message);
    } finally {
      if (mountedRef.current) setPlanning(false);
    }
  };

  // -------------------------------------------------------------------------
  // Publish / delete (admins only — the server answers 403 to teachers)
  // -------------------------------------------------------------------------

  const skillsOf = (ids: string[]): GenSkill[] => {
    const set = new Set<GenSkill>();
    ids.forEach((id) => {
      const r = rowsRef.current.get(id);
      if (r) set.add(r.skill);
    });
    return set.size ? Array.from(set) : [skill];
  };

  const publishIds = async (ids: string[], publish: boolean, kind: BusyAction) => {
    if (!ids.length || busyRef.current) return;
    if (!canManage) {
      toast.error(httpError(403, null, "publish"));
      return;
    }
    busyRef.current = true;
    setBusy(kind);
    const skills = skillsOf(ids);
    try {
      let updated = 0;
      for (const part of chunk(ids, 500)) {
        const r = await requestJson(
          "/api/admin/exam-gen/publish",
          { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ ids: part, publish }) },
          life(),
          60_000
        );
        if (!r.ok) throw new ApiError(r.status, httpError(r.status, r.body, "publish"));
        if (!isObj(r.body) || typeof r.body.updated !== "number") throw new ApiError(r.status, UNEXPECTED);
        updated += r.body.updated;
      }
      const unchanged = ids.length - updated;
      const note =
        unchanged > 0
          ? publish
            ? ` ${unchanged} tasi oʻzgarmadi — faqat yakunlangan va tekshiruvdan oʻtgan testlar nashr qilinadi.`
            : ` ${unchanged} tasi oʻzgarmadi (ular nashr qilinmagan edi).`
          : "";
      const message = `${updated} ta yangilandi.${note}`;
      if (updated > 0) toast.success(message);
      else toast.info(message);
      announce(message);
      setSelected(new Set<string>());
      await refresh(skills, true);
    } catch (err) {
      if (isCancelled(err)) return;
      const message = errorText(err, `${ACTION_FAILED.publish}.`);
      toast.error(message);
      announce(message);
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(null);
    }
  };

  const deleteIds = async (ids: string[]) => {
    if (!ids.length || busyRef.current) return;
    if (!canManage) {
      toast.error(httpError(403, null, "delete"));
      return;
    }
    busyRef.current = true;
    setBusy("delete");
    const skills = skillsOf(ids);
    try {
      let deleted = 0;
      for (const part of chunk(ids, 500)) {
        const r = await requestJson(
          "/api/admin/exam-gen/delete",
          { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ ids: part }) },
          life(),
          60_000
        );
        if (!r.ok) throw new ApiError(r.status, httpError(r.status, r.body, "delete"));
        if (!isObj(r.body) || typeof r.body.deleted !== "number") throw new ApiError(r.status, UNEXPECTED);
        deleted += r.body.deleted;
        forget(part);
        commit();
      }
      const message = `${deleted} ta oʻchirildi.`;
      toast.success(message);
      announce(message);
      setSelected(new Set<string>());
      setConfirmIds(null);
      if (previewId && ids.includes(previewId)) setPreviewId(null);
      await refresh(skills, true);
    } catch (err) {
      if (isCancelled(err)) return;
      const message = errorText(err, `${ACTION_FAILED.delete}.`);
      toast.error(message);
      announce(message);
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(null);
    }
  };

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  // Mount: load every skill; unmount: stop the queue and abort all requests.
  useEffect(() => {
    const ctl = new AbortController();
    lifeRef.current = ctl;
    mountedRef.current = true;
    void refresh(SKILL_IDS, true);
    return () => {
      mountedRef.current = false;
      runningRef.current = false;
      ctl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live countdown while the AI budget is exhausted (workers resume by themselves).
  useEffect(() => {
    if (!pausedUntil) return;
    setClock(Date.now());
    const timer = window.setInterval(() => {
      const now = Date.now();
      setClock(now);
      if (now >= pausedUntilRef.current) {
        window.clearInterval(timer);
        setPausedUntil(0);
        if (runningRef.current) announce("Limit vaqti tugadi — navbat davom etmoqda.");
      }
    }, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pausedUntil]);

  // ---- Derived data ----
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows: DraftSummary[] = useMemo(() => Array.from(rowsRef.current.values()), [version]);
  const stats: Record<GenSkill, SkillStats> = useMemo(() => computeStats(rows), [rows]);
  const unfinishedKey = SKILL_IDS.filter((s) => stats[s].queued + stats[s].generating > 0).join(",");

  // Idle but unfinished drafts exist: re-fetch every ~15 s while the tab is visible.
  useEffect(() => {
    if (running || !unfinishedKey) return;
    const skills = unfinishedKey.split(",").filter(isSkill);
    const tick = () => {
      if (document.visibilityState !== "visible" || runningRef.current || refreshCountRef.current > 0) return;
      void refresh(skills, true);
    };
    const timer = window.setInterval(tick, IDLE_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, unfinishedKey]);

  /** Unfinished drafts (all skills): how many, steps left, and done / total steps among them. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const work: { drafts: number; steps: number; done: number; total: number } = useMemo(() => {
    let drafts = 0;
    let steps = 0;
    let done = 0;
    let total = 0;
    for (const r of rows) {
      if (isPending(r) || (r.status === "failed" && retryRef.current.has(r.id))) {
        drafts += 1;
        steps += Math.max(0, r.steps - r.stepsDone);
        done += r.stepsDone;
        total += r.steps;
      }
    }
    return { drafts, steps, done, total };
  }, [rows]);

  const run: { done: number; total: number; finished: number; failed: number; members: number } = useMemo(() => {
    let done = 0;
    let total = 0;
    let finished = 0;
    let failed = 0;
    let members = 0;
    runIdsRef.current.forEach((id) => {
      const r = rowsRef.current.get(id);
      if (!r) return;
      members += 1;
      if (r.status === "ready" || r.status === "published") {
        finished += 1;
        done += r.steps;
        total += r.steps;
      } else if (r.status === "failed" && !retryRef.current.has(r.id)) {
        // Skipped: its missing steps no longer count toward the run.
        failed += 1;
        done += r.stepsDone;
        total += r.stepsDone;
      } else {
        done += r.stepsDone;
        total += r.steps;
      }
    });
    return { done, total, finished, failed, members };
    // Reads refs: `version` is bumped whenever they change, so it is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const current = stats[skill];
  const meta = skillMeta(skill);
  const SkillIcon = meta.icon;
  const inProgress = current.queued + current.generating;
  const fill = fillToTarget(current);
  const generationOff = openAi !== true;
  const inFlightCount = inFlightRef.current.size;
  const draining = !running && slotsRef.current.size > 0;
  const rateLimitLeft = pausedUntil > 0 ? Math.max(0, Math.ceil((pausedUntil - clock) / 1000)) : 0;
  const parallel = Math.max(1, Math.min(concurrency, work.drafts || 1));
  const etaSec = avgStepMs && work.steps ? (work.steps * avgStepMs) / parallel / 1000 + rateLimitLeft : null;
  // Overall progress: the current run's drafts (incl. those finished meanwhile); before any run in this
  // session (e.g. after a reload), the unfinished drafts on the server.
  const progress = run.members > 0 ? { done: run.done, total: run.total } : { done: work.done, total: work.total };
  const progressPct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const skillLoaded = loadedRef.current.has(skill);

  const planCount = Number(countText);
  const planValid = Number.isInteger(planCount) && planCount >= 1 && planCount <= MAX_PLAN;
  const planSteps = planValid ? planCount * STEPS_FOR[skill] : 0;

  const queueState: { label: string; tone: string } = running
    ? rateLimitLeft > 0
      ? { label: "limit kutilmoqda", tone: "border-amber-400/40 bg-amber-400/10 text-amber-200" }
      : { label: "ishlamoqda", tone: "border-averna-neon/40 bg-averna-neon/10 text-averna-neon" }
    : draining
    ? { label: "toʻxtatilmoqda…", tone: "border-amber-400/40 bg-amber-400/10 text-amber-200" }
    : work.drafts > 0
    ? { label: "toʻxtatilgan", tone: "border-white/15 bg-white/5 text-gray-300" }
    : { label: "boʻsh", tone: "border-white/10 bg-white/5 text-gray-400" };

  // ---- List ----
  const skillRows: DraftSummary[] = useMemo(() => rows.filter((r) => r.skill === skill).sort(byNewest), [rows, skill]);
  const filtered: DraftSummary[] = useMemo(
    () => (filter === "all" ? skillRows : skillRows.filter((r) => r.status === filter)),
    [skillRows, filter]
  );
  const visible = filtered.slice(0, limit);
  const visibleIds = visible.map((r) => r.id);
  const selectedIds = skillRows.filter((r) => selected.has(r.id)).map((r) => r.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someVisibleSelected = visibleIds.some((id) => selected.has(id));
  const readyIds = skillRows.filter((r) => r.status === "ready").map((r) => r.id);
  const failedIds = skillRows.filter((r) => r.status === "failed" && !retryRef.current.has(r.id)).map((r) => r.id);
  const canAct = canManage && !busy && selectedIds.length > 0;
  const confirmRows = confirmIds ? confirmIds.map((id) => rowsRef.current.get(id)).filter((r): r is DraftSummary => !!r) : [];

  const changeFilter = (next: FilterKey) => {
    setFilter(next);
    setLimit(PAGE_SIZE);
    setSelected(new Set<string>());
  };

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const changeSkill = (next: GenSkill) => {
    if (next === skill) return;
    setSkill(next);
    setFilter("all");
    setLimit(PAGE_SIZE);
    setSelected(new Set<string>());
    setExpanded(new Set<string>());
    setPlanError(null);
  };

  const onTabKey = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = SKILLS.length - 1;
    const next =
      e.key === "ArrowRight" ? (index === last ? 0 : index + 1) : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
    if (next < 0) return;
    e.preventDefault();
    changeSkill(SKILLS[next].id);
    tabRefs.current[next]?.focus();
  };

  // Target bar segments (never wider than 100 % together).
  const pctPublished = Math.min(100, (current.published / TARGET) * 100);
  const pctReady = Math.min(100 - pctPublished, (current.ready / TARGET) * 100);
  const pctProgress = Math.min(100 - pctPublished - pctReady, (inProgress / TARGET) * 100);

  // ---- Row pieces shared by the table and the mobile cards ----
  const ACTION_BUTTON =
    "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs font-medium transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 " +
    FOCUS_RING;

  const errorLine = (row: DraftSummary) =>
    row.lastError && row.status !== "ready" && row.status !== "published" ? (
      <p className="mt-1 line-clamp-2 break-words text-[11px] leading-snug text-red-300" title={row.lastError}>
        {row.status === "failed" ? "Xato" : "Oxirgi xato"}
        {row.failures > 0 ? ` (${row.failures} marta)` : ""}: {row.lastError}
      </p>
    ) : null;

  /** A finished test the validator rejects: publishing will skip it. */
  const notPublishable = (row: DraftSummary) =>
    row.status === "ready" && row.warnings.some(isErrorWarning) ? (
      <p className="mt-1 text-[10px] text-red-300">tekshiruvdan oʻtmadi — nashr qilinmaydi</p>
    ) : null;

  const questionsLabel = (row: DraftSummary): string => (row.skill === "READING" || row.skill === "LISTENING" ? String(row.questions) : "—");

  const warningsToggle = (row: DraftSummary, open: boolean, listId: string) => {
    if (!row.warnings.length) return <span className="text-gray-600">—</span>;
    const hasErrors = row.warnings.some(isErrorWarning);
    return (
      <button
        type="button"
        onClick={() => toggleExpanded(row.id)}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs",
          hasErrors ? "text-red-300 hover:bg-red-500/10" : "text-amber-200 hover:bg-amber-400/10",
          FOCUS_RING
        )}
      >
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        <span className="tabular-nums">{row.warnings.length}</span>
        <span className="sr-only"> ta ogohlantirish</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
      </button>
    );
  };

  const rowActions = (row: DraftSummary, active: boolean, retrying: boolean) => (
    <>
      <button
        type="button"
        onClick={() => setPreviewId(row.id)}
        aria-label={`Koʻrish: ${row.title}`}
        className={cn(ACTION_BUTTON, "border-averna-cyan/30 text-averna-cyan hover:bg-averna-cyan/10")}
      >
        <Eye className="h-3.5 w-3.5" aria-hidden />
        Koʻrish
      </button>
      {row.status === "failed" && (
        <button
          type="button"
          onClick={() => retryDraft(row.id)}
          disabled={generationOff || active || retrying || rateLimitLeft > 0}
          aria-label={`Qayta urinish: ${row.title}`}
          title={retrying ? "Qayta urinish navbatda" : undefined}
          className={cn(ACTION_BUTTON, "border-red-400/30 text-red-200 hover:bg-red-500/10")}
        >
          {active ? <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden /> : <RotateCcw className="h-3.5 w-3.5" aria-hidden />}
          Qayta urinish
        </button>
      )}
    </>
  );

  return (
    <section aria-labelledby={`${uid}-title`} className="space-y-5">
      {/* ---------------- Header + queue ---------------- */}
      <Card className="glass border-averna-purple/30">
        <CardHeader className="space-y-2">
          <h2 id={`${uid}-title`} className="flex items-center gap-2 text-xl font-semibold leading-tight text-averna-purple sm:text-2xl">
            <Layers className="h-5 w-5 shrink-0" aria-hidden />
            Ommaviy test generatori
          </h2>
          <CardDescription className="text-gray-400">
            Kutubxonani har bir koʻnikma boʻyicha {TARGET} tagacha testga toʻldiring. Har bir test original boʻlib, bosqichma-bosqich yaratiladi:
            bitta soʻrovda bitta Reading matni, bitta Listening qismi yoki bitta topshiriq. Oʻquvchilar testni faqat siz uni nashr
            qilganingizdan keyin koʻradi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {openAi === false && (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
              <div className="min-w-0">
                <p className="font-semibold text-amber-200">OPENAI_API_KEY sozlanmagan — generatsiya oʻchirilgan</p>
                <p className="mt-1 text-xs text-amber-100/80">
                  Yangi testlarni rejalashtirish va yaratish uchun serverda OPENAI_API_KEY muhit oʻzgaruvchisini sozlang. Mavjud testlarni
                  koʻrish, nashr qilish va oʻchirish ishlayveradi.
                </p>
              </div>
            </div>
          )}

          {loadError && (
            <div role="alert" className="flex flex-wrap items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden />
              <p className="min-w-0 flex-1">{loadError}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void refresh(SKILL_IDS)}
                disabled={refreshing}
                className="h-8 border-red-400/40 bg-transparent text-red-100 hover:bg-red-500/10"
              >
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", refreshing && "motion-safe:animate-spin")} aria-hidden />
                Qayta yuklash
              </Button>
            </div>
          )}

          {/* Queue panel (all skills) */}
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Gauge className="h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
                <h3 className="text-sm font-semibold text-white">Generatsiya navbati</h3>
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", queueState.tone)}>{queueState.label}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor={`${uid}-concurrency`} className="text-xs text-gray-400">
                  Parallel soʻrovlar
                </label>
                <select
                  id={`${uid}-concurrency`}
                  value={concurrency}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => changeConcurrency(Number(e.target.value))}
                  className={cn(FIELD, "h-9 w-16 px-2")}
                >
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n} className="bg-averna-dark">
                      {n}
                    </option>
                  ))}
                </select>
                {/* One element for Start / Pause, so keyboard focus stays on it when the state flips. */}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => (running ? pauseQueue() : startQueue())}
                  disabled={!running && (generationOff || work.drafts === 0 || initialLoading)}
                  className={cn(
                    "min-w-[7.5rem]",
                    running
                      ? "border border-amber-400/40 bg-transparent text-amber-200 hover:bg-amber-400/10"
                      : "neon-button bg-averna-primary text-white hover:bg-averna-light"
                  )}
                >
                  {running ? <Pause className="mr-1.5 h-4 w-4" aria-hidden /> : <Play className="mr-1.5 h-4 w-4" aria-hidden />}
                  {running ? "Toʻxtatish" : "Boshlash"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void refresh(SKILL_IDS)}
                  disabled={refreshing}
                  aria-label="Roʻyxatni yangilash"
                  title="Roʻyxatni yangilash"
                  className="h-9 w-9 p-0 text-gray-300 hover:bg-white/5 hover:text-white"
                >
                  <RefreshCw className={cn("h-4 w-4", refreshing && "motion-safe:animate-spin")} aria-hidden />
                </Button>
              </div>
            </div>

            {initialLoading ? (
              <p className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden /> Qoralamalar yuklanmoqda…
              </p>
            ) : progress.total > 0 ? (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-gray-400">
                  <span>
                    <span className="font-semibold tabular-nums text-white">{progress.done}</span> /{" "}
                    <span className="tabular-nums">{progress.total}</span> qadam · <span className="tabular-nums">{progressPct}%</span>
                  </span>
                  {etaSec !== null && work.steps > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      Taxminan {formatDuration(etaSec)} qoldi
                    </span>
                  )}
                </div>
                <div
                  role="progressbar"
                  aria-label="Navbatning umumiy jarayoni"
                  aria-valuemin={0}
                  aria-valuemax={progress.total}
                  aria-valuenow={progress.done}
                  aria-valuetext={`${progress.done} / ${progress.total} qadam`}
                  className="h-2 overflow-hidden rounded-full bg-white/10"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-averna-purple to-averna-cyan transition-[width] duration-500 motion-reduce:transition-none"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-500">
                  {run.members > 0 ? (
                    <>
                      {run.finished} ta tayyor · {work.drafts} ta jarayonda
                      {run.failed > 0 && <span className="text-red-300"> · {run.failed} ta xato</span>}
                    </>
                  ) : (
                    <>
                      {work.drafts} ta tugallanmagan qoralama, {work.steps} ta qadam qoldi
                      {!running && work.drafts > 0 && " — davom ettirish uchun «Boshlash»ni bosing"}
                    </>
                  )}
                  {inFlightCount > 0 && <> · hozir {inFlightCount} ta soʻrov bajarilmoqda</>}
                  {avgStepMs !== null && <> · oʻrtacha qadam {formatDuration(avgStepMs / 1000)}</>}
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-500">Navbat boʻsh. Quyida koʻnikmani tanlab, yangi testlarni rejalashtiring.</p>
            )}

            {rateLimitLeft > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-100">
                <Timer className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                <p>
                  AI limiti tugadi. {running ? "Navbat avtomatik davom etadi" : "Generatsiya yana mumkin boʻladi"}:{" "}
                  <span className="font-semibold tabular-nums text-white">{formatClock(rateLimitLeft)}</span>
                </p>
              </div>
            )}

            {queueError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden />
                <p className="min-w-0 flex-1">{queueError}</p>
                <button
                  type="button"
                  onClick={() => setQueueError(null)}
                  aria-label="Xabarni yopish"
                  className={cn("rounded p-0.5 text-red-200/80 hover:text-white", FOCUS_RING)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            )}

            <p role="status" aria-live="polite" className="min-h-[1rem] text-xs text-gray-400">
              {announcement}
            </p>
            <p className="text-[11px] text-gray-500">
              Generatsiya shu brauzer oynasi orqali boshqariladi — navbat ishlayotganda sahifani ochiq qoldiring. Sahifa yangilansa, navbat
              serverdagi holatdan davom etadi.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Skill tabs ---------------- */}
      <div role="tablist" aria-label="Koʻnikma" className="no-scrollbar flex gap-1.5 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {SKILLS.map((s, i) => {
          const st = stats[s.id];
          const active = s.id === skill;
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              ref={(el: HTMLButtonElement | null) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${uid}-tab-${s.id}`}
              aria-selected={active}
              aria-controls={`${uid}-panel`}
              tabIndex={active ? 0 : -1}
              onClick={() => changeSkill(s.id)}
              onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => onTabKey(e, i)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors motion-reduce:transition-none",
                FOCUS_RING,
                active ? "border-averna-purple/40 bg-averna-purple/15 text-white" : "border-transparent text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{s.label}</span>
              <span className="rounded-full bg-black/30 px-1.5 text-[10px] tabular-nums text-gray-300" aria-hidden>
                {st.published}/{TARGET}
              </span>
              <span className="sr-only">, {st.published} ta nashr qilingan</span>
              {st.queued + st.generating > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-averna-purple" aria-hidden />}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${skill}`} className="space-y-5">
        {/* ---------------- Stats + plan ---------------- */}
        <Card className="glass border-averna-cyan/25">
          <CardHeader className="space-y-1.5 pb-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
              <SkillIcon className="h-5 w-5 text-averna-cyan" aria-hidden />
              {meta.label}
            </h3>
            <CardDescription className="text-gray-400">{meta.howItWorks}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "nashr qilingan", value: current.published, tone: "text-averna-neon" },
                { label: "tayyor", value: current.ready, tone: "text-averna-cyan" },
                { label: "jarayonda", value: inProgress, tone: "text-averna-purple" },
                { label: "xato", value: current.failed, tone: current.failed ? "text-red-300" : "text-gray-400" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <dt className="text-[11px] text-gray-400">{item.label}</dt>
                  <dd className={cn("text-xl font-bold tabular-nums", item.tone)}>{skillLoaded ? item.value : "…"}</dd>
                </div>
              ))}
            </dl>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-gray-200">
                  <Target className="h-3.5 w-3.5 text-averna-neon" aria-hidden />
                  Maqsad: {TARGET} ta
                </span>
                <span className="tabular-nums text-gray-400">
                  {current.published} / {TARGET} nashr qilingan
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={`${meta.label}: maqsad sari`}
                aria-valuemin={0}
                aria-valuemax={TARGET}
                aria-valuenow={Math.min(current.published, TARGET)}
                aria-valuetext={`${current.published} ta nashr qilingan, ${current.ready} ta tayyor, ${inProgress} ta jarayonda — maqsad ${TARGET} ta`}
                className="flex h-2.5 overflow-hidden rounded-full bg-white/10"
              >
                <div className="h-full bg-averna-neon transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pctPublished}%` }} />
                <div className="h-full bg-averna-cyan/70 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pctReady}%` }} />
                <div className="h-full bg-averna-purple/50 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pctProgress}%` }} />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500" aria-hidden>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-averna-neon" /> nashr qilingan
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-averna-cyan/70" /> tayyor
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-averna-purple/50" /> jarayonda
                </span>
              </div>
            </div>

            {/* Plan form */}
            <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => void plan(e)} className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4" noValidate>
              <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Wand2 className="h-4 w-4 text-averna-purple" aria-hidden />
                Yangi testlarni rejalashtirish
              </h4>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                <div className="space-y-1.5">
                  <label htmlFor={`${uid}-count`} className="text-xs text-gray-400">
                    Nechta test (1–{MAX_PLAN})
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      id={`${uid}-count`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX_PLAN}
                      step={1}
                      value={countText}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setCountText(e.target.value);
                        setPlanError(null);
                      }}
                      aria-invalid={!planValid}
                      aria-describedby={`${uid}-plan-hint`}
                      disabled={planning}
                      className={cn(FIELD, "w-24 tabular-nums")}
                    />
                    {[10, 35].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setCountText(String(n));
                          setPlanError(null);
                        }}
                        disabled={planning}
                        aria-pressed={countText === String(n)}
                        className={cn(
                          CHIP_BUTTON,
                          countText === String(n) ? "border-averna-purple/60 bg-averna-purple/20 text-white" : "border-white/15 text-gray-300 hover:border-white/30 hover:text-white"
                        )}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setCountText(String(fill));
                        setPlanError(null);
                      }}
                      disabled={planning || fill === 0 || !skillLoaded}
                      title={fill === 0 ? "Maqsad allaqachon toʻlgan (nashr qilingan, tayyor va jarayondagi testlar)" : undefined}
                      className={cn(CHIP_BUTTON, "border-averna-neon/30 text-averna-neon hover:border-averna-neon/60 hover:bg-averna-neon/10")}
                    >
                      <Target className="h-3.5 w-3.5" aria-hidden />
                      {TARGET} gacha toʻldirish{fill > 0 ? ` (${fill})` : ""}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`${uid}-difficulty`} className="text-xs text-gray-400">
                    Qiyinlik
                  </label>
                  <select
                    id={`${uid}-difficulty`}
                    value={difficulty}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDifficulty(e.target.value as DifficultyChoice)}
                    disabled={planning}
                    className={cn(FIELD, "w-full")}
                  >
                    {DIFFICULTY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} className="bg-averna-dark">
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p id={`${uid}-plan-hint`} className="text-[11px] text-gray-500">
                {planValid
                  ? `${planCount} ta ${meta.label} testi = ${planSteps} ta soʻrov${
                      avgStepMs ? ` (taxminan ${formatDuration((planSteps * avgStepMs) / Math.min(concurrency, planCount) / 1000)})` : ""
                    }. `
                  : `1 dan ${MAX_PLAN} gacha butun son kiriting. `}
                {difficulty === "mixed" && "Aralash: Oʻrtacha, Oson, Oʻrtacha, Qiyin navbatma-navbat. "}
                Rejalashtirilgach, navbat avtomatik boshlanadi.
              </p>
              {planError && (
                <p role="alert" className="text-xs text-red-300">
                  {planError}
                </p>
              )}
              <Button
                type="submit"
                disabled={planning || generationOff || !planValid || initialLoading}
                className="neon-button bg-averna-purple text-white hover:bg-averna-purple/80"
              >
                {planning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" aria-hidden /> Rejalashtirilmoqda…
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" aria-hidden /> Rejalashtirish
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ---------------- Drafts list ---------------- */}
        <Card className="glass border-white/10">
          <CardHeader className="space-y-3 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3
                ref={(el: HTMLHeadingElement | null) => {
                  listHeadingRef.current = el;
                }}
                tabIndex={-1}
                className="flex items-center gap-2 text-lg font-semibold text-white outline-none"
              >
                <FileText className="h-5 w-5 text-averna-cyan" aria-hidden />
                {meta.label} testlari
                <span className="text-sm font-normal tabular-nums text-gray-400">({skillRows.length})</span>
              </h3>
              {failedIds.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => retryFailed(failedIds)}
                  disabled={generationOff || rateLimitLeft > 0}
                  className="h-8 border-red-400/30 bg-transparent text-red-200 hover:bg-red-500/10 hover:text-red-100"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Barcha xatolarni qayta urinish ({failedIds.length})
                </Button>
              )}
            </div>
            <div role="group" aria-label="Holat boʻyicha filtr" className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => {
                const n = f.key === "all" ? skillRows.length : current[f.key];
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => changeFilter(f.key)}
                    className={cn(
                      CHIP_BUTTON,
                      active ? "border-averna-cyan/60 bg-averna-cyan/15 text-white" : "border-white/10 text-gray-400 hover:border-white/25 hover:text-white"
                    )}
                  >
                    {f.label}
                    <span className="text-[10px] tabular-nums opacity-80">{n}</span>
                  </button>
                );
              })}
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Bulk actions */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
              <label className="inline-flex items-center gap-2 px-1 text-xs text-gray-300 md:hidden">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el: HTMLInputElement | null) => {
                    if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                  }}
                  onChange={toggleAllVisible}
                  disabled={!visible.length}
                  className="h-4 w-4 accent-averna-purple"
                />
                Koʻrinayotganlarni tanlash
              </label>
              <span className="px-1 text-xs tabular-nums text-gray-400">{selectedIds.length} ta tanlandi</span>
              <Button
                type="button"
                size="sm"
                onClick={() => void publishIds(selectedIds, true, "publish")}
                disabled={!canAct}
                className="h-8 bg-averna-primary text-white hover:bg-averna-light"
              >
                {busy === "publish" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />
                ) : (
                  <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                )}
                Nashr qilish
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void publishIds(selectedIds, false, "unpublish")}
                disabled={!canAct}
                className="h-8 bg-transparent text-gray-200"
              >
                {busy === "unpublish" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />
                ) : (
                  <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                )}
                Nashrdan olish
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setConfirmIds(selectedIds)}
                disabled={!canAct}
                className="h-8 border-red-500/40 bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-200"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Oʻchirish
              </Button>
              <span className="hidden flex-1 sm:block" aria-hidden />
              <Button
                type="button"
                size="sm"
                onClick={() => void publishIds(readyIds, true, "publish-all")}
                disabled={!canManage || busy !== null || readyIds.length === 0}
                className="neon-button h-8 bg-averna-primary text-white hover:bg-averna-light"
              >
                {busy === "publish-all" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                )}
                Barcha tayyorlarni nashr qilish ({readyIds.length})
              </Button>
            </div>
            {!canManage && (
              <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Nashr qilish va oʻchirish faqat administratorlar uchun.
              </p>
            )}

            {!skillLoaded && initialLoading ? (
              <div className="space-y-2" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 rounded-lg bg-white/5 motion-safe:animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
                <FileText className="mb-2 h-8 w-8 text-gray-500" aria-hidden />
                {skillRows.length === 0 ? (
                  <>
                    <p className="font-semibold text-white">Hozircha {meta.label} testlari yoʻq</p>
                    <p className="mt-1 max-w-sm text-sm text-gray-400">Yuqorida nechta test kerakligini tanlab, «Rejalashtirish»ni bosing.</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-white">Bu holatda testlar yoʻq</p>
                    <button type="button" onClick={() => changeFilter("all")} className={cn("mt-2 rounded text-sm text-averna-cyan hover:underline", FOCUS_RING)}>
                      Barchasini koʻrsatish
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                {/* ≥ md: table */}
                <div className="hidden overflow-x-auto rounded-xl border border-white/10 md:block">
                  <table className="w-full min-w-[48rem] text-left text-sm">
                    <caption className="sr-only">{meta.label} testlari roʻyxati</caption>
                    <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wider text-gray-400">
                      <tr>
                        <th scope="col" className="w-10 px-3 py-2.5">
                          <input
                            type="checkbox"
                            aria-label="Koʻrinayotgan barcha qatorlarni tanlash"
                            checked={allVisibleSelected}
                            ref={(el: HTMLInputElement | null) => {
                              if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                            }}
                            onChange={toggleAllVisible}
                            className="h-4 w-4 align-middle accent-averna-purple"
                          />
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-medium">
                          Test
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-medium">
                          Qiyinlik
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-medium">
                          Holat
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-medium">
                          Qadamlar
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-medium">
                          Savollar
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-medium">
                          Ogohlantirish
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-medium">
                          Yaratilgan
                        </th>
                        <th scope="col" className="px-3 py-2.5 text-right font-medium">
                          <span className="sr-only">Amallar</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {visible.map((row) => {
                        const active = inFlightRef.current.has(row.id);
                        const retrying = retryRef.current.has(row.id);
                        const isSelected = selected.has(row.id);
                        const open = expanded.has(row.id);
                        const warnId = `${uid}-warn-t-${row.id}`;
                        return (
                          <Fragment key={row.id}>
                            <tr
                              className={cn(
                                "align-top transition-colors motion-reduce:transition-none",
                                isSelected ? "bg-averna-purple/[0.07]" : "hover:bg-white/[0.02]"
                              )}
                            >
                              <td className="px-3 py-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleRow(row.id)}
                                  aria-label={`Tanlash: ${row.title}`}
                                  className="h-4 w-4 align-middle accent-averna-purple"
                                />
                              </td>
                              <td className="max-w-[20rem] px-3 py-3">
                                <p className="line-clamp-2 font-medium text-white" title={row.title}>
                                  {row.title}
                                </p>
                                {row.topic && (
                                  <p className="mt-0.5 truncate text-xs text-gray-400" title={row.topic}>
                                    {row.topic}
                                  </p>
                                )}
                                {errorLine(row)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-300">{DIFFICULTY_LABEL[row.difficulty]}</td>
                              <td className="px-3 py-3">
                                <StatusChip status={row.status} active={active} retrying={retrying} />
                                {notPublishable(row)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-xs">
                                <StepsMeter done={row.stepsDone} total={row.steps} />
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-gray-300">{questionsLabel(row)}</td>
                              <td className="px-3 py-3 text-xs">{warningsToggle(row, open, warnId)}</td>
                              <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-400">
                                <time dateTime={row.createdAt}>{formatCreated(row.createdAt)}</time>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex justify-end gap-1.5">{rowActions(row, active, retrying)}</div>
                              </td>
                            </tr>
                            {open && row.warnings.length > 0 && (
                              <tr className="bg-black/20">
                                <td colSpan={9} className="px-4 py-3">
                                  <WarningList id={warnId} warnings={row.warnings} />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* < md: cards */}
                <ul className="space-y-2 md:hidden">
                  {visible.map((row) => {
                    const active = inFlightRef.current.has(row.id);
                    const retrying = retryRef.current.has(row.id);
                    const isSelected = selected.has(row.id);
                    const open = expanded.has(row.id);
                    const warnId = `${uid}-warn-c-${row.id}`;
                    return (
                      <li
                        key={row.id}
                        className={cn(
                          "rounded-xl border p-3 transition-colors motion-reduce:transition-none",
                          isSelected ? "border-averna-purple/40 bg-averna-purple/[0.07]" : "border-white/10 bg-white/[0.03]"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(row.id)}
                            aria-label={`Tanlash: ${row.title}`}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-averna-purple"
                          />
                          <div className="min-w-0 flex-1 space-y-2">
                            <div>
                              <p className="line-clamp-2 text-sm font-medium text-white">{row.title}</p>
                              {row.topic && <p className="truncate text-xs text-gray-400">{row.topic}</p>}
                              {errorLine(row)}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-gray-400">
                              <StatusChip status={row.status} active={active} retrying={retrying} />
                              <span>{DIFFICULTY_LABEL[row.difficulty]}</span>
                              <span className="inline-flex items-center gap-1">
                                Qadam: <StepsMeter done={row.stepsDone} total={row.steps} />
                              </span>
                              {questionsLabel(row) !== "—" && <span>{questionsLabel(row)} ta savol</span>}
                              <time dateTime={row.createdAt}>{formatCreated(row.createdAt)}</time>
                            </div>
                            {notPublishable(row)}
                            {row.warnings.length > 0 && (
                              <div>
                                {warningsToggle(row, open, warnId)}
                                {open && (
                                  <div className="mt-1.5 rounded-lg bg-black/20 p-2">
                                    <WarningList id={warnId} warnings={row.warnings} />
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">{rowActions(row, active, retrying)}</div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {filtered.length > visible.length && (
                  <div className="flex justify-center pt-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => setLimit((n) => n + PAGE_SIZE)} className="bg-transparent text-gray-200">
                      <ChevronDown className="mr-1.5 h-4 w-4" aria-hidden />
                      Koʻproq koʻrsatish ({filtered.length - visible.length} ta qoldi)
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {previewId && (
        <PreviewDialog
          id={previewId}
          row={rowsRef.current.get(previewId)}
          canManage={canManage}
          busy={busy !== null}
          onPublish={(id, publish) => void publishIds([id], publish, publish ? "publish" : "unpublish")}
          onClose={() => setPreviewId(null)}
          fallbackFocus={listHeadingRef}
        />
      )}

      {confirmIds && (
        <Modal
          labelledBy={`${uid}-confirm-title`}
          describedBy={`${uid}-confirm-desc`}
          onClose={() => {
            if (!busyRef.current) setConfirmIds(null);
          }}
          className="max-w-md"
          fallbackFocus={listHeadingRef}
        >
          <div className="p-5 sm:p-6">
            <h2 id={`${uid}-confirm-title`} className="flex items-center gap-2 text-lg font-bold text-white">
              <Trash2 className="h-5 w-5 text-red-300" aria-hidden />
              Testlarni oʻchirish
            </h2>
            <div id={`${uid}-confirm-desc`} className="mt-2 space-y-2 text-sm text-gray-300">
              <p>Tanlangan {confirmIds.length} ta testni oʻchirasizmi? Bu amalni ortga qaytarib boʻlmaydi.</p>
              {confirmRows.some((r) => r.status === "published") && (
                <p className="text-xs text-amber-200">
                  Shundan {confirmRows.filter((r) => r.status === "published").length} tasi nashr qilingan — ular oʻquvchilar kutubxonasidan ham
                  olib tashlanadi.
                </p>
              )}
              {confirmRows.some((r) => inFlightRef.current.has(r.id)) && (
                <p className="text-xs text-gray-400">Baʼzilari hozir yaratilmoqda — ularning joriy qadami natijasi bekor boʻladi.</p>
              )}
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" data-autofocus onClick={() => setConfirmIds(null)} disabled={busy === "delete"} className="bg-transparent">
                Bekor qilish
              </Button>
              <Button
                type="button"
                onClick={() => void deleteIds(confirmIds)}
                disabled={busy === "delete"}
                className="bg-red-600 text-white hover:bg-red-500"
              >
                {busy === "delete" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" aria-hidden /> Oʻchirilmoqda…
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Oʻchirish
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
