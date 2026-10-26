"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, ClipboardList, Flame, Headphones, Mic, PenLine, Sparkles, Zap } from "lucide-react";
import {
  buildDailyPlan,
  DEFAULT_SESSION_LENGTH,
  parseSessionLength,
  SESSION_LENGTHS,
  SESSION_LENGTH_KEY,
  SESSION_STEP_KEY,
  type DailyPlan,
  type DailyPlanFacts,
  type SessionLength,
  type SessionStep,
} from "@/lib/session/daily-plan";
import { cn } from "@/lib/utils";

const EXAM_DATE_KEY = "averna_exam_date";

export interface TodaySessionProps {
  facts: DailyPlanFacts;
  firstName: string;
  streak: number;
  /** "Good morning" etc. — computed on the server (Tashkent time) so hydration matches. */
  greeting: string;
}

function StepIcon({ step }: { step: SessionStep }) {
  const cls = "h-4 w-4";
  if (step.kind === "warmup") return <Zap className={cls} aria-hidden />;
  if (step.kind === "homework") return <ClipboardList className={cls} aria-hidden />;
  if (step.kind === "bonus") return <Sparkles className={cls} aria-hidden />;
  if (step.skill === "READING") return <BookOpen className={cls} aria-hidden />;
  if (step.skill === "LISTENING") return <Headphones className={cls} aria-hidden />;
  if (step.skill === "WRITING") return <PenLine className={cls} aria-hidden />;
  return <Mic className={cls} aria-hidden />;
}

const KIND_LABEL: Record<SessionStep["kind"], string> = { warmup: "Warm-up", focus: "Focus", homework: "Homework", bonus: "Bonus" };

/** Done / total as a ring; the text equivalent is the visible "1/3" plus the label. */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const R = 20;
  const C = 2 * Math.PI * R;
  const pct = total ? done / total : 0;
  return (
    <div className="relative h-14 w-14 shrink-0" role="img" aria-label={`${done} of ${total} steps done`}>
      <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={R} fill="none" strokeWidth="5" className="stroke-white/10" />
        <circle
          cx="24"
          cy="24"
          r={R}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          className="stroke-averna-neon transition-[stroke-dasharray] duration-500"
          strokeDasharray={`${pct * C} ${C}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white" aria-hidden>
        {done}/{total}
      </span>
    </div>
  );
}

function rememberStep(plan: DailyPlan, step: SessionStep) {
  try {
    const index = plan.steps.findIndex((s) => s.id === step.id);
    sessionStorage.setItem(SESSION_STEP_KEY, JSON.stringify({ step: index + 1, total: plan.steps.length, day: plan.dayKey }));
  } catch {
    /* private mode — the return bar falls back to a shorter label */
  }
}

/**
 * "Today's session" — the one calm hero of the Today tab. A 2–4 step plan
 * (lib/session/daily-plan.ts) built from the server's facts plus two device
 * preferences (length, exam date), a progress ring, and ONE primary button to
 * the first unfinished step. Comes back to life without a reload: when the tab
 * regains focus it re-reads GET /api/session/today and announces newly
 * finished steps. On phones a slim sticky "Continue" bar appears above the tab
 * bar while the hero is scrolled out of view.
 */
export function TodaySession({ facts: initialFacts, firstName, streak, greeting }: TodaySessionProps) {
  const [facts, setFacts] = useState(initialFacts);
  const [minutes, setMinutes] = useState<SessionLength>(DEFAULT_SESSION_LENGTH);
  const [examDate, setExamDate] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [heroVisible, setHeroVisible] = useState(true);
  const heroRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      setMinutes(parseSessionLength(localStorage.getItem(SESSION_LENGTH_KEY)));
      setExamDate(localStorage.getItem(EXAM_DATE_KEY) || null);
    } catch {
      /* storage blocked — defaults stay */
    }
  }, []);

  const plan = useMemo(() => buildDailyPlan({ ...facts, minutes, examDate }), [facts, minutes, examDate]);
  const doneIds = useRef<Set<string>>(new Set(plan.steps.filter((s) => s.done).map((s) => s.id)));
  const seenFacts = useRef(facts);

  // Announce steps that became done after a refresh (not when the length changes).
  useEffect(() => {
    const fresh = seenFacts.current !== facts;
    seenFacts.current = facts;
    const newly = plan.steps.filter((s) => s.done && !doneIds.current.has(s.id));
    doneIds.current = new Set(plan.steps.filter((s) => s.done).map((s) => s.id));
    if (fresh && newly.length) {
      setAnnounce(
        plan.allDone
          ? "Session complete. See you tomorrow."
          : `Step done: ${newly.map((s) => s.title).join(", ")}. ${plan.doneCount} of ${plan.steps.length} complete.`
      );
    }
  }, [plan, facts]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/session/today?minutes=${minutes}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { facts?: DailyPlanFacts };
      if (data?.facts && data.facts.dayKey) setFacts(data.facts);
    } catch {
      /* offline — keep what we have */
    }
  }, [minutes]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setHeroVisible(entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const choose = (m: SessionLength) => {
    setMinutes(m);
    try {
      localStorage.setItem(SESSION_LENGTH_KEY, String(m));
    } catch {
      /* ignore */
    }
  };

  const next = plan.next;
  const nextIndex = next ? plan.steps.findIndex((s) => s.id === next.id) : -1;
  const cta = plan.doneCount === 0 ? "Start" : "Continue";

  return (
    <>
      <section
        ref={heroRef}
        aria-labelledby="today-session-title"
        data-testid="today-session"
        className="av-panel av-panel-hero relative h-full overflow-hidden rounded-3xl p-4 sm:p-6"
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-averna-neon/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-3 sm:gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-300">
                <span className="truncate">
                  {greeting}, {firstName}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-400/15 px-2 py-0.5 text-xs font-semibold text-orange-400">
                  <Flame className="h-3.5 w-3.5" aria-hidden />
                  {streak > 0 ? `Day ${streak}` : "Start a streak today"}
                </span>
              </p>
              <h2 id="today-session-title" className="mt-1 text-xl font-bold leading-tight text-white sm:text-2xl">
                {plan.allDone ? "Session complete — see you tomorrow" : "Today's session"}
              </h2>
              <p className="mt-0.5 text-sm text-gray-400">
                About {plan.totalMinutes} min · {plan.steps.length} steps
              </p>
            </div>
            <ProgressRing done={plan.doneCount} total={plan.steps.length} />
          </div>

          <div role="radiogroup" aria-label="Session length" className="inline-flex w-fit rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
            {SESSION_LENGTHS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={minutes === m}
                onClick={() => choose(m)}
                className={cn(
                  "min-h-11 min-w-[4rem] rounded-lg px-3 text-sm font-medium transition-colors",
                  minutes === m ? "bg-averna-neon/15 text-averna-neon" : "text-gray-400 hover:text-white"
                )}
              >
                {m} min
              </button>
            ))}
          </div>

          <ol aria-label="Today's session steps" className="space-y-1.5">
            {plan.steps.map((step, i) => {
              const isNext = next?.id === step.id;
              return (
                <li key={step.id}>
                  <Link
                    href={step.href}
                    onClick={() => rememberStep(plan, step)}
                    className={cn(
                      "group flex min-h-12 items-center gap-3 rounded-2xl border px-3 py-2 transition",
                      step.done
                        ? "border-averna-neon/20 bg-averna-neon/[0.04]"
                        : isNext
                          ? "border-averna-neon/40 bg-white/[0.04]"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                        step.done ? "bg-averna-neon/15 text-averna-neon" : "bg-white/5 text-gray-300"
                      )}
                    >
                      {step.done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <StepIcon step={step} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="sr-only">
                        Step {i + 1}, {KIND_LABEL[step.kind]}:{" "}
                      </span>
                      <span className={cn("block truncate text-sm font-semibold", step.done ? "text-gray-400 line-through decoration-averna-neon/40" : "text-white")}>
                        {step.title}
                      </span>
                      {isNext && <span className="block truncate text-xs text-gray-400">{step.why}</span>}
                      {step.done && <span className="sr-only"> (done)</span>}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-gray-400">{step.estMinutes} min</span>
                  </Link>
                </li>
              );
            })}
          </ol>

          {next ? (
            <Link
              href={next.href}
              onClick={() => rememberStep(plan, next)}
              aria-label={`${cta}: ${next.title}`}
              className="glow-cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-averna-primary px-6 text-base font-semibold text-white transition hover:bg-averna-light sm:w-auto sm:self-start"
            >
              {cta} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-300">
              <span className="inline-flex items-center gap-1.5 text-averna-neon">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> All {plan.steps.length} steps done.
              </span>
              <Link href="/studio" className="inline-flex min-h-11 items-center text-sm font-medium text-averna-cyan underline-offset-4 hover:underline">
                Do more
              </Link>
            </p>
          )}
        </div>
        <p aria-live="polite" role="status" className="sr-only">
          {announce}
        </p>
      </section>

      {next && !heroVisible && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-3 pb-2 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] lg:hidden">
          <Link
            href={next.href}
            onClick={() => rememberStep(plan, next)}
            data-testid="session-sticky"
            className="glow-cta flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-averna-primary px-4 text-sm font-semibold text-white shadow-lg"
          >
            {cta} · step {nextIndex + 1} of {plan.steps.length} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}
    </>
  );
}
